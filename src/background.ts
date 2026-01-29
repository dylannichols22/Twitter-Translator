import { StorageManager } from './storage';
import { CostTracker, calculateCost } from './cost';
import { translationCache } from './cache';
import { MESSAGE_TYPES, Message } from './messages';

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

export function createContextMenu(): void {
  browser.contextMenus.create({
    id: CONTEXT_MENU_ID,
    title: 'Translate Chinese Content',
    contexts: ['page'],
    documentUrlPatterns: ['*://twitter.com/*', '*://x.com/*'],
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
    // Send message to content script to scrape the page
    const response = await browser.tabs.sendMessage(tab.id, {
      type: MESSAGE_TYPES.SCRAPE_PAGE,
    });

    if (response?.success && response.tweets) {
      // Open translation page with data
      const params = new URLSearchParams({
        data: JSON.stringify({
          tweets: response.tweets,
          url: tab.url || response.url,
        }),
      });

      await browser.tabs.create({
        url: browser.runtime.getURL(`translate.html?${params.toString()}`),
      });
    }
  } catch (error) {
    console.error('Failed to scrape page:', error);
  }
}

export async function handleMessage(
  message: Message,
  _sender: unknown,
  _sendResponse: (response?: unknown) => void
): Promise<unknown> {
  const normalizeThreadUrl = (url: string): string => {
    try {
      const parsed = new URL(url);
      const normalizedHost = parsed.hostname.replace('x.com', 'twitter.com');
      return `${normalizedHost}${parsed.pathname}`;
    } catch {
      return url;
    }
  };

  const findThreadTab = async (url: string): Promise<{ id?: number; url?: string } | undefined> => {
    const tabs = await browser.tabs.query({ url: ['*://twitter.com/*', '*://x.com/*'] });
    const target = normalizeThreadUrl(url);
    return tabs.find((tab) => tab.url && normalizeThreadUrl(tab.url) === target);
  };

  switch (message.type) {
    case MESSAGE_TYPES.OPEN_TRANSLATE_PAGE: {
      const data = message.data as { tweets: unknown[]; url: string };
      const params = new URLSearchParams({
        data: JSON.stringify(data),
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
      const settings = message.data as { apiKey: string; commentLimit: number };
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

    case MESSAGE_TYPES.RECORD_USAGE: {
      const usage = message.data as {
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
      const url = message.data as string;
      const cached = translationCache.get(url);
      return cached || null;
    }

    case MESSAGE_TYPES.CACHE_TRANSLATION: {
      const cacheData = message.data as { url: string; translation: unknown };
      translationCache.set(cacheData.url, cacheData.translation as never);
      return { success: true };
    }

    case MESSAGE_TYPES.SCRAPE_MORE:
    case MESSAGE_TYPES.SCRAPE_CHILD_REPLIES: {
      const data = message.data as {
        url: string;
        commentLimit?: number;
        excludeIds?: string[];
        parentId?: string;
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
          parentId: data.parentId,
        },
      });
    }

    case MESSAGE_TYPES.SMOKE_PING: {
      // Log for smoke test - web-ext captures console output
      console.log('SMOKE_OK');
      return { success: true };
    }

    default:
      return undefined;
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

}

// Auto-initialize when loaded in browser context (not tests)
if (typeof browser !== 'undefined' && browser.runtime) {
  initializeExtension();
}
