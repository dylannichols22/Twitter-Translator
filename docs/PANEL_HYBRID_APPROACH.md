# Panel Hybrid Approach: Navigation Gate + Sync Loop

## Goal
Fix panel/DOM mismatches by separating navigation correctness from steady-state syncing.

- **Navigation boundary** (safety): use URL + primary DOM tweet agreement to prevent stale or mixed threads.
- **Steady-state sync** (simplicity): once gated, keep the panel in sync with a single idempotent `sync()` loop.

## Mental Model

**Phase A: Navigation boundary**
- Detect navigation (History API + primary tweet change).
- Invalidate in-flight work.
- Gate on thread readiness (URL `/status/{id}` + primary DOM tweet id matches).

**Phase B: Steady-state sync**
- One source of truth: main column DOM.
- One operation: `sync()` (scrape -> diff -> update).
- Translation cache + drop any render if tweet is no longer visible.

## Why this hybrid
- URL changes are not content truth, but they are strong invalidation signals.
- DOM is the right source of truth once the thread is stable.
- The gate prevents syncing during transitional DOM states.

## Navigation Boundary (Document 1)

### Signals
- History API changes: `pushState`, `replaceState`, `popstate`.
- Primary DOM tweet change in the main column.

### Begin Navigation (single entry point)
1. Increment `navToken`.
2. Abort any in-flight work.
3. Reset panel state (tweets, usage, breakdowns).
4. Show loading.
5. If URL is not a thread URL, show empty state and stop.

### Thread Readiness Gate
Wait until both are true (or timeout):
- URL contains `/status/{id}`.
- The primary DOM tweet id equals `{id}`.

Timeout after 8 seconds and show: "Unable to detect thread. Retry."

### Rejection Rules
Never render if:
- `navToken` does not match.
- `sourceUrl` or `sourceThreadId` does not match current URL/DOM.
- Panel is closed.

## Concrete Hybrid Flow (against `panelIntegration.ts`)

### Replace the current pipeline
Current flow:
- `handleUrlChange()` -> `scrapeAndTranslate()` -> `startProgressiveLoading()`

Hybrid flow:
- `handleUrlChange()` -> `beginNavigation()` -> `gateThreadReady()` -> `startSyncLoop()` -> `sync()`

### Core responsibilities by phase
Navigation boundary (Document 1):
- Entry point: `beginNavigation()`
- Invalidate: `navToken += 1`, `abortController.abort()`
- Reset state: tweets, usage, breakdowns, rendering
- Gate: wait until URL and primary DOM tweet match

Steady-state sync (Document 2):
- Entry point: `startSyncLoop()` + `sync()`
- Idempotent diff/update loop, driven by DOM changes

## Refactor Map (step-by-step)

### 1) Introduce a navigation token
Add:
- `private navToken = 0;`

Use it to reject stale work:
- Capture `const token = this.navToken;` at the start of any async work.
- Before render: `if (token !== this.navToken) return;`

This replaces most `operationLock` usage without blocking idempotent sync.

### 2) Replace `scrapeAndTranslate()` with boundary + loop
Split into:
- `beginNavigation()`:
  - increment token
  - abort any in-flight work
  - reset state
  - show loading
  - if not thread URL -> show empty and return
- `gateThreadReady()`:
  - wait for URL `/status/{id}` + primary DOM tweet id to match
  - timeout after 8s -> show error state
- `startSyncLoop()`:
  - set up MutationObserver on main column
  - debounce `sync()`
  - call `sync()` immediately

### 3) Remove progressive loading
Remove:
- `progressiveLoadingInterval`
- `stableRounds`
- `progressiveScrapeRound()`

Reason: steady-state `sync()` already handles incremental DOM additions.

### 4) Implement the idempotent `sync()` loop
Pseudo:
```
sync() {
  const token = this.navToken;
  const visible = scrapeMainColumnTweets();
  const visibleIds = new Set(visible.map(t => t.id));

  if (token !== this.navToken) return;

  // Optional: navigation loading state
  if (visible.length === 0 && this.currentTweets.size > 0) {
    this.controller.showLoading(true);
    return;
  }

  // Remove missing replies (optionally keep OP)
  for (const id of this.currentTweets.keys()) {
    if (!visibleIds.has(id)) {
      this.currentTweets.delete(id);
      this.controller.removeTweet(id);
    }
  }

  // Add new tweets
  for (const tweet of visible) {
    if (!this.currentTweets.has(tweet.id)) {
      this.currentTweets.set(tweet.id, tweet);
      this.controller.renderSkeleton(tweet);
      this.translateAndRender(tweet, token);
    }
  }

  // Reorder to match DOM
  this.controller.reorderTweets(visible.map(t => t.id));
}
```

### 5) Translation handling is cache-aware + visibility-checked
`translateAndRender()` should:
- use cached translation when available
- translate only when missing
- render only if tweet still visible and `navToken` still matches

### 6) Scope all scrapes to main column
Enforce:
- `main` or `[role="main"]` root
- only top-level tweets, not nested quotes

## What stays (from current code)
- `toggleBreakdown()` and breakdown caching
- Usage recording
- `loadMoreReplies()` only if you still want a manual "force load more" feature

## What can be deleted or simplified
- `operationLock` (replaced by idempotent `sync()` + `navToken` checks)
- `progressiveLoadingInterval` and related state
- Multiple scrape retries (only gate + sync loop)

## Steady-State Sync (Document 2)

### One Observable
**Visible tweets in the main column DOM**, in DOM order.

### Sync Loop (idempotent)
- Scrape DOM in order (main column only).
- Diff by tweet id:
  - Remove tweets no longer visible (optionally keep OP always visible).
  - Add new tweets (render skeletons immediately).
  - Reorder panel to match DOM order.
- Translate only missing tweets.
- Discard translation results if tweet is no longer visible or `navToken` changed.

### Triggering Sync
- `MutationObserver` on main column (debounced).
- Optional polling fallback (2-3s) if needed.

### Translation Cache
- Cache translations by tweet id.
- If tweet reappears, render from cache (no API call).

## Scoping Rules
- **Only** read tweets from the main column (`main` or `[role="main"]`).
- Ignore nested quoted tweets (top-level only).

## What this removes
- Multiple competing URL watchers.
- Progressive loading intervals.
- Operation locks.
- Redundant dedup guards.

## Recommended Implementation Map

### Navigation boundary
- `beginNavigation()` (increment `navToken`, reset state)
- `gateThreadReady()` (URL + primary tweet id)

### Sync loop
- `startSyncLoop()` (MutationObserver)
- `sync()` (scrape -> diff -> update)
- `translateAndRender()` (cache-aware + visibility check)

## Acceptance Tests
- Fast navigation across 5 threads: only last thread renders.
- Back/forward updates panel within 2s with no mixed content.
- Non-thread URL shows empty state immediately.
- Slow translation never reorders or overwrites newer thread.
- Scroll down adds replies; scrolling up reuses cached translations.

