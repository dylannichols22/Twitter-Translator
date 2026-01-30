import { scrapeTweets, Tweet, ScrapeOptions } from './scraper';
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
    const options = (message.data as ScrapeOptions | undefined) ?? {};

    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    const getTweetCount = () => document.querySelectorAll('article[data-testid="tweet"]').length;
    const getCellCount = () => document.querySelectorAll('[data-testid="cellInnerDiv"]').length;

    const waitForCondition = async (
      predicate: () => boolean,
      timeoutMs = 8000,
      intervalMs = 200
    ): Promise<void> => {
      const start = Date.now();
      while (Date.now() - start < timeoutMs) {
        if (predicate()) return;
        await sleep(intervalMs);
      }
    };

    const waitForStableCounts = async (
      timeoutMs = 8000,
      stableMs = 600,
      intervalMs = 200
    ): Promise<void> => {
      const start = Date.now();
      let lastTweetCount = -1;
      let lastCellCount = -1;
      let stableFor = 0;

      while (Date.now() - start < timeoutMs) {
        const tweetCount = getTweetCount();
        const cellCount = getCellCount();

        if (tweetCount > 0) {
          if (tweetCount === lastTweetCount && cellCount === lastCellCount) {
            stableFor += intervalMs;
          } else {
            stableFor = 0;
          }

          if (stableFor >= stableMs) {
            return;
          }

          lastTweetCount = tweetCount;
          lastCellCount = cellCount;
        }

        await sleep(intervalMs);
      }
    };

    const waitForDomStability = async (
      timeoutMs = 6000,
      stableMs = 400
    ): Promise<void> => {
      if (getTweetCount() === 0) {
        return;
      }

      const start = Date.now();
      let lastTweetCount = getTweetCount();
      let lastCellCount = getCellCount();
      let lastChange = Date.now();

      return await new Promise<void>((resolve) => {
        const observer = new MutationObserver(() => {
          const tweetCount = getTweetCount();
          const cellCount = getCellCount();
          if (tweetCount !== lastTweetCount || cellCount !== lastCellCount) {
            lastTweetCount = tweetCount;
            lastCellCount = cellCount;
            lastChange = Date.now();
          }
        });

        observer.observe(document.body, { childList: true, subtree: true });

        const tick = async () => {
          const now = Date.now();
          if (now - start >= timeoutMs) {
            observer.disconnect();
            resolve();
            return;
          }
          if (now - lastChange >= stableMs && lastTweetCount > 0) {
            observer.disconnect();
            resolve();
            return;
          }
          await sleep(100);
          void tick();
        };

        void tick();
      });
    };

    await waitForCondition(() => getTweetCount() > 0);

    if (options.expandReplies) {
      const clickShowReplies = (): number => {
        const buttons = Array.from(document.querySelectorAll('button,[role="button"]'));
        const showReplies = buttons.filter((button) => {
          const text = button.textContent?.toLowerCase() ?? '';
          return text.includes('show replies') || text.includes('show more replies');
        });
        showReplies.forEach((button) => {
          if (button instanceof HTMLElement) {
            button.click();
          }
        });
        return showReplies.length;
      };

      const initialTweetCount = getTweetCount();
      const initialCellCount = getCellCount();
      const clicked = clickShowReplies();

      if (clicked > 0) {
        await waitForCondition(
          () => getTweetCount() > initialTweetCount || getCellCount() > initialCellCount,
          3500,
          200
        );
      } else if (initialTweetCount <= 1) {
        await sleep(250);
      }

      await waitForDomStability(5000, 350);

      if (getTweetCount() <= 1) {
        await sleep(800);
        clickShowReplies();
        await waitForDomStability(6000, 400);
      }
    }

    if (options.scrollToLoadMore && options.commentLimit) {
      const targetTotal = options.commentLimit + 1;
      if (getTweetCount() < targetTotal) {
        const maxRounds = options.scrollMaxRounds ?? 6;
        const idleLimit = options.scrollIdleRounds ?? 2;
        let idleRounds = 0;
        let lastCount = getTweetCount();

        for (let round = 0; round < maxRounds && getTweetCount() < targetTotal; round += 1) {
          window.scrollTo(0, document.body.scrollHeight);
          await waitForDomStability(5000, 350);
          const currentCount = getTweetCount();

          if (currentCount <= lastCount) {
            idleRounds += 1;
            if (idleRounds >= idleLimit) {
              break;
            }
          } else {
            idleRounds = 0;
            lastCount = currentCount;
          }

          await sleep(150);
        }
      }
    }

    // Get comment limit from settings
    const settings = await browser.runtime.sendMessage({
      type: MESSAGE_TYPES.GET_SETTINGS,
    });

    const { tweets } = scrapeTweets({
      commentLimit: options.commentLimit ?? settings?.commentLimit,
      excludeIds: options.excludeIds,
      expandReplies: options.expandReplies,
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
