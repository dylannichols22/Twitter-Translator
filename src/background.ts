import { StorageManager } from './storage';
import { CostTracker, calculateCost } from './cost';
import { translationCache } from './cache';
import { isSupportedPlatformUrl, normalizeUrl } from './platforms';
import { MESSAGE_TYPES, Message } from './messages';
import { savedItemsManager } from './saved';
import type { SavedItem, SavedItemType } from './saved';
import { buildAnkiExport } from './anki/export';

export const CONTEXT_MENU_ID = 'translate-chinese-content';

export { MESSAGE_TYPES };
export type { Message };

const storage = new StorageManager();
let costTracker: CostTracker;

// Initialize cost tracker from storage
async function initCostTracker(): Promise<void> {
  const data = await storage.getCostData();
  costTracker = CostTracker.deserialize(data);
}

const waitForTabComplete = async (tabId: number, timeoutMs = 10000): Promise<void> => {
  await new Promise<void>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      browser.tabs.onUpdated.removeListener(listener);
      reject(new Error('Timed out waiting for tab to complete'));
    }, timeoutMs);

    const listener = (updatedTabId: number, info: { status?: string }) => {
      if (updatedTabId === tabId && info.status === 'complete') {
        clearTimeout(timeoutId);
        browser.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    };
    browser.tabs.onUpdated.addListener(listener);
  });
};

export function createContextMenu(): void {
  browser.contextMenus.create({
    id: CONTEXT_MENU_ID,
    title: 'Translate Chinese Content',
    contexts: ['page'],
    documentUrlPatterns: [
      '*://twitter.com/*',
      '*://x.com/*',
      '*://weibo.com/*',
      '*://*.weibo.com/*',
      '*://weibo.cn/*',
      '*://*.weibo.cn/*',
    ],
  });
}

export async function handleContextMenuClick(
  info: { menuItemId: string | number },
  tab?: { id?: number; url?: string }
): Promise<void> {
  if (info.menuItemId !== CONTEXT_MENU_ID) {
    return;
  }

  if (!tab?.id) {
    return;
  }

  try {
    const context = await browser.tabs.sendMessage(tab.id, {
      type: MESSAGE_TYPES.GET_CONTEXT_TWEET_URL,
    });

    const targetUrl =
      typeof (context as { url?: string })?.url === 'string'
        ? (context as { url: string }).url
        : tab.url || '';

    if (targetUrl && targetUrl !== tab.url) {
      await browser.tabs.update(tab.id, { url: targetUrl });
      await waitForTabComplete(tab.id);
    }

    await browser.tabs.sendMessage(tab.id, {
      type: MESSAGE_TYPES.TOGGLE_PANEL,
    });
  } catch (error) {
    console.error('Failed to toggle panel:', error);
  }
}

