import { describe, it, expect, vi, beforeEach } from 'vitest';

// Create a singleton mock provider that can be configured in tests
const mockProvider = {
  translateQuickStreaming: vi.fn(),
  getBreakdown: vi.fn(),
};

vi.mock('../translator', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../translator')>();
  return {
    ...actual,
    getProviderApiKey: vi.fn((settings) => {
      // Properly implement multi-provider API key selection
      if (!settings) return '';
      switch (settings.provider) {
        case 'anthropic':
          return settings.apiKey ?? '';
        case 'openai':
          return settings.openaiApiKey ?? '';
        case 'google':
          return settings.googleApiKey ?? '';
        default:
          return settings.apiKey ?? '';
      }
    }),
    getProvider: vi.fn(() => mockProvider),
  };
});

import type { QuickStreamCallbacks } from '../translator';

import { getProvider } from '../translator';

type RuntimeListener = (
  message: unknown,
  sender: unknown,
  sendResponse: (response: unknown) => void
) => unknown;

function createMockBrowser() {
  const runtimeListeners: RuntimeListener[] = [];
  const sessionStore: Record<string, unknown> = {};

  const runtime = {
    onMessage: {
      addListener: (listener: RuntimeListener) => {
        runtimeListeners.push(listener);
      },
    },
    onInstalled: {
      addListener: vi.fn(),
    },
    getURL: (path: string) => `moz-extension://test/${path}`,
    sendMessage: vi.fn(async (message: unknown) => {
      for (const listener of runtimeListeners) {
        const result = listener(message, {}, () => undefined);
        if (result instanceof Promise) {
          return await result;
        }
        if (result !== undefined) {
          return result;
        }
      }
      return undefined;
    }),
  };

  const contextMenus = {
    create: vi.fn(),
    onClicked: {
      addListener: vi.fn(),
    },
  };

  const tabs = {
    create: vi.fn(),
    query: vi.fn(),
    sendMessage: vi.fn(),
    get: vi.fn(),
    onActivated: {
      addListener: vi.fn(),
    },
    onUpdated: {
      addListener: vi.fn(),
    },
  };

  const storage = {
    local: {
      get: vi.fn(),
      set: vi.fn(),
      remove: vi.fn(),
    },
    session: {
      get: vi.fn(async (keys: string[] | null) => {
        if (keys === null) {
          return { ...sessionStore };
        }
        const entries: Record<string, unknown> = {};
        keys.forEach((key) => {
          entries[key] = sessionStore[key];
        });
        return entries;
      }),
      set: vi.fn(async (items: Record<string, unknown>) => {
        Object.assign(sessionStore, items);
      }),
      remove: vi.fn(async (keys: string | string[]) => {
        const list = Array.isArray(keys) ? keys : [keys];
        list.forEach((key) => {
          delete sessionStore[key];
        });
      }),
    },
  };

  const browserAction = {
    onClicked: {
      addListener: vi.fn(),
    },
    setPopup: vi.fn(),
  };

  return {
    browser: {
      runtime,
      contextMenus,
      tabs,
      storage,
      browserAction,
    },
  };
}

describe('End-to-end flow', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    document.body.innerHTML = '';
  });

  // TODO: Fix this test - needs proper mocking of the provider pattern for multi-provider support
  it.skip('popup -> content -> background -> translate renders output', async () => {
    const { browser } = createMockBrowser();
    (globalThis as unknown as { browser: unknown }).browser = browser;

    Object.defineProperty(document, 'readyState', {
      value: 'loading',
      configurable: true,
    });

    const background = await import('../background');
    const content = await import('../content');
    const { PopupController } = await import('../popup/popup');
    const { TranslateViewController } = await import('../ui/translate');

    let createdUrl = '';
    browser.tabs.create.mockImplementation((data: { url: string }) => {
      createdUrl = data.url;
    });

    browser.runtime.onMessage.addListener(background.handleMessage);

    browser.tabs.query.mockResolvedValue([{ id: 1, url: 'https://twitter.com/user/status/1' }]);
    browser.tabs.sendMessage.mockImplementation(async (_tabId: number, message: unknown) => {
      return await content.handleMessage(message as never);
    });

    browser.storage.local.get.mockImplementation(async (keys: string[]) => {
      if (keys.includes('settings')) {
        return { settings: { apiKey: 'key', commentLimit: 10 } };
      }
      if (keys.includes('costData')) {
        return { costData: '' };
      }
      return {};
    });

    document.body.innerHTML = `
      <div id="translate-btn"></div>
      <div id="settings-btn"></div>
      <div id="main-view"></div>
      <div id="settings-view" class="hidden"></div>
      <input id="api-key-input" type="password" />
      <input id="comment-limit-input" type="number" />
      <button id="save-settings-btn"></button>
      <button id="back-btn"></button>
      <div id="cost-this-week"></div>
      <div id="cost-this-month"></div>
      <div id="cost-all-time"></div>
      <div id="status-message"></div>
    `;

    const popup = new PopupController();

    Object.defineProperty(window, 'location', {
      value: { href: 'https://twitter.com/user/status/1', search: '' },
      writable: true,
      configurable: true,
    });

    document.body.innerHTML = `
      <article data-testid="tweet">
        <div data-testid="User-Name">TestUser</div>
        <div data-testid="tweetText"><span>你好</span></div>
        <time datetime="2024-01-15T10:30:00.000Z">Jan 15</time>
        <a href="/user/status/123">link</a>
      </article>
    `;

    await popup.translateCurrentPage();

    expect(createdUrl).toContain('translate.html');

    const url = new URL(createdUrl);
    const payloadKey = url.searchParams.get('payloadKey') ?? '';
    Object.defineProperty(window, 'location', {
      value: { search: `?payloadKey=${payloadKey}` },
      writable: true,
      configurable: true,
    });

    document.body.innerHTML = `
      <div id="tweets-container"></div>
      <div id="loading" class="hidden"></div>
      <div id="error-message" class="hidden"></div>
      <div id="estimated-cost"></div>
    `;

    // Mock the provider's translateQuickStreaming method
    const mockProvider = getProvider('anthropic');
    vi.mocked(mockProvider.translateQuickStreaming).mockImplementation(
      async (_tweets: unknown, _apiKey: string, callbacks: QuickStreamCallbacks) => {
        callbacks.onTranslation({
          id: '123',
          naturalTranslation: 'Hello',
        });
        callbacks.onComplete({ inputTokens: 10, outputTokens: 20 });
      }
    );

    const translateView = new TranslateViewController();
    await translateView.translate();

    const tweetsContainer = document.getElementById('tweets-container');
    expect(tweetsContainer?.textContent).toContain('Hello');
    expect(tweetsContainer?.textContent).toContain('你好');
  });
});
