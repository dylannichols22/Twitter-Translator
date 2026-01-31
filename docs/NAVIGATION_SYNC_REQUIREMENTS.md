# Navigation & Panel Synchronization Requirements

This document specifies requirements to fix the "janky" behavior in Twitter navigation detection and panel content synchronization.

## Problem Summary

The current implementation suffers from race conditions and stale state when users navigate between Twitter threads. Key issues:

1. **No operation cancellation** - In-flight scrape/translate operations continue after URL changes
2. **Out-of-order rendering** - Streaming translations render in API response order, not thread order
3. **Race conditions** - Multiple async operations compete without coordination
4. **Stale context** - "Load More" and breakdown toggles can act on wrong thread

---

## REQ-1: Operation Cancellation on Navigation

### Problem
When user navigates to a new thread while scraping/translating is in progress, the old operations continue and may render stale content over the new thread's content.

**Current flow:**
```
User on Thread A → scrapeAndTranslate() starts
User navigates to Thread B → handleUrlChange() clears state, starts new scrape
Thread A's translation arrives → renders to panel (WRONG!)
```

### Requirements

**REQ-1.1**: Implement `AbortController` in `PanelIntegration` to cancel in-flight operations.

```typescript
private abortController: AbortController | null = null;

private async scrapeAndTranslate(): Promise<void> {
  // Cancel any existing operation
  this.abortController?.abort();
  this.abortController = new AbortController();
  const signal = this.abortController.signal;

  try {
    // Pass signal to all async operations
    const tweets = await this.getThreadData(signal);
    if (signal.aborted) return;

    await translateQuickStreaming(tweets, apiKey, {
      signal,
      onTranslation: (t) => {
        if (!signal.aborted) this.renderTranslation(t);
      }
    });
  } finally {
    if (this.abortController?.signal === signal) {
      this.abortController = null;
    }
  }
}
```

**REQ-1.2**: `handleUrlChange()` must call `abort()` before clearing state.

**REQ-1.3**: `translateQuickStreaming()` must accept and respect an `AbortSignal`.

**REQ-1.4**: All `await` boundaries in the scrape/translate flow must check `signal.aborted` before continuing.

---

## REQ-2: Source URL Verification

### Problem
Operations started for one URL may complete after navigation to a different URL, rendering wrong content.

### Requirements

**REQ-2.1**: Store the source URL when starting any operation.

```typescript
private activeSourceUrl: string | null = null;
```

**REQ-2.2**: Before rendering any content, verify `window.location.href === activeSourceUrl`.

**REQ-2.3**: Before executing "Load More", verify the panel's source URL matches current URL.

```typescript
private async loadMoreReplies(): Promise<void> {
  if (window.location.href !== this.activeSourceUrl) {
    // User navigated away - refresh for current thread instead
    this.handleUrlChange(window.location.href);
    return;
  }
  // ... proceed with load more
}
```

**REQ-2.4**: Store thread ID alongside source URL for faster comparison.

---

## REQ-3: Ordered Tweet Rendering

