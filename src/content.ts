import { scrapeTweets, Tweet } from './scraper';
import { MESSAGE_TYPES, Message } from './messages';

interface ScrapeResponse {
  success: boolean;
  tweets?: Tweet[];
  url?: string;
  error?: string;
}

function isTwitterUrl(url: string): boolean {
  return url.includes('twitter.com') || url.includes('x.com');
}

export async function handleMessage(message: Message): Promise<ScrapeResponse | undefined> {
  if (message.type !== MESSAGE_TYPES.SCRAPE_PAGE) {
    return undefined;
  }

  const currentUrl = window.location.href;

  if (!isTwitterUrl(currentUrl)) {
    return {
      success: false,
      error: 'This page is not a Twitter/X page',
    };
  }

  try {
    // Get comment limit from settings
    const settings = await browser.runtime.sendMessage({
      type: MESSAGE_TYPES.GET_SETTINGS,
    });

    const { tweets } = scrapeTweets({
      commentLimit: settings?.commentLimit,
    });

    return {
      success: true,
      tweets,
      url: currentUrl,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to scrape page',
    };
  }
}

export class ContentScriptHandler {
  constructor() {
    this.initialize();
  }

  private initialize(): void {
    browser.runtime.onMessage.addListener(
      (message: Message, _sender: unknown, sendResponse: (response: unknown) => void) => {
        // Handle async response
        handleMessage(message).then(sendResponse);
        return true; // Keep channel open for async response
      }
    );
  }

  async scrapePage(): Promise<ScrapeResponse> {
    const currentUrl = window.location.href;

    if (!isTwitterUrl(currentUrl)) {
      return {
        success: false,
        error: 'This page is not a Twitter/X page',
      };
    }

    try {
      const settings = await browser.runtime.sendMessage({
        type: MESSAGE_TYPES.GET_SETTINGS,
      });

      const { tweets } = scrapeTweets({
        commentLimit: settings?.commentLimit,
      });

      return {
        success: true,
        tweets,
        url: currentUrl,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to scrape page',
      };
    }
  }
}

// Initialize content script when loaded
if (typeof browser !== 'undefined' && browser.runtime) {
  new ContentScriptHandler();
  // Add DOM marker for e2e testing verification
  document.documentElement.dataset.twitterTranslatorLoaded = 'true';
  // Smoke test signal - notify background script which has chrome privileges for dump()
  browser.runtime.sendMessage({ type: MESSAGE_TYPES.SMOKE_PING }).catch(() => {
    // Ignore errors - this is just for smoke testing
  });
}
