import { test as base, expect, type BrowserContext, type Page } from '@playwright/test';
import { spawn, execSync, type ChildProcess } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer, type Server, type IncomingMessage, type ServerResponse } from 'node:http';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const ROOT_DIR = resolve(__dirname, '../..');
export const PROFILE_DIR = resolve(ROOT_DIR, '.playwright-profile');
export const DIST_DIR = resolve(ROOT_DIR, 'dist');

export interface MockTweet {
  id: string;
  text: string;
  author: string;
  timestamp: string;
  isMainPost: boolean;
}

export interface MockTranslation {
  id: string;
  naturalTranslation: string;
  segments: Array<{ chinese: string; pinyin: string; gloss: string }>;
  notes: string[];
}

export interface ExtensionFixtures {
  extensionProcess: ChildProcess;
  mockApiServer: Server;
  mockTweets: MockTweet[];
  setMockTranslations: (translations: MockTranslation[]) => void;
  waitForExtensionReady: () => Promise<void>;
  mockTwitterHtml: string;
  createMockTwitterPage: (tweets: MockTweet[]) => string;
}

// Create Firefox profile with preferences to suppress dialogs
export function createFirefoxProfile(): void {
  if (existsSync(PROFILE_DIR)) {
    rmSync(PROFILE_DIR, { recursive: true, force: true });
  }
  mkdirSync(PROFILE_DIR, { recursive: true });

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
      // Allow extension to access local files for testing
      'user_pref("extensions.webextensions.remote", false);',
      // Disable extension signing for testing
      'user_pref("xpinstall.signatures.required", false);',
    ].join('\n')
  );
}

// Build the extension
export function buildExtension(): void {
  console.log('Building extension...');
  execSync('npm run build:firefox', { cwd: ROOT_DIR, stdio: 'inherit' });
}

// Start web-ext to launch Firefox with the extension
export function startExtensionProcess(startUrl: string): ChildProcess {
  const webExtCmd = process.platform === 'win32' ? 'node_modules\\.bin\\web-ext.cmd' : 'node_modules/.bin/web-ext';

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

  return spawn(webExtCmd, args, { cwd: ROOT_DIR, shell: true });
}

// Create a mock Twitter page HTML
export function createMockTwitterPage(tweets: MockTweet[]): string {
  const tweetHtml = tweets
    .map(
      (tweet) => `
    <article data-testid="tweet">
      <div data-testid="User-Name">${tweet.author}</div>
      <div data-testid="tweetText">${tweet.text}</div>
      <time datetime="${tweet.timestamp}">Jan 1, 2025</time>
      <a href="/user/status/${tweet.id}">Link</a>
    </article>
  `
    )
    .join('\n');

  return `
<!DOCTYPE html>
<html>
<head>
  <title>Mock Twitter Page</title>
</head>
<body>
  <div id="react-root">
    ${tweetHtml}
  </div>
</body>
</html>
`;
}

// Create a mock API server for Anthropic API
export function createMockApiServer(): {
  server: Server;
  setTranslations: (translations: MockTranslation[]) => void;
} {
  let mockTranslations: MockTranslation[] = [];

  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    // Handle CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key, anthropic-version');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.url === '/v1/messages' && req.method === 'POST') {
      let body = '';
      req.on('data', (chunk) => {
        body += chunk;
      });
      req.on('end', () => {
        // Mock Claude API response
        const response = {
          id: 'msg_mock',
          type: 'message',
          role: 'assistant',
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                translations: mockTranslations,
              }),
            },
          ],
          model: 'claude-sonnet-4-20250514',
          stop_reason: 'end_turn',
          usage: {
            input_tokens: 100,
            output_tokens: 200,
          },
        };

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(response));
      });
      return;
    }

    // Serve mock Twitter pages
    if (req.url?.startsWith('/twitter/')) {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(
        createMockTwitterPage([
          {
            id: '123456789',
            text: '这是一条测试推文',
            author: '@testuser',
            timestamp: '2025-01-15T12:00:00.000Z',
            isMainPost: true,
          },
          {
            id: '123456790',
            text: '这是第一条评论',
            author: '@commenter1',
            timestamp: '2025-01-15T12:05:00.000Z',
            isMainPost: false,
          },
        ])
      );
      return;
    }

    res.writeHead(404);
    res.end('Not Found');
  });

  return {
    server,
    setTranslations: (translations: MockTranslation[]) => {
      mockTranslations = translations;
    },
  };
}

