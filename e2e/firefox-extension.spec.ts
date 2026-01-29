import { test, expect } from '@playwright/test';
import { spawn, execSync } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const ROOT_DIR = resolve(__dirname, '..');
const PROFILE_DIR = resolve(ROOT_DIR, '.playwright-profile');

test.describe('Firefox Extension E2E', () => {
  test.beforeAll(async () => {
    // Build the extension
    console.log('Building extension...');
    execSync('npm run build:firefox', { cwd: ROOT_DIR, stdio: 'inherit' });

    // Set up profile directory
    if (existsSync(PROFILE_DIR)) {
      rmSync(PROFILE_DIR, { recursive: true, force: true });
    }
    mkdirSync(PROFILE_DIR, { recursive: true });

    // Create user.js with preferences to suppress dialogs
    const userJsPath = join(PROFILE_DIR, 'user.js');
    writeFileSync(
      userJsPath,
      [
        'user_pref("browser.aboutwelcome.enabled", false);',
        'user_pref("browser.aboutwelcome.overrideContentUrl", "about:blank");',
        'user_pref("browser.disableResetPrompt", true);',
        'user_pref("browser.newtabpage.activity-stream.showWelcome", false);',
        'user_pref("browser.rights.3.shown", true);',
        'user_pref("browser.rights.override", true);',
        'user_pref("browser.EULA.3.accepted", true);',
        'user_pref("browser.shell.checkDefaultBrowser", false);',
        'user_pref("trailhead.firstrun.branches", "nofirstrun-empty");',
        'user_pref("trailhead.firstrun.didSeeAboutWelcome", true);',
        'user_pref("browser.startup.firstrunSkipsHomepage", true);',
        'user_pref("browser.startup.homepage_override.mstone", "ignore");',
        'user_pref("browser.startup.page", 0);',
        'user_pref("browser.startup.homepage", "about:blank");',
        'user_pref("browser.startup.homepage_welcome_url", "about:blank");',
        'user_pref("browser.startup.homepage_welcome_url.additional", "about:blank");',
        'user_pref("app.normandy.first_run", false);',
        'user_pref("datareporting.healthreport.uploadEnabled", false);',
        'user_pref("datareporting.policy.dataSubmissionEnabled", false);',
        'user_pref("datareporting.policy.dataSubmissionPolicyBypassNotification", true);',
        'user_pref("datareporting.policy.dataSubmissionPolicyAccepted", true);',
        'user_pref("datareporting.policy.dataSubmissionPolicyAcceptedVersion", 999);',
        'user_pref("datareporting.policy.firstRunURL", "");',
        'user_pref("toolkit.telemetry.enabled", false);',
        'user_pref("toolkit.telemetry.unified", false);',
        'user_pref("toolkit.telemetry.reportingpolicy.firstRun", false);',
        'user_pref("devtools.console.stdout.content", true);',
        'user_pref("devtools.console.stdout.chrome", true);',
        'user_pref("browser.dom.window.dump.enabled", true);',
      ].join('\n')
    );

    console.log('Profile setup complete');
  });

  test.afterAll(async () => {
    // Clean up profile directory
    if (existsSync(PROFILE_DIR)) {
      rmSync(PROFILE_DIR, { recursive: true, force: true });
    }
  });

  test('content script injects on x.com and sends SMOKE_PING', async () => {
    const startUrl = process.env.SMOKE_URL || 'https://x.com/';
    const timeoutMs = Number(process.env.SMOKE_TIMEOUT_MS || 45000);

    // Use web-ext to launch Firefox with the extension
    const webExtCmd =
      process.platform === 'win32' ? 'node_modules\\.bin\\web-ext.cmd' : 'node_modules/.bin/web-ext';

    const args = [
      'run',
      '--source-dir',
      'dist',
      '--firefox-profile',
      PROFILE_DIR,
      '--start-url',
      startUrl,
      '--pre-install',
      '--no-input',
      '--verbose',
    ];

    console.log('Launching Firefox with extension...');
    const child = spawn(webExtCmd, args, { cwd: ROOT_DIR, shell: true });

    const result = await new Promise<{ success: boolean; message: string }>((resolve) => {
      let output = '';
      let resolved = false;
      let installDetected = false;
      let successTimer: NodeJS.Timeout | null = null;

      const timeout = setTimeout(() => {
        if (resolved) return;
        resolved = true;
        child.kill('SIGINT');
        resolve({ success: false, message: `Timed out waiting for extension. Output:\n${output}` });
      }, timeoutMs);

      function handleData(data: Buffer) {
        const text = data.toString();
        output += text;
        process.stdout.write(text);

        // Check for extension installation
        if (
          !installDetected &&
          ((text.includes('Installed') && text.includes('temporary add-on')) ||
            text.includes('Installing as an extension proxy'))
        ) {
          installDetected = true;
          console.log('\nExtension installation detected!');
          // Give some time for the content script to execute
          successTimer = setTimeout(() => {
            if (resolved) return;
            resolved = true;
            clearTimeout(timeout);
            child.kill('SIGINT');
            resolve({ success: true, message: 'Extension installed successfully' });
          }, 8000);
        }

        // Check for SMOKE_OK signal (content script -> background -> console.log)
        if (text.includes('SMOKE_OK')) {
          if (resolved) return;
          resolved = true;
          clearTimeout(timeout);
          if (successTimer) clearTimeout(successTimer);
          child.kill('SIGINT');
          resolve({ success: true, message: 'Content script injected - SMOKE_OK received' });
        }
      }

      child.stdout.on('data', handleData);
      child.stderr.on('data', handleData);

      child.on('error', (error: Error) => {
        if (resolved) return;
        resolved = true;
        clearTimeout(timeout);
        if (successTimer) clearTimeout(successTimer);
        resolve({ success: false, message: `Failed to start web-ext: ${error.message}` });
      });

      child.on('exit', (code: number | null) => {
        if (resolved) return;
        clearTimeout(timeout);
        if (successTimer) clearTimeout(successTimer);
        resolved = true;
        resolve({
          success: false,
          message: `web-ext exited before smoke signal (code ${code}). Output:\n${output}`,
        });
      });
    });

    console.log('\nTest result:', result.message);
    expect(result.success, result.message).toBe(true);
  });
});
