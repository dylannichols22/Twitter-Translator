# Tweet Synchronization: First Principles Approach

## The Core Problem

The panel must show **exactly what the user sees on Twitter, translated**. Nothing more, nothing less.

If the panel shows tweets the user doesn't see, or misses tweets they do see, the app is broken.

## Why The Current Approach Is Overcomplicated

We've built layers upon layers of defensive mechanisms:
- 3 URL detection methods (history hooks + popstate + polling)
- Thread detection with 3 retries and 8-second timeouts
- Progressive loading with stability detection
- Multiple deduplication guards (in-memory sets + DOM checks)
- Operation locks
- AbortControllers everywhere
- Separate "Load More" with server-side scrolling

Each layer was added to fix a bug. But now we can't reason about the system. The complexity itself causes bugs.

## First Principle: The DOM Is The Source of Truth

**The only thing that matters is what's in Twitter's DOM right now.**

Not what was there 200ms ago. Not what we think should be there. Not what the URL says should be there.

The user sees what's in the DOM. The panel should match it.

## The Simplest Possible Architecture

### One Observable: The Tweet List

```
Twitter DOM → [Tweet Extractor] → Current Tweet List → [Translator] → Panel
```

There is exactly one observable state: **the list of tweets currently visible in Twitter's DOM**.

When this list changes, the panel updates.

### How To Detect Changes

**Option A: MutationObserver (Reactive)**
- Watch `document.body` for changes
- When mutations occur, re-scrape tweets
- Compare with previous list, handle additions/removals

**Option B: Polling (Simple)**
- Every N ms, scrape tweets from DOM
- Compare with previous list
- If different, update panel

**Option C: Hybrid (Recommended)**
- MutationObserver triggers a debounced re-scrape
- Polling as fallback safety net (every 2-3 seconds)

### The Core Loop

```typescript
class TweetSynchronizer {
  private currentTweets: Map<string, Tweet> = new Map();
  private panel: Panel;

  start() {
    // Watch for DOM changes
    const observer = new MutationObserver(() => {
      this.debouncedSync();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    // Initial sync
    this.sync();
  }

  private sync() {
    const visibleTweets = this.scrapeTweets();
    const visibleIds = new Set(visibleTweets.map(t => t.id));

    // Find what changed
    const added = visibleTweets.filter(t => !this.currentTweets.has(t.id));
    const removed = [...this.currentTweets.keys()].filter(id => !visibleIds.has(id));

    // Update state
    for (const id of removed) {
      this.currentTweets.delete(id);
      this.panel.removeTweet(id);  // Remove from panel too!
    }

    for (const tweet of added) {
      this.currentTweets.set(tweet.id, tweet);
      this.translateAndRender(tweet);
    }
  }
}
```

### Key Insight: Tweets Can Disappear

Twitter virtualizes its feed. When you scroll, tweets that are off-screen get **removed from the DOM**.

This is critical. Our current implementation never removes tweets from the panel. That's wrong.

If a tweet is no longer in Twitter's DOM, it should not be in our panel.

**Exception**: We may want to keep the main post visible even when scrolled away. But that's a deliberate choice, not an accident.

## Handling Navigation

When the user navigates to a different thread:
1. Twitter's DOM updates (asynchronously)
2. Our observer fires
3. We re-scrape
4. Old tweets are gone, new tweets appear
5. Panel removes old, adds new

We don't need URL watching at all. The DOM tells us everything.

**But wait**, what if we want to show a loading state while Twitter fetches the new thread?

Simple: detect that tweet count went to zero (or drastically changed). Show loading. Wait for new tweets to appear.

```typescript
private sync() {
  const visibleTweets = this.scrapeTweets();

  if (visibleTweets.length === 0 && this.currentTweets.size > 0) {
    // Tweets disappeared - probably navigating
    this.panel.showLoading();
    return; // Wait for next mutation
  }

  // ... normal sync logic
}
```

## Handling Twitter's Async Loading

Twitter loads replies lazily as you scroll. Our current approach:
- "Progressive loading" polls every 800ms
- "Load More" button scrolls and waits

