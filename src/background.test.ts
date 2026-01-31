import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock browser APIs
const mockContextMenus = {
  create: vi.fn(),
  onClicked: {
    addListener: vi.fn(),
  },
};

const mockTabs = {
  create: vi.fn(),
  query: vi.fn(),
  sendMessage: vi.fn(),
  remove: vi.fn(),
  update: vi.fn(),
  get: vi.fn(),
  onUpdated: {
    addListener: vi.fn(),
    removeListener: vi.fn(),
  },
  onActivated: {
    addListener: vi.fn(),
  },
};

const mockRuntime = {
  onMessage: {
    addListener: vi.fn(),
  },
  onInstalled: {
    addListener: vi.fn(),
  },
  getURL: vi.fn((path: string) => `moz-extension://test-id/${path}`),
};

const mockStorage = {
  local: {
    get: vi.fn().mockResolvedValue({}),
    set: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
  },
  session: {
    get: vi.fn().mockResolvedValue({}),
    set: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
  },
};

const mockBrowserAction = {
  onClicked: {
    addListener: vi.fn(),
  },
  setPopup: vi.fn(),
};

// Set up browser mock - but note background.ts checks if browser is defined
// before auto-initializing, so we don't need to worry about side effects
(globalThis as unknown as { browser: unknown }).browser = {
  contextMenus: mockContextMenus,
  tabs: mockTabs,
  runtime: mockRuntime,
  storage: mockStorage,
  browserAction: mockBrowserAction,
};

import {
  CONTEXT_MENU_ID,
  createContextMenu,
  handleContextMenuClick,
  handleMessage,
  handleBrowserActionClick,
  MESSAGE_TYPES,
  Message,
  initializeExtension,
} from './background';

