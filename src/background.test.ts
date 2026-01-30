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
  onUpdated: {
    addListener: vi.fn(),
    removeListener: vi.fn(),
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
};

// Set up browser mock - but note background.ts checks if browser is defined
// before auto-initializing, so we don't need to worry about side effects
(globalThis as unknown as { browser: unknown }).browser = {
  contextMenus: mockContextMenus,
  tabs: mockTabs,
  runtime: mockRuntime,
  storage: mockStorage,
};

import {
  CONTEXT_MENU_ID,
  createContextMenu,
  handleContextMenuClick,
  handleMessage,
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
    });
  });

  describe('handleContextMenuClick', () => {
    it('sends scrape message to active tab', async () => {
      mockTabs.query.mockResolvedValue([{ id: 123 }]);
      mockTabs.sendMessage.mockResolvedValue({
        success: true,
        tweets: [{ id: '1', text: '你好' }],
      });

      await handleContextMenuClick(
        { menuItemId: CONTEXT_MENU_ID },
        { id: 123, url: 'https://twitter.com/user/status/1' }
      );

      expect(mockTabs.sendMessage).toHaveBeenCalledWith(123, {
        type: MESSAGE_TYPES.SCRAPE_PAGE,
      });
    });

    it('opens translation page with scraped data', async () => {
      mockTabs.query.mockResolvedValue([{ id: 123 }]);
      mockTabs.sendMessage.mockResolvedValue({
        success: true,
        tweets: [{ id: '1', text: '你好' }],
        url: 'https://twitter.com/user/status/1',
      });

      await handleContextMenuClick(
        { menuItemId: CONTEXT_MENU_ID },
        { id: 123, url: 'https://twitter.com/user/status/1' }
      );

      expect(mockTabs.create).toHaveBeenCalledWith(
        expect.objectContaining({
          url: expect.stringContaining('translate.html'),
        })
      );
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
          scrollMaxRounds: 6,
          scrollIdleRounds: 2,
        },
      };

      const result = await handleMessage(message, {}, vi.fn());

      expect(mockTabs.sendMessage).toHaveBeenCalledWith(123, {
        type: MESSAGE_TYPES.SCRAPE_PAGE,
        data: {
          commentLimit: 5,
          excludeIds: ['1'],
          scrollToLoadMore: true,
          scrollMaxRounds: 6,
          scrollIdleRounds: 2,
        },
      });
      expect(result).toEqual({ success: true, tweets: [] });
    });

    it('forwards SCRAPE_CHILD_REPLIES to content script', async () => {
      mockTabs.query.mockResolvedValue([{ id: 123, url: 'https://twitter.com/user/status/1' }]);
      mockTabs.sendMessage.mockResolvedValue({ success: true, tweets: [] });

      const message: Message = {
        type: MESSAGE_TYPES.SCRAPE_CHILD_REPLIES,
        data: {
          url: 'https://twitter.com/user/status/1',
          excludeIds: ['1'],
        },
      };

      const result = await handleMessage(message, {}, vi.fn());

      expect(mockTabs.sendMessage).toHaveBeenCalledWith(123, {
        type: MESSAGE_TYPES.SCRAPE_PAGE,
        data: {
          commentLimit: undefined,
          excludeIds: ['1'],
        },
      });
      expect(result).toEqual({ success: true, tweets: [] });
    });

    it('opens a thread tab when SCRAPE_CHILD_REPLIES provides threadUrl', async () => {
      mockTabs.create.mockResolvedValue({ id: 456 });
      mockTabs.sendMessage.mockResolvedValue({ success: true, tweets: [] });
      mockTabs.onUpdated.addListener.mockImplementation((listener: (tabId: number, info: { status?: string }) => void) => {
        listener(456, { status: 'complete' });
      });

      const message: Message = {
        type: MESSAGE_TYPES.SCRAPE_CHILD_REPLIES,
        data: {
          url: 'https://twitter.com/user/status/1',
          threadUrl: 'https://twitter.com/user/status/42',
          excludeIds: ['1'],
        },
      };

      const result = await handleMessage(message, {}, vi.fn());

      expect(mockTabs.create).toHaveBeenCalledWith({ url: 'https://twitter.com/user/status/42', active: false });
      expect(mockTabs.sendMessage).toHaveBeenCalledWith(456, {
        type: MESSAGE_TYPES.SCRAPE_PAGE,
        data: {
          commentLimit: undefined,
          excludeIds: ['1'],
          expandReplies: true,
        },
      });
      expect(mockTabs.remove).toHaveBeenCalledWith(456);
      expect(result).toEqual({ success: true, tweets: [] });
    });

    it('navigates and scrapes in the source tab', async () => {
      mockTabs.update.mockResolvedValue({ id: 789 });
      mockTabs.sendMessage.mockResolvedValue({ success: true, tweets: [] });
      mockTabs.onUpdated.addListener.mockImplementation((listener: (tabId: number, info: { status?: string }) => void) => {
        listener(789, { status: 'complete' });
      });

      const message: Message = {
        type: MESSAGE_TYPES.NAVIGATE_AND_SCRAPE,
        data: {
          tabId: 789,
          url: 'https://twitter.com/user/status/2',
          commentLimit: 5,
        },
      };

      const result = await handleMessage(message, {}, vi.fn());

      expect(mockTabs.update).toHaveBeenCalledWith(789, { url: 'https://twitter.com/user/status/2' });
      expect(mockTabs.sendMessage).toHaveBeenCalledWith(789, {
        type: MESSAGE_TYPES.SCRAPE_PAGE,
        data: {
          commentLimit: 5,
          excludeIds: undefined,
          expandReplies: true,
        },
      });
      expect(result).toEqual({ success: true, tweets: [] });
    });

    it('navigates source tab without scraping', async () => {
      mockTabs.update.mockResolvedValue({ id: 321 });

      const message: Message = {
        type: MESSAGE_TYPES.NAVIGATE_TAB,
        data: {
          tabId: 321,
          url: 'https://twitter.com/user/status/3',
        },
      };

      const result = await handleMessage(message, {}, vi.fn());

      expect(mockTabs.update).toHaveBeenCalledWith(321, { url: 'https://twitter.com/user/status/3' });
      expect(result).toEqual({ success: true });
    });
  });

  describe('MESSAGE_TYPES', () => {
    it('exports all required message types', () => {
      expect(MESSAGE_TYPES.SCRAPE_PAGE).toBeDefined();
      expect(MESSAGE_TYPES.OPEN_TRANSLATE_PAGE).toBeDefined();
      expect(MESSAGE_TYPES.GET_SETTINGS).toBeDefined();
      expect(MESSAGE_TYPES.SAVE_SETTINGS).toBeDefined();
      expect(MESSAGE_TYPES.SCRAPE_MORE).toBeDefined();
      expect(MESSAGE_TYPES.SCRAPE_CHILD_REPLIES).toBeDefined();
      expect(MESSAGE_TYPES.NAVIGATE_AND_SCRAPE).toBeDefined();
      expect(MESSAGE_TYPES.NAVIGATE_TAB).toBeDefined();
    });
  });
});
