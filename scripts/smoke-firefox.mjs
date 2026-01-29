import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const startUrl = process.env.SMOKE_URL || 'https://x.com/';
const timeoutMs = Number(process.env.SMOKE_TIMEOUT_MS || 30000);

function fail(message) {
  console.error(`Smoke test failed: ${message}`);
  process.exit(1);
}

const profileDir = resolve('.smoke-profile');
const userJsPath = resolve(profileDir, 'user.js');
if (!existsSync(profileDir)) {
  mkdirSync(profileDir, { recursive: true });
}

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
    'user_pref("datareporting.policy.firstRunURL.date", "0");',
    'user_pref("toolkit.telemetry.enabled", false);',
    'user_pref("toolkit.telemetry.unified", false);',
    'user_pref("toolkit.telemetry.reportingpolicy.firstRun", false);',
    'user_pref("devtools.console.stdout.content", true);',
    'user_pref("devtools.console.stdout.chrome", true);',
    'user_pref("browser.dom.window.dump.enabled", true);',
  ].join('\n')
);

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

const child = spawn(webExtCmd, args, { shell: true });

let resolved = false;
let installDetected = false;
let successTimer = null;
const timeout = setTimeout(() => {
  if (resolved) return;
  resolved = true;
  child.kill('SIGINT');
  fail('Timed out waiting for extension install.');
}, timeoutMs);

function handleData(data) {
  const text = data.toString();
  process.stdout.write(text);
  if (
    !installDetected &&
    ((text.includes('Installed') && text.includes('temporary add-on')) ||
      text.includes('Installing as an extension proxy'))
  ) {
    installDetected = true;
    successTimer = setTimeout(() => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timeout);
      child.kill('SIGINT');
      console.log('Smoke test passed: extension installed.');
      process.exit(0);
    }, 5000);
  }
  if (text.includes('SMOKE_OK')) {
    if (resolved) return;
    resolved = true;
    clearTimeout(timeout);
    child.kill('SIGINT');
    console.log('Smoke test passed: content script injected.');
    process.exit(0);
  }
}

child.stdout.on('data', handleData);
child.stderr.on('data', handleData);
child.on('error', (error) => {
  if (resolved) return;
  clearTimeout(timeout);
  fail(`Failed to start web-ext: ${error.message}`);
});

child.on('exit', (code) => {
  if (resolved) return;
  clearTimeout(timeout);
  if (successTimer) {
    clearTimeout(successTimer);
  }
  fail(`web-ext exited before smoke signal (code ${code}).`);
});