describe('Background Script', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createContextMenu', () => {
    it('creates context menu with correct parameters', () => {
      createContextMenu();

      expect(mockContextMenus.create).toHaveBeenCalledWith({
        id: CONTEXT_MENU_ID,
        title: 'Translate Chinese Content',
        contexts: ['page'],
        documentUrlPatterns: ['*://twitter.com/*', '*://x.com/*'],
      });
    });
  });

  describe('initializeExtension', () => {
    it('registers event listeners', () => {
      initializeExtension();

      expect(mockRuntime.onInstalled.addListener).toHaveBeenCalled();
      expect(mockContextMenus.onClicked.addListener).toHaveBeenCalled();
      expect(mockRuntime.onMessage.addListener).toHaveBeenCalled();
      expect(mockBrowserAction.onClicked.addListener).toHaveBeenCalled();
    });
  });

  describe('handleContextMenuClick', () => {
    it('sends toggle panel message to active tab', async () => {
      mockTabs.onUpdated.addListener.mockImplementation((listener: (tabId: number, info: { status?: string }) => void) => {
        listener(123, { status: 'complete' });
      });
      mockTabs.sendMessage.mockResolvedValueOnce({ url: 'https://twitter.com/user/status/1' });
      mockTabs.sendMessage.mockResolvedValue({ success: true });

      await handleContextMenuClick(
        { menuItemId: CONTEXT_MENU_ID },
        { id: 123, url: 'https://twitter.com/user/status/1' }
      );

      expect(mockTabs.sendMessage).toHaveBeenCalledWith(123, {
        type: MESSAGE_TYPES.GET_CONTEXT_TWEET_URL,
      });
      expect(mockTabs.sendMessage).toHaveBeenCalledWith(123, {
        type: MESSAGE_TYPES.TOGGLE_PANEL,
      });
    });

    it('ignores clicks on wrong menu item', async () => {
      await handleContextMenuClick(
        { menuItemId: 'other-menu' },
        { id: 123, url: 'https://twitter.com/user/status/1' }
      );

      expect(mockTabs.sendMessage).not.toHaveBeenCalled();
    });

    it('handles missing tab gracefully', async () => {
      await expect(
        handleContextMenuClick({ menuItemId: CONTEXT_MENU_ID }, undefined)
      ).resolves.not.toThrow();
    });
  });

  describe('handleBrowserActionClick', () => {
    it('sends toggle panel message to Twitter tabs', async () => {
      mockTabs.sendMessage.mockResolvedValue({ success: true });

      await handleBrowserActionClick({
        id: 123,
        url: 'https://twitter.com/user/status/1',
      });

      expect(mockTabs.sendMessage).toHaveBeenCalledWith(123, {
        type: MESSAGE_TYPES.TOGGLE_PANEL,
      });
    });

    it('sends toggle panel message to X.com tabs', async () => {
      mockTabs.sendMessage.mockResolvedValue({ success: true });

      await handleBrowserActionClick({
        id: 123,
        url: 'https://x.com/user/status/1',
      });

      expect(mockTabs.sendMessage).toHaveBeenCalledWith(123, {
        type: MESSAGE_TYPES.TOGGLE_PANEL,
      });
    });

    it('does not send message to non-Twitter tabs', async () => {
      await handleBrowserActionClick({
        id: 123,
        url: 'https://example.com',
      });

      expect(mockTabs.sendMessage).not.toHaveBeenCalled();
    });

    it('handles missing tab id gracefully', async () => {
      await expect(
        handleBrowserActionClick({ url: 'https://twitter.com' })
      ).resolves.not.toThrow();
    });

    it('handles errors gracefully', async () => {
      mockTabs.sendMessage.mockRejectedValue(new Error('Content script not loaded'));

      await expect(
        handleBrowserActionClick({ id: 123, url: 'https://twitter.com' })
      ).resolves.not.toThrow();
    });
  });

  describe('handleMessage', () => {
    it('handles OPEN_TRANSLATE_PAGE message', async () => {
      const message: Message = {
        type: MESSAGE_TYPES.OPEN_TRANSLATE_PAGE,
        data: {
          tweets: [{ id: '1', text: '你好' }],
          url: 'https://twitter.com/user/status/1',
        },
      };

      await handleMessage(message, {}, vi.fn());

      expect(mockStorage.session.set).toHaveBeenCalled();
      expect(mockTabs.create).toHaveBeenCalledWith(
        expect.objectContaining({
          url: expect.stringContaining('translate.html'),
        })
      );
    });

    it('handles GET_SETTINGS message', async () => {
      mockStorage.local.get.mockResolvedValue({});

      const message: Message = {
        type: MESSAGE_TYPES.GET_SETTINGS,
      };

      const result = await handleMessage(message, {}, vi.fn());

      expect(result).toHaveProperty('apiKey');
      expect(result).toHaveProperty('commentLimit');
    });

    it('forwards SCRAPE_MORE to content script with options', async () => {
      mockTabs.query.mockResolvedValue([{ id: 123, url: 'https://twitter.com/user/status/1' }]);
      mockTabs.sendMessage.mockResolvedValue({ success: true, tweets: [] });

      const message: Message = {
        type: MESSAGE_TYPES.SCRAPE_MORE,
        data: {
          url: 'https://twitter.com/user/status/1',
          commentLimit: 5,
          excludeIds: ['1'],
          scrollToLoadMore: true,
          scrollMaxRounds: 20,
          scrollIdleRounds: 4,
        },
      };

      const result = await handleMessage(message, {}, vi.fn());

      expect(mockTabs.sendMessage).toHaveBeenCalledWith(123, {
        type: MESSAGE_TYPES.SCRAPE_PAGE,
        data: {
          commentLimit: 5,
          excludeIds: ['1'],
          scrollToLoadMore: true,
          scrollMaxRounds: 20,
          scrollIdleRounds: 4,
        },
      });
      expect(result).toEqual({ success: true, tweets: [] });
    });

    it('returns today usage stats from cost tracker', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-15T10:00:00Z'));

      const entries = [
        {
          inputTokens: 120,
          outputTokens: 240,
          cost: 0.01,
          timestamp: '2024-01-15T01:00:00Z',
        },
        {
          inputTokens: 30,
          outputTokens: 60,
          cost: 0.003,
          timestamp: '2024-01-14T23:00:00Z',
        },
      ];

      mockStorage.local.get.mockResolvedValue({
        costData: JSON.stringify(entries),
      });

      const message: Message = {
        type: MESSAGE_TYPES.GET_USAGE_STATS,
      };

      const result = await handleMessage(message, {}, vi.fn());

      expect(result).toEqual({
        today: {
          inputTokens: 120,
          outputTokens: 240,
          cost: 0.01,
          count: 1,
        },
      });

      vi.useRealTimers();
    });
  });

  describe('MESSAGE_TYPES', () => {
    it('exports all required message types', () => {
      expect(MESSAGE_TYPES.SCRAPE_PAGE).toBeDefined();
      expect(MESSAGE_TYPES.OPEN_TRANSLATE_PAGE).toBeDefined();
      expect(MESSAGE_TYPES.GET_SETTINGS).toBeDefined();
      expect(MESSAGE_TYPES.SAVE_SETTINGS).toBeDefined();
      expect(MESSAGE_TYPES.GET_USAGE_STATS).toBeDefined();
      expect(MESSAGE_TYPES.SCRAPE_MORE).toBeDefined();
    });
  });
});
