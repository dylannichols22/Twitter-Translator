import { spawn, execSync, type ChildProcess } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync, rmSync, readdirSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const ROOT_DIR = resolve(__dirname, '../..');

// Force kill Firefox processes on Windows
export function killFirefoxProcesses(): void {
  if (process.platform === 'win32') {
    try {
      execSync('taskkill /F /IM firefox.exe /T 2>nul', { stdio: 'ignore' });
    } catch {
      // Ignore errors - Firefox may not be running
    }
  } else {
    try {
      execSync('pkill -9 firefox 2>/dev/null || true', { stdio: 'ignore' });
    } catch {
      // Ignore errors
    }
  }
}

// Kill a specific child process tree
function killProcessTree(child: ChildProcess): void {
  if (process.platform === 'win32') {
    try {
      if (child.pid) {
        execSync(`taskkill /F /T /PID ${child.pid} 2>nul`, { stdio: 'ignore' });
      }
    } catch {
      // Fallback to regular kill
      child.kill('SIGKILL');
    }
  } else {
    child.kill('SIGKILL');
  }
}

// Generate unique profile directory name
let profileCounter = 0;
export function getUniqueProfileDir(): string {
  const timestamp = Date.now();
  const counter = profileCounter++;
  return resolve(ROOT_DIR, `.smoke-profile-${timestamp}-${counter}`);
}

export function createFirefoxProfile(profileDir: string): void {
  // First try to clean up
  safeCleanupProfile(profileDir);

  mkdirSync(profileDir, { recursive: true });

  const userJsPath = join(profileDir, 'user.js');
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
}

export function safeCleanupProfile(profileDir: string): void {
  if (!existsSync(profileDir)) return;

  try {
    rmSync(profileDir, { recursive: true, force: true });
  } catch {
    // On Windows, Firefox may hold locks - try again with delay
    try {
      setTimeout(() => {
        if (existsSync(profileDir)) {
          rmSync(profileDir, { recursive: true, force: true });
        }
      }, 2000);
    } catch {
      // Ignore cleanup errors in CI
      console.log(`Warning: Could not clean up profile directory: ${profileDir}`);
    }
  }
}

export function cleanupAllProfiles(): void {
  try {
    const items = readdirSync(ROOT_DIR);
    for (const item of items) {
      if (item.startsWith('.smoke-profile-')) {
        const fullPath = join(ROOT_DIR, item);
        safeCleanupProfile(fullPath);
      }
    }
  } catch {
    // Ignore cleanup errors
  }
}

let extensionBuilt = false;

export function buildExtension(): void {
  if (extensionBuilt) return;
  console.log('Building extension...');
  execSync('npm run build:firefox', { cwd: ROOT_DIR, stdio: 'inherit' });
  extensionBuilt = true;
}

export function startExtensionProcess(profileDir: string, startUrl: string): ChildProcess {
  const webExtCmd =
    process.platform === 'win32' ? 'node_modules\\.bin\\web-ext.cmd' : 'node_modules/.bin/web-ext';

  const args = [
    'run',
    '--source-dir',
    'dist',
    '--firefox-profile',
    profileDir,
    '--start-url',
    startUrl,
    '--pre-install',
    '--no-input',
    '--verbose',
  ];

  return spawn(webExtCmd, args, { cwd: ROOT_DIR, shell: true });
}

export interface TestResult {
  success: boolean;
  message: string;
}

export function runExtensionTest(
  profileDir: string,
  startUrl: string,
  timeoutMs: number,
  successCondition: (text: string, output: string) => { matched: boolean; message?: string } | null
): Promise<TestResult> {
  const child = startExtensionProcess(profileDir, startUrl);

  return new Promise((resolve) => {
    let output = '';
    let resolved = false;
    let successTimer: NodeJS.Timeout | null = null;

    // Helper to cleanup and resolve
    function cleanup(result: TestResult) {
      if (resolved) return;
      resolved = true;
      clearTimeout(timeout);
      if (successTimer) clearTimeout(successTimer);

      // Force kill the process tree (Firefox doesn't respond to SIGINT well on Windows)
      killProcessTree(child);

      // Also kill any stray Firefox processes
      setTimeout(() => killFirefoxProcesses(), 500);

      resolve(result);
    }

    const timeout = setTimeout(() => {
      cleanup({ success: false, message: `Timed out. Output:\n${output.slice(-2000)}` });
    }, timeoutMs);

    function handleData(data: Buffer) {
      const text = data.toString();
      output += text;
      process.stdout.write(text);

      // Check custom success condition
      const conditionResult = successCondition(text, output);
      if (conditionResult?.matched) {
        cleanup({ success: true, message: conditionResult.message || 'Test passed' });
        return;
      }

      // Default: check for extension installation
      if (
        (text.includes('Installed') && text.includes('temporary add-on')) ||
        text.includes('Installing as an extension proxy')
      ) {
        // Extension installed - wait a bit for content script to load
        if (!successTimer) {
          successTimer = setTimeout(() => {
            cleanup({ success: true, message: 'Extension installed successfully' });
          }, 8000);
        }
      }

      // Check for SMOKE_OK
      if (text.includes('SMOKE_OK')) {
        cleanup({ success: true, message: 'Content script verified - SMOKE_OK received' });
      }
    }

    child.stdout?.on('data', handleData);
    child.stderr?.on('data', handleData);

    child.on('error', (error: Error) => {
      cleanup({ success: false, message: `Failed to start: ${error.message}` });
    });

    child.on('exit', (code: number | null) => {
      if (resolved) return;
      clearTimeout(timeout);
      if (successTimer) clearTimeout(successTimer);
      resolved = true;
      resolve({
        success: false,
        message: `web-ext exited (code ${code}). Output:\n${output.slice(-2000)}`,
      });
    });
  });
}
