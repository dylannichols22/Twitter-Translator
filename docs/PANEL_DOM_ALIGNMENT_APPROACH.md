# Panel DOM Alignment: First Principles

## Goal
Ensure the panel shows the same thread content and order the user can see in the main Twitter/X column, with no mixed or stale data during navigation.

## First Principles
1. The DOM is the source of truth. Only render what exists in the main column DOM, in the order it appears there.
2. Thread identity is URL plus primary DOM tweet. The thread is the URL `/status/{id}` and the primary (top-most) tweet in the main column must match that id.
3. Navigation changes invalidate everything. Any in-flight scrape/translate is stale once the URL or primary tweet changes.
4. Order must follow DOM order. Translation streaming should never re-order tweets in the panel.
5. Minimal, observable triggers. Use a small set of explicit signals (history events plus DOM changes) to drive updates.

## Straightforward Approach (Happy Path)

### 1) Navigation triggers
Use two signals to start a new navigation cycle:
- History API changes: `pushState`, `replaceState`, and `popstate`.
- DOM primary tweet change: the first top-level tweet in the main column changes.

Debounce these signals into a single `beginNavigation()` call.

### 2) Begin navigation (single entry point)
When a navigation candidate fires:
1. Increment `navToken`.
2. Abort any in-flight work.
3. Reset panel state (tweets, caches, usage, breakdowns).
4. Show loading state.
5. If URL is not a thread URL, show empty state and stop.

### 3) Thread readiness gate
Wait until both are true, or timeout:
- The URL contains `/status/{id}`.
- The primary DOM tweet id equals that `{id}`.

Timeout after 8 seconds and show a "Unable to detect thread. Retry." state.

Implementation notes:
- Scope DOM queries to the main column (`main` or `role="main"`), not the whole document.
- Primary tweet detection uses `article[data-testid="tweet"]` with a `time` link and only counts top-level articles (not nested in another tweet).

### 4) Scrape from DOM, in DOM order
- Read the DOM in order and build `Tweet[]` from the main column.
- Only include top-level tweets (ignore nested quoted tweets).
- Do not re-sort by id or time; preserve DOM order.

### 5) Render skeletons immediately
- Render all tweet shells immediately in DOM order.
- This locks layout to match the user’s current view.

### 6) Stream translations, but never re-order
- Keep an `OrderedRenderBuffer` keyed by DOM order.
- Replace each skeleton when its translation arrives.
- Always check `navToken` and `sourceUrl` before rendering.

### 7) Respond to incremental DOM changes
- A `MutationObserver` on the main column watches for new top-level tweets.
- On change, rescan the DOM and diff by tweet id to find new tweets.
- Append new skeletons in DOM order and translate only those.
- Do not re-translate or re-render existing tweet ids.

## Minimal Data Model
Keep only what is required to preserve correctness:
- `navToken` (monotonic number)
- `sourceUrl` and `sourceThreadId`
- `knownTweetIds`
- `tweets` in DOM order
- `abortController`

## Rejection Rules (Never Render If...)
Reject any result if:
- `navToken` does not match.
- `sourceUrl` or `sourceThreadId` does not match current URL/DOM.
- The panel is closed.

## Why this stays simple
- One entry point for navigation.
- One DOM definition of "what the user sees".
- One ordered rendering path.
- One incremental path for new DOM tweets.

## Suggested Acceptance Tests
- Navigate across 5 different threads quickly: only the last thread renders.
- Back/forward updates the panel within 2 seconds with no mixed content.
- Non-thread URL shows empty state immediately.
- Slow translations never re-order or overwrite a newer thread.