### Problem
Streaming API returns translations in arbitrary order. Tweets render as they arrive, causing visual reordering (tweet #5 appears before tweet #1).

### Requirements

**REQ-3.1**: Buffer incoming translations until they can be rendered in order.

```typescript
class OrderedRenderBuffer {
  private pending = new Map<string, QuickTranslation>();
  private rendered = new Set<string>();
  private order: string[];  // Tweet IDs in display order

  constructor(tweets: Tweet[]) {
    this.order = tweets.map(t => t.id);
  }

  add(translation: QuickTranslation): Tweet[] {
    this.pending.set(translation.id, translation);
    return this.flush();
  }

  private flush(): Tweet[] {
    const toRender: Tweet[] = [];
    for (const id of this.order) {
      if (this.rendered.has(id)) continue;
      if (!this.pending.has(id)) break;  // Gap - stop here
      toRender.push({ id, translation: this.pending.get(id)! });
      this.rendered.add(id);
      this.pending.delete(id);
    }
    return toRender;
  }
}
```

**REQ-3.2**: Render tweets only when all preceding tweets are ready.

**REQ-3.3**: Show skeleton/placeholder cards for tweets awaiting translation.

```typescript
// On scrape completion, render all tweet skeletons immediately
tweets.forEach(tweet => this.controller.renderSkeleton(tweet));

// As translations arrive, replace skeletons with content
buffer.add(translation).forEach(item => {
  this.controller.replaceSkeleton(item.id, item.translation);
});
```

**REQ-3.4**: Alternative: Render immediately but maintain DOM order using `insertBefore()` based on tweet index.

---

## REQ-4: Idempotent Rendering

### Problem
Same tweet can be rendered multiple times if streaming sends duplicates or if race conditions occur.

### Requirements

**REQ-4.1**: Check `knownTweetIds` BEFORE rendering, not after.

```typescript
renderTweet(tweet: Tweet, translation: Translation): void {
  if (this.knownTweetIds.has(tweet.id)) {
    return;  // Already rendered - skip
  }
  this.knownTweetIds.add(tweet.id);  // Mark BEFORE DOM manipulation
  // ... render logic
}
```

**REQ-4.2**: Use tweet ID as DOM element ID for deduplication.

```typescript
const existingEl = document.getElementById(`tweet-${tweet.id}`);
if (existingEl) {
  // Update existing element instead of creating duplicate
  this.updateTweetCard(existingEl, translation);
  return;
}
```

**REQ-4.3**: Clear `knownTweetIds` when navigating to new thread (already done in `clearTweets()`).

---

## REQ-5: Operation Locking

### Problem
Multiple concurrent operations (scrape, load more, breakdown) can conflict:
- User clicks "Load More" while initial scrape still running
- Multiple breakdowns loading simultaneously

### Requirements

**REQ-5.1**: Implement operation lock to prevent concurrent scrape/loadMore.

```typescript
private operationLock: 'idle' | 'scraping' | 'loading-more' = 'idle';

private async scrapeAndTranslate(): Promise<void> {
  if (this.operationLock !== 'idle') {
    console.warn('Operation already in progress');
    return;
  }
  this.operationLock = 'scraping';
  try {
    // ... scrape logic
  } finally {
    this.operationLock = 'idle';
  }
}
```

**REQ-5.2**: Disable "Load More" button while any operation is in progress.

**REQ-5.3**: Allow navigation to interrupt operations (via AbortController from REQ-1).

**REQ-5.4**: Breakdown requests should be tracked per-tweet to prevent duplicate requests.

```typescript
private breakdownsInFlight = new Set<string>();

async toggleBreakdown(tweetId: string): Promise<void> {
  if (this.breakdownsInFlight.has(tweetId)) return;
  this.breakdownsInFlight.add(tweetId);
  try {
    // ... breakdown logic
  } finally {
    this.breakdownsInFlight.delete(tweetId);
  }
}
```

---

## REQ-6: Robust Thread Detection

### Problem
Current thread detection waits for DOM to show matching tweet ID, but Twitter's SPA transitions are unpredictable. Old thread's DOM elements may persist during navigation.

### Requirements

**REQ-6.1**: Use exponential backoff for thread readiness polling (not fixed 200ms).

```typescript
async function waitForThreadReady(
  targetId: string,
  signal: AbortSignal
): Promise<boolean> {
  const delays = [100, 200, 400, 800, 1600, 3200];  // Exponential
  for (const delay of delays) {
    if (signal.aborted) return false;

    const firstTweetId = getFirstTweetId();
    if (firstTweetId === targetId) return true;

    await sleep(delay);
  }
  return false;  // Timeout after ~6.3 seconds total
}
```

**REQ-6.2**: Add MutationObserver fallback to detect DOM changes.

```typescript
function observeThreadChange(targetId: string): Promise<boolean> {
  return new Promise(resolve => {
    const observer = new MutationObserver(() => {
      if (getFirstTweetId() === targetId) {
        observer.disconnect();
        resolve(true);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // Timeout fallback
    setTimeout(() => {
      observer.disconnect();
      resolve(getFirstTweetId() === targetId);
    }, 8000);
  });
}
```

**REQ-6.3**: If thread ID extraction fails (non-thread URL), show appropriate empty state immediately without waiting.

**REQ-6.4**: Validate that scraped tweets belong to the target thread before rendering.

---

## REQ-7: State Isolation

### Problem
Single `PanelIntegration` instance persists for lifetime of content script. State from previous threads can leak into new threads.

### Requirements

**REQ-7.1**: `resetState()` must clear ALL stateful fields:

```typescript
private resetState(): void {
  this.abortController?.abort();
  this.abortController = null;
  this.activeSourceUrl = null;
  this.activeThreadId = null;
  this.operationLock = 'idle';
  this.breakdownsInFlight.clear();
  this.controller.clearTweets();
  this.controller.clearCache();
  this.controller.resetUsage();
}
```

**REQ-7.2**: Call `resetState()` at the START of `handleUrlChange()`, before any new operations.

**REQ-7.3**: Panel close should stop UrlWatcher AND reset state (currently only stops watcher).

---

## REQ-8: Error Recovery

### Problem
Failures during scrape/translate leave panel in inconsistent state.

### Requirements

**REQ-8.1**: Wrap all async operations in try/catch with user-facing error states.

```typescript
private async scrapeAndTranslate(): Promise<void> {
  try {
    // ... operations
  } catch (error) {
    if (error.name === 'AbortError') return;  // Expected, ignore
    this.controller.showError('Failed to load thread. Click to retry.');
  }
}
```

**REQ-8.2**: Provide retry button in error state.

**REQ-8.3**: Distinguish between network errors, API errors, and scrape failures.

**REQ-8.4**: Log errors with context (thread ID, operation type) for debugging.

---

## Implementation Priority

| Priority | Requirement | Impact |
|----------|-------------|--------|
| P0 | REQ-1 (Cancellation) | Eliminates stale content rendering |
| P0 | REQ-2 (URL Verification) | Prevents wrong-thread content |
| P1 | REQ-3 (Ordered Rendering) | Fixes visual jank |
| P1 | REQ-4 (Idempotent) | Prevents duplicate cards |
| P1 | REQ-5 (Locking) | Prevents conflicting operations |
| P2 | REQ-6 (Thread Detection) | Improves reliability |
| P2 | REQ-7 (State Isolation) | Prevents leaks |
| P2 | REQ-8 (Error Recovery) | Better UX |

---

## Testing Scenarios

1. **Rapid navigation**: Click 5 different threads in quick succession - only final thread should render
2. **Mid-scrape navigation**: Navigate away while "Loading..." is shown - old thread shouldn't appear
3. **Load More race**: Click "Load More", then navigate away immediately - no mixed content
4. **Breakdown race**: Open breakdown, navigate away, come back - breakdown state should be clean
5. **Network failure**: Disconnect network mid-translation - graceful error state
6. **Slow API**: Throttle network to 3G - verify ordered rendering with skeletons