export async function handleMessage(
  message: unknown,
  _sender: unknown,
  _sendResponse: (response?: unknown) => void
): Promise<unknown> {
  if (!message || typeof message !== 'object' || !('type' in message)) {
    return undefined;
  }
  const typedMessage = message as Message;
  const normalizeThreadUrl = (url: string): string => {
    // Use platform-aware URL normalization
    return normalizeUrl(url);
  };

  const findThreadTab = async (url: string): Promise<{ id?: number; url?: string } | undefined> => {
    // Query all supported platforms
    const tabs = await browser.tabs.query({
      url: [
        '*://twitter.com/*',
        '*://x.com/*',
        '*://weibo.com/*',
        '*://*.weibo.com/*',
        '*://weibo.cn/*',
        '*://*.weibo.cn/*',
      ],
    });
    const target = normalizeThreadUrl(url);
    return tabs.find((tab) => tab.url && normalizeThreadUrl(tab.url) === target);
  };

  switch (typedMessage.type) {
    case MESSAGE_TYPES.OPEN_TRANSLATE_PAGE: {
      const data = typedMessage.data as { tweets: unknown[]; url: string; sourceTabId?: number };
      const payloadKey = `tt-payload-${globalThis.crypto?.randomUUID?.() ?? Date.now().toString(36)}`;
      const payloadStorage = browser.storage.session ?? browser.storage.local;
      await payloadStorage.set({ [payloadKey]: data });

      const params = new URLSearchParams({
        payloadKey,
      });

      await browser.tabs.create({
        url: browser.runtime.getURL(`translate.html?${params.toString()}`),
      });
      return { success: true };
    }

    case MESSAGE_TYPES.GET_SETTINGS: {
      return await storage.getSettings();
    }

    case MESSAGE_TYPES.SAVE_SETTINGS: {
      const settings = typedMessage.data as { apiKey: string; commentLimit: number };
      await storage.saveSettings(settings);
      return { success: true };
    }

    case MESSAGE_TYPES.GET_COST_STATS: {
      if (!costTracker) {
        await initCostTracker();
      }
      return {
        thisWeek: costTracker.getThisWeekTotal(),
        thisMonth: costTracker.getThisMonthTotal(),
        allTime: costTracker.getAllTimeTotal(),
      };
    }

    case MESSAGE_TYPES.GET_USAGE_STATS: {
      if (!costTracker) {
        await initCostTracker();
      }
      return {
        today: costTracker.getTodayUsage(),
      };
    }

    case MESSAGE_TYPES.RECORD_USAGE: {
      const usage = typedMessage.data as {
        inputTokens: number;
        outputTokens: number;
      };
      if (!costTracker) {
        await initCostTracker();
      }
      const cost = calculateCost(usage.inputTokens, usage.outputTokens);
      costTracker.recordUsage(usage.inputTokens, usage.outputTokens, cost);
      await storage.saveCostData(costTracker.serialize());
      return { success: true, cost };
    }

    case MESSAGE_TYPES.GET_CACHED_TRANSLATION: {
      const data = typedMessage.data as { url: string; commentLimit?: number };
      const cached = await translationCache.get(data.url, { commentLimit: data.commentLimit });
      return cached || null;
    }

    case MESSAGE_TYPES.CACHE_TRANSLATION: {
      const cacheData = typedMessage.data as { url: string; commentLimit?: number; translation: unknown };
      await translationCache.set(cacheData.url, cacheData.translation as never, {
        commentLimit: cacheData.commentLimit,
      });
      return { success: true };
    }

    case MESSAGE_TYPES.SCRAPE_MORE: {
      const data = typedMessage.data as {
        url: string;
        commentLimit?: number;
        excludeIds?: string[];
        scrollToLoadMore?: boolean;
        scrollMaxRounds?: number;
        scrollIdleRounds?: number;
      };

      const tab = await findThreadTab(data.url);
      if (!tab?.id) {
        return { success: false, error: 'Source tab not found' };
      }

      return await browser.tabs.sendMessage(tab.id, {
        type: MESSAGE_TYPES.SCRAPE_PAGE,
        data: {
          commentLimit: data.commentLimit,
          excludeIds: data.excludeIds,
          scrollToLoadMore: data.scrollToLoadMore,
          scrollMaxRounds: data.scrollMaxRounds,
          scrollIdleRounds: data.scrollIdleRounds,
        },
      });
    }

    case MESSAGE_TYPES.SMOKE_PING: {
      // Log for smoke test - web-ext captures console output
      console.log('SMOKE_OK');
      return { success: true };
    }

    case MESSAGE_TYPES.SAVE_ITEM: {
      const itemData = typedMessage.data as Omit<SavedItem, 'id' | 'savedAt'>;
      const savedItem = await savedItemsManager.save(itemData);
      return { success: true, item: savedItem };
    }

    case MESSAGE_TYPES.GET_SAVED_ITEMS: {
      const filterData = typedMessage.data as { type?: SavedItemType } | undefined;
      if (filterData?.type) {
        const items = await savedItemsManager.getByType(filterData.type);
        return { success: true, items };
      }
      const items = await savedItemsManager.getAll();
      return { success: true, items };
    }

    case MESSAGE_TYPES.DELETE_SAVED_ITEM: {
      const deleteData = typedMessage.data as { id: string };
      const deleted = await savedItemsManager.delete(deleteData.id);
      return { success: deleted };
    }

    case MESSAGE_TYPES.EXPORT_SAVED_ITEMS: {
      const exportData = typedMessage.data as { type?: SavedItemType; deckName?: string } | undefined;
      const items = exportData?.type ? await savedItemsManager.getByType(exportData.type) : await savedItemsManager.getAll();
      const result = buildAnkiExport(items, { deckName: exportData?.deckName });
      return { success: true, data: result.content, filename: result.filename, count: result.count };
    }

    case MESSAGE_TYPES.IS_ITEM_SAVED: {
      const checkData = typedMessage.data as { chinese: string; type: SavedItemType };
      const isDuplicate = await savedItemsManager.isDuplicate(checkData.chinese, checkData.type);
      return { success: true, isSaved: isDuplicate };
    }

    default:
      return undefined;
  }
}

// Check if URL is a Twitter/X page

// Update browser action popup based on current tab
async function updateBrowserActionForTab(tabId: number, _url: string): Promise<void> {
  // Always show popup; on Twitter it includes a Toggle Panel action.
  await browser.browserAction.setPopup({ tabId, popup: 'popup.html' });
}

// Handle browser action click to toggle panel
export async function handleBrowserActionClick(tab: { id?: number; url?: string }): Promise<void> {
  if (!tab?.id) {
    return;
  }

  // Only toggle panel on supported platform pages (other pages show popup instead)
  const url = tab.url || '';
  if (!isSupportedPlatformUrl(url)) {
    return;
  }

  try {
    await browser.tabs.sendMessage(tab.id, {
      type: MESSAGE_TYPES.TOGGLE_PANEL,
    });
  } catch (error) {
    console.error('Failed to toggle panel:', error);
  }
}

// Initialize extension - only runs when browser API is available
export function initializeExtension(): void {
  browser.runtime.onInstalled.addListener(() => {
    createContextMenu();
    initCostTracker();
  });

  browser.contextMenus.onClicked.addListener(handleContextMenuClick);
  browser.runtime.onMessage.addListener(handleMessage);

  // Browser action click toggles panel on Twitter pages
  browser.browserAction.onClicked.addListener(handleBrowserActionClick);

  // Update browser action popup based on active tab
  browser.tabs.onActivated.addListener(async (activeInfo) => {
    try {
      const tab = await browser.tabs.get(activeInfo.tabId);
      if (tab.url) {
        await updateBrowserActionForTab(activeInfo.tabId, tab.url);
      }
    } catch {
      // Tab might not exist or have permission
    }
  });

  // Update browser action when tab URL changes
  browser.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.url && tab.active) {
      await updateBrowserActionForTab(tabId, changeInfo.url);
    }
  });
}

// Auto-initialize when loaded in browser context (not tests)
if (typeof browser !== 'undefined' && browser.runtime) {
  initializeExtension();
}
