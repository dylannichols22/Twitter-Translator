import { describe, it, expect, vi, beforeEach } from 'vitest';

type RuntimeListener = (
  message: unknown,
  sender: unknown,
  sendResponse: (response: unknown) => void
) => unknown;

function createMockBrowser() {
  const runtimeListeners: RuntimeListener[] = [];
  const contextClickListeners: Array<(info: unknown, tab: unknown) => void> = [];

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
  };

  const storage = {
    local: {
      get: vi.fn(),
      set: vi.fn(),
      remove: vi.fn(),
    },
  };

  return {
    browser: {
      runtime,
      contextMenus,
      tabs,
      storage,
    },
    contextClickListeners,
  };
}

describe('Activation integration flows', () => {
  beforeEach(() => {
    vi.resetModules();
    document.body.innerHTML = '';
  });

  it('context menu flow opens translate tab with scraped data', async () => {
    const { browser } = createMockBrowser();
    (globalThis as unknown as { browser: unknown }).browser = browser;

    Object.defineProperty(window, 'location', {
      value: { href: 'https://twitter.com/user/status/1' },
      writable: true,
      configurable: true,
    });

    document.body.innerHTML = `
      <article data-testid="tweet">
        <div data-testid="User-Name">TestUser</div>
        <div data-testid="tweetText"><span>你好世界</span></div>
        <time datetime="2024-01-15T10:30:00.000Z">Jan 15</time>
        <a href="/user/status/123">link</a>
      </article>
    `;

    browser.storage.local.get.mockResolvedValue({
      settings: { apiKey: 'key', commentLimit: 10 },
    });

    const background = await import('../background');
    const content = await import('../content');

    browser.tabs.sendMessage.mockImplementation(async (_tabId: number, message: unknown) => {
      return await content.handleMessage(message as never);
    });

    await background.handleContextMenuClick(
      { menuItemId: background.CONTEXT_MENU_ID },
      { id: 1, url: 'https://twitter.com/user/status/1' }
    );

    expect(browser.tabs.create).toHaveBeenCalled();
    const created = browser.tabs.create.mock.calls[0][0];
    const createdUrl = new URL(created.url);
    const dataParam = createdUrl.searchParams.get('data');
    const data = JSON.parse(dataParam || '{}');

    expect(createdUrl.pathname).toContain('translate.html');
    expect(data.tweets).toHaveLength(1);
    expect(data.tweets[0].text).toBe('你好世界');
    expect(data.url).toBe('https://twitter.com/user/status/1');
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
    const dataParam = createdUrl.searchParams.get('data');
    const data = JSON.parse(dataParam || '{}');

    expect(createdUrl.pathname).toContain('translate.html');
    expect(data.tweets).toHaveLength(1);
    expect(data.tweets[0].text).toBe('你好');
    expect(data.url).toBe('https://twitter.com/user/status/1');
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

    browser.tabs.sendMessage.mockImplementation(async (_tabId: number, message: unknown) => {
      return await content.handleMessage(message as never);
    });

    await background.handleContextMenuClick(
      { menuItemId: background.CONTEXT_MENU_ID },
      { id: 1, url: 'https://twitter.com/user/status/1' }
    );

    const created = browser.tabs.create.mock.calls[0][0];
    const createdUrl = new URL(created.url);
    const dataParam = createdUrl.searchParams.get('data');
    const data = JSON.parse(dataParam || '{}');

    expect(data.tweets).toHaveLength(2);
    expect(data.tweets[0].text).toBe('Main');
    expect(data.tweets[1].text).toBe('Reply 1');
  });
});