First principles approach:
- MutationObserver already catches lazy-loaded tweets
- They just appear in DOM → observer fires → we sync → they get translated
- No special handling needed

The "Load More" feature is actually about **forcing Twitter to load more**, not about us doing anything special. We could:
1. Scroll the page programmatically
2. Let MutationObserver catch new tweets naturally

## The Translation Problem

Translation is async. What if:
- We request translation for tweet A
- User scrolls, tweet A leaves DOM
- Translation arrives
- Should we render it?

**Answer: No.**

If the tweet isn't in the DOM when translation arrives, don't render it. The user can't see it anyway.

```typescript
private async translateAndRender(tweet: Tweet) {
  const translation = await this.translate(tweet);

  // Check if tweet is still visible
  if (!this.currentTweets.has(tweet.id)) {
    return; // Gone, don't render
  }

  this.panel.renderTweet(tweet, translation);
}
```

## Caching Translations

If the user scrolls away and back, we don't want to re-translate.

```typescript
private translationCache: Map<string, Translation> = new Map();

private async translateAndRender(tweet: Tweet) {
  let translation = this.translationCache.get(tweet.id);

  if (!translation) {
    translation = await this.translate(tweet);
    this.translationCache.set(tweet.id, translation);
  }

  if (this.currentTweets.has(tweet.id)) {
    this.panel.renderTweet(tweet, translation);
  }
}
```

## Handling Race Conditions

The current code has AbortControllers, operation locks, URL verification... all to prevent race conditions.

First principles: **there is only one operation**, and it's idempotent.

- `sync()` is the only operation
- It reads current state and reconciles
- Calling it twice produces the same result
- No concurrent operations to race

If we're mid-translation and DOM changes, we just sync again. Translations that finish for tweets no longer visible get discarded. New tweets get translated.

## What About Panel Open/Close?

When panel opens:
- Start observing
- Do initial sync

When panel closes:
- Stop observing
- Clear state

No URL watching needed. No thread detection. Just observe or don't.

## Implementation Summary

```typescript
class SimpleTweetSync {
  private observer: MutationObserver | null = null;
  private currentTweets: Map<string, Tweet> = new Map();
  private translationCache: Map<string, Translation> = new Map();
  private pendingTranslations: Set<string> = new Set();
  private panel: Panel;
  private syncDebounceTimer: number | null = null;

  start() {
    this.observer = new MutationObserver(() => this.scheduleSync());
    this.observer.observe(document.body, { childList: true, subtree: true });
    this.sync();
  }

  stop() {
    this.observer?.disconnect();
    this.observer = null;
    this.currentTweets.clear();
    this.panel.clear();
  }

  private scheduleSync() {
    if (this.syncDebounceTimer) clearTimeout(this.syncDebounceTimer);
    this.syncDebounceTimer = setTimeout(() => this.sync(), 100);
  }

  private sync() {
    const visible = this.scrapeTweets();
    const visibleIds = new Set(visible.map(t => t.id));

    // Handle empty state (navigation in progress)
    if (visible.length === 0 && this.currentTweets.size > 0) {
      this.panel.showLoading();
      return;
    }

    // Remove tweets no longer visible
    for (const id of this.currentTweets.keys()) {
      if (!visibleIds.has(id)) {
        this.currentTweets.delete(id);
        this.panel.removeTweet(id);
      }
    }

    // Add new tweets
    for (const tweet of visible) {
      if (!this.currentTweets.has(tweet.id)) {
        this.currentTweets.set(tweet.id, tweet);
        this.translateAndRender(tweet);
      }
    }

    // Update order if needed
    this.panel.reorderTweets(visible.map(t => t.id));
  }

  private async translateAndRender(tweet: Tweet) {
    if (this.pendingTranslations.has(tweet.id)) return;

    let translation = this.translationCache.get(tweet.id);

    if (!translation) {
      this.pendingTranslations.add(tweet.id);
      try {
        translation = await this.translate(tweet);
        this.translationCache.set(tweet.id, translation);
      } finally {
        this.pendingTranslations.delete(tweet.id);
      }
    }

    // Only render if still visible
    if (this.currentTweets.has(tweet.id)) {
      this.panel.renderTweet(tweet, translation);
    }
  }

  private scrapeTweets(): Tweet[] {
    return Array.from(document.querySelectorAll('article[data-testid="tweet"]'))
      .filter(el => !el.closest('article[data-testid="tweet"] article[data-testid="tweet"]'))
      .map(el => this.extractTweet(el))
      .filter(Boolean) as Tweet[];
  }

  private extractTweet(article: Element): Tweet | null {
    const textEl = article.querySelector('[data-testid="tweetText"]');
    const timeEl = article.querySelector('time');
    const linkEl = article.querySelector('a[href*="/status/"]');

    const text = textEl?.textContent || '';
    const id = linkEl?.getAttribute('href')?.match(/\/status\/(\d+)/)?.[1];

    if (!id) return null;

    return {
      id,
      text,
      author: article.querySelector('[data-testid="User-Name"]')?.textContent || '',
      timestamp: timeEl?.getAttribute('datetime') || '',
      url: linkEl?.getAttribute('href') || ''
    };
  }
}
```

