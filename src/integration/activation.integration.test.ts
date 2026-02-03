import { describe, it, expect, vi, beforeEach } from 'vitest';

type RuntimeListener = (
  message: unknown,
  sender: unknown,
  sendResponse: (response: unknown) => void
) => unknown;

function createMockBrowser() {
  const runtimeListeners: RuntimeListener[] = [];
  const contextClickListeners: Array<(info: unknown, tab: unknown) => void> = [];
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
    sendMessage: async (message: unknown) => {
      let response: unknown;
      for (const listener of runtimeListeners) {
        const result = listener(message, {}, (res) => {
          response = res;
        });

        if (result instanceof Promise) {
          return await result;
        }
        if (result === true && response !== undefined) {
          return response;
        }
        if (result !== undefined) {
          return result;
        }
      }
      return response;
    },
  };

  const contextMenus = {
    create: vi.fn(),
    onClicked: {
      addListener: (listener: (info: unknown, tab: unknown) => void) => {
        contextClickListeners.push(listener);
      },
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
    contextClickListeners,
  };
}

describe('Activation integration flows', () => {
  beforeEach(() => {
    vi.resetModules();
    document.body.innerHTML = '';
  });

  it('context menu flow toggles the panel on the active Twitter tab', async () => {
    const { browser } = createMockBrowser();
    (globalThis as unknown as { browser: unknown }).browser = browser;

    const background = await import('../background');

    browser.tabs.sendMessage.mockResolvedValueOnce({
      url: 'https://twitter.com/user/status/1',
    });
    browser.tabs.onUpdated.addListener.mockImplementation((listener: (tabId: number, info: { status?: string }) => void) => {
      listener(1, { status: 'complete' });
    });

    await background.handleContextMenuClick(
      { menuItemId: background.CONTEXT_MENU_ID },
      { id: 1, url: 'https://twitter.com/user/status/1' }
    );

    expect(browser.tabs.sendMessage).toHaveBeenCalledWith(1, {
      type: background.MESSAGE_TYPES.GET_CONTEXT_TWEET_URL,
    });
    expect(browser.tabs.sendMessage).toHaveBeenCalledWith(1, {
      type: background.MESSAGE_TYPES.TOGGLE_PANEL,
    });
    expect(browser.tabs.create).not.toHaveBeenCalled();
  });

  it('popup flow scrapes active tab and opens translate tab', async () => {
    const { browser } = createMockBrowser();
    (globalThis as unknown as { browser: unknown }).browser = browser;

    Object.defineProperty(window, 'location', {
      value: { href: 'https://twitter.com/user/status/1' },
      writable: true,
      configurable: true,
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
      <article data-testid="tweet">
        <div data-testid="User-Name">TestUser</div>
        <div data-testid="tweetText"><span>你好</span></div>
        <time datetime="2024-01-15T10:30:00.000Z">Jan 15</time>
        <a href="/user/status/123">link</a>
      </article>
    `;

    browser.storage.local.get.mockResolvedValue({
      settings: { apiKey: 'key', commentLimit: 10 },
    });

    const background = await import('../background');
    const content = await import('../content');
    const { PopupController } = await import('../popup/popup');

    browser.tabs.query.mockResolvedValue([{ id: 1, url: 'https://twitter.com/user/status/1' }]);
    browser.tabs.sendMessage.mockImplementation(async (_tabId: number, message: unknown) => {
      return await content.handleMessage(message as never);
    });

    const controller = new PopupController();
    await controller.translateCurrentPage();

    expect(browser.tabs.create).toHaveBeenCalled();
    const created = browser.tabs.create.mock.calls[0][0];
    const createdUrl = new URL(created.url);
    const payloadKey = createdUrl.searchParams.get('payloadKey') || '';
    const payload = await browser.storage.session.get([payloadKey]);
    const data = (payload as Record<string, { tweets: Array<{ text: string }>; url: string }>)[payloadKey];

    expect(createdUrl.pathname).toContain('translate.html');
    expect(data.tweets).toHaveLength(1);
    expect(data.tweets[0].text).toBe('你好');
    expect(data.url).toBe('https://twitter.com/user/status/1');
    expect(background.MESSAGE_TYPES.OPEN_TRANSLATE_PAGE).toBeDefined();
  });

  it('popup flow scrapes mobile tweet containers', async () => {
    const { browser } = createMockBrowser();
    (globalThis as unknown as { browser: unknown }).browser = browser;

    Object.defineProperty(window, 'location', {
      value: { href: 'https://twitter.com/user/status/2' },
      writable: true,
      configurable: true,
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
      <div data-testid="tweet">
        <div data-testid="User-Name">MobileUser</div>
        <div data-testid="tweetText"><span>Mobile 你好</span></div>
        <time datetime="2024-01-16T10:30:00.000Z">Jan 16</time>
        <a href="/user/status/222">link</a>
      </div>
    `;

    browser.storage.local.get.mockResolvedValue({
      settings: { apiKey: 'key', commentLimit: 10 },
    });

    const background = await import('../background');
    const content = await import('../content');
    const { PopupController } = await import('../popup/popup');

    browser.tabs.query.mockResolvedValue([{ id: 2, url: 'https://twitter.com/user/status/2' }]);
    browser.tabs.sendMessage.mockImplementation(async (_tabId: number, message: unknown) => {
      return await content.handleMessage(message as never);
    });

    const controller = new PopupController();
    await controller.translateCurrentPage();

    const created = browser.tabs.create.mock.calls[0][0];
    const createdUrl = new URL(created.url);
    const payloadKey = createdUrl.searchParams.get('payloadKey') || '';
    const payload = await browser.storage.session.get([payloadKey]);
    const data = (payload as Record<string, { tweets: Array<{ text: string }>; url: string }>)[payloadKey];

    expect(data.tweets).toHaveLength(1);
    expect(data.tweets[0].text).toContain('Mobile 你好');
    expect(data.url).toBe('https://twitter.com/user/status/2');
    expect(background.MESSAGE_TYPES.OPEN_TRANSLATE_PAGE).toBeDefined();
  });

  it('uses comment limit from settings when scraping', async () => {
    const { browser } = createMockBrowser();
    (globalThis as unknown as { browser: unknown }).browser = browser;

    Object.defineProperty(window, 'location', {
      value: { href: 'https://twitter.com/user/status/1' },
      writable: true,
      configurable: true,
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
      <article data-testid="tweet">
        <div data-testid="tweetText"><span>Main</span></div>
      </article>
      <article data-testid="tweet">
        <div data-testid="tweetText"><span>Reply 1</span></div>
      </article>
      <article data-testid="tweet">
        <div data-testid="tweetText"><span>Reply 2</span></div>
      </article>
    `;

    browser.storage.local.get.mockResolvedValue({
      settings: { apiKey: 'key', commentLimit: 1 },
    });

    const background = await import('../background');
    const content = await import('../content');
    const { PopupController } = await import('../popup/popup');

    browser.tabs.query.mockResolvedValue([{ id: 1, url: 'https://twitter.com/user/status/1' }]);
    browser.tabs.sendMessage.mockImplementation(async (_tabId: number, message: unknown) => {
      return await content.handleMessage(message as never);
    });

    const controller = new PopupController();
    await controller.translateCurrentPage();

    const created = browser.tabs.create.mock.calls[0][0];
    const createdUrl = new URL(created.url);
    const payloadKey = createdUrl.searchParams.get('payloadKey') || '';
    const payload = await browser.storage.session.get([payloadKey]);
    const data = (payload as Record<string, { tweets: Array<{ text: string }>; url: string }>)[payloadKey];

    expect(data.tweets).toHaveLength(2);
    expect(data.tweets[0].text).toBe('Main');
    expect(data.tweets[1].text).toBe('Reply 1');
    expect(background.MESSAGE_TYPES.OPEN_TRANSLATE_PAGE).toBeDefined();
  });
});