// Default mock tweets for testing
export const defaultMockTweets: MockTweet[] = [
  {
    id: '123456789',
    text: '这是一条测试推文，包含中文内容。',
    author: '@testuser · Test User',
    timestamp: '2025-01-15T12:00:00.000Z',
    isMainPost: true,
  },
  {
    id: '123456790',
    text: '这是第一条评论内容。',
    author: '@commenter1 · Commenter One',
    timestamp: '2025-01-15T12:05:00.000Z',
    isMainPost: false,
  },
  {
    id: '123456791',
    text: '这是第二条评论内容。',
    author: '@commenter2 · Commenter Two',
    timestamp: '2025-01-15T12:10:00.000Z',
    isMainPost: false,
  },
];

// Default mock translations for testing
export const defaultMockTranslations: MockTranslation[] = [
  {
    id: '123456789',
    naturalTranslation: 'This is a test tweet with Chinese content.',
    segments: [
      { chinese: '这', pinyin: 'zhè', gloss: 'this' },
      { chinese: '是', pinyin: 'shì', gloss: 'is' },
      { chinese: '一条', pinyin: 'yī tiáo', gloss: 'one (classifier)' },
      { chinese: '测试', pinyin: 'cè shì', gloss: 'test' },
      { chinese: '推文', pinyin: 'tuī wén', gloss: 'tweet' },
    ],
    notes: ['测试 is commonly used for "test" in technical contexts'],
  },
  {
    id: '123456790',
    naturalTranslation: 'This is the first comment content.',
    segments: [
      { chinese: '这', pinyin: 'zhè', gloss: 'this' },
      { chinese: '是', pinyin: 'shì', gloss: 'is' },
      { chinese: '第一条', pinyin: 'dì yī tiáo', gloss: 'first' },
      { chinese: '评论', pinyin: 'píng lùn', gloss: 'comment' },
    ],
    notes: [],
  },
];

// Wait for a signal in the process output
export function waitForSignal(
  child: ChildProcess,
  signal: string,
  timeoutMs: number
): Promise<{ success: boolean; output: string }> {
  return new Promise((resolve) => {
    let output = '';
    let resolved = false;

    const timeout = setTimeout(() => {
      if (resolved) return;
      resolved = true;
      resolve({ success: false, output });
    }, timeoutMs);

    function handleData(data: Buffer) {
      const text = data.toString();
      output += text;

      if (text.includes(signal)) {
        if (resolved) return;
        resolved = true;
        clearTimeout(timeout);
        resolve({ success: true, output });
      }
    }

    child.stdout?.on('data', handleData);
    child.stderr?.on('data', handleData);

    child.on('error', () => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timeout);
      resolve({ success: false, output });
    });
  });
}

// Cleanup function
export function cleanupProfile(): void {
  if (existsSync(PROFILE_DIR)) {
    rmSync(PROFILE_DIR, { recursive: true, force: true });
  }
}

// Export test fixture
export const test = base.extend<ExtensionFixtures>({
  extensionProcess: [
    async ({}, use) => {
      const process = startExtensionProcess('about:blank');
      await use(process);
      process.kill('SIGINT');
    },
    { scope: 'test' },
  ],

  mockApiServer: [
    async ({}, use) => {
      const { server } = createMockApiServer();
      await new Promise<void>((resolve) => server.listen(3456, resolve));
      await use(server);
      server.close();
    },
    { scope: 'test' },
  ],

  mockTweets: defaultMockTweets,

  setMockTranslations: [
    async ({}, use) => {
      const { server, setTranslations } = createMockApiServer();
      await new Promise<void>((resolve) => server.listen(3457, resolve));
      await use(setTranslations);
      server.close();
    },
    { scope: 'test' },
  ],

  waitForExtensionReady: [
    async ({ extensionProcess }, use) => {
      const fn = async () => {
        const result = await waitForSignal(extensionProcess, 'Installed', 30000);
        if (!result.success) {
          throw new Error('Extension failed to install');
        }
      };
      await use(fn);
    },
    { scope: 'test' },
  ],

  mockTwitterHtml: createMockTwitterPage(defaultMockTweets),

  createMockTwitterPage: [
    async ({}, use) => {
      await use(createMockTwitterPage);
    },
    { scope: 'test' },
  ],
});

export { expect };