## What This Eliminates

1. **URL watching** - Don't need it. DOM tells us everything.
2. **Thread detection with retries** - Don't need it. Just wait for tweets to appear.
3. **Progressive loading intervals** - Don't need it. MutationObserver catches everything.
4. **Operation locks** - Don't need them. Sync is idempotent.
5. **AbortControllers for cancellation** - Simplified. Just check if tweet still visible.
6. **Source URL verification** - Don't need it. DOM is source of truth.
7. **Multiple deduplication guards** - One check: is tweet in currentTweets?

## Edge Cases To Consider

### 1. Twitter's Virtual Scrolling

Twitter removes tweets from DOM when scrolled far away. This is actually fine:
- Our panel mirrors the DOM
- If tweet leaves DOM, it leaves panel
- When user scrolls back, tweet reappears
- We already have translation cached

**Decision**: Do we want to keep translated tweets even when Twitter removes them from DOM?

If yes: panel becomes a "history" of what user has seen, not a mirror.
If no: panel stays perfectly in sync but loses content on scroll.

Recommendation: Keep main post always visible (it's what user came to read), but let replies sync with DOM.

### 2. Quoted Tweets

Tweets can contain quoted tweets (nested). We filter these out with the `closest()` check. Keep doing this.

### 3. Rate Limiting

If DOM changes rapidly (user scrolling fast), we debounce to avoid constant re-syncing.

### 4. Translation Batching

For efficiency, we could batch new tweets and translate together:

```typescript
private pendingBatch: Tweet[] = [];
private batchTimer: number | null = null;

private queueForTranslation(tweet: Tweet) {
  this.pendingBatch.push(tweet);
  if (!this.batchTimer) {
    this.batchTimer = setTimeout(() => this.flushBatch(), 200);
  }
}

private async flushBatch() {
  const batch = this.pendingBatch;
  this.pendingBatch = [];
  this.batchTimer = null;

  const translations = await this.translateBatch(batch);
  // ...
}
```

## Migration Path

1. Create `SimpleTweetSync` class alongside existing code
2. Test it in isolation on a branch
3. Remove URL watcher, progressive loading, thread detection one by one
4. Simplify panel controller to just receive add/remove/reorder commands
5. Remove operation locks, simplify AbortController usage
6. Delete dead code

## The Test

After implementing, these should all work:

1. **Open panel on thread** → Shows translated tweets visible on screen
2. **Scroll down** → New tweets appear translated in panel, old ones may disappear
3. **Navigate to different thread** → Panel clears, shows new thread
4. **Fast navigation** → No mixed content from different threads
5. **Scroll back up** → Tweets reappear with cached translations (no API call)
6. **Close and reopen panel** → Fresh sync, but uses cached translations

If any of these break, we know exactly where to look: the sync loop.

## Conclusion

The simplest solution:
1. **One source of truth**: Twitter's DOM
2. **One operation**: Sync (scrape → diff → update panel)
3. **One trigger**: MutationObserver (with debounce)
4. **One cache**: Translation cache

Everything else is derived from these four things.
