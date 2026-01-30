# Bug Fix Plan (Holistic)

This plan sequences all items in `docs/BUGS.md` into a safe, test-driven workflow.
It groups fixes by dependency and risk, minimizes regressions, and keeps spec gaps aligned
with `docs/SIDE_PANEL_MIGRATION.md` and `docs/FIREFOX_MOBILE_SCOPE.md`.

## Goals

- Close all Critical/High/Medium/Low bugs with tests.
- Implement spec gaps where documented requirements exist.
- Reduce duplicate logic and prevent regressions via targeted tests.
- Keep changes small, reviewable, and reversible.

## Principles

- TDD for every bug/spec item: failing test first, then minimal fix.
- Prefer localized fixes over broad refactors unless needed to remove duplication.
- Validate cache keys, URL handling, and async flows with unit tests.
- Keep service worker persistence consistent with MV3 constraints.

## Phase 0: Inventory + Test Harness Alignment

- Confirm all bugs map to a concrete test target.
- Add test helpers where repeated setup is needed (e.g., fake tweets, fake storage, mock time).
- Ensure any "hidden" dependencies (storage, runtime messages, tabs) are mockable in tests.

## Phase 1: Critical Fixes

1) **Unbounded URL query payload**
   - Add a test to assert large thread data is *not* serialized into URL query.
   - Implement a storage-backed payload handoff (e.g., temporary storage keyed by tab ID or nonce).
   - Ensure UI fetches payload by key; verify URL is short and does not expose content.

2) **Session cache in service worker memory**
   - Add a test asserting cache persists across worker restarts (simulated).
   - Move cache to `browser.storage.session` (or a persisted cache module) per requirement.
   - Ensure eviction/TTL behavior still respects requirements.

## Phase 2: High Severity Fixes

1) **Nested replies filtered out**
   - Add a scraper test with nested replies in DOM.
   - Restrict scraper to main thread + direct replies only.

2) **Cached translation path lacks API key**
   - Add UI test: cached translation + Breakdown click requires stored API key.
   - Ensure cached flow pulls key from storage before requesting breakdown.

3) **Breakdown re-fetch despite existing data**
   - Add test where translation already includes breakdown; ensure no new API call.
   - Use existing segments/notes if present; only fetch if missing.

4) **Cache key ignores `commentLimit`**
   - Add test for different settings producing different cache keys.
   - Include `commentLimit` and any other relevant settings in key.

5) **Panel thread detection fooled by unrelated links**
   - Add test with multiple thread links in DOM.
   - Anchor detection to the current thread context (root tweet container or URL match).

## Phase 3: Medium Severity Fixes

1) **Stale context menu target**
   - Add test ensuring context menu uses most recent valid target only.
   - Clear `lastContextTweetUrl` when right-clicking outside a tweet.

2) **Quote tweet status link selection**
   - Add tests for quoted tweet DOM.
   - Prefer the main tweet's status link; ignore quoted block.

3) **`commentLimit` accepts NaN**
   - Add tests for empty/non-numeric input.
   - Sanitize and clamp to valid integer or default.

4) **Missing timeout for `waitForTabComplete`**
   - Add test for never-completing tab.
   - Enforce a timeout with a clear error path.

5) **Streaming results order**
   - Add test for out-of-order streaming arrivals.
   - Buffer and render in original thread order.

6) **Invalid timestamps**
   - Add test for missing `<time>`.
   - Render empty string or fallback label instead of "Invalid Date".

7) **Group connector logic ignores exclusions**
   - Add test for excluded tweet IDs.
   - Update connector logic to skip excluded items.

8) **`isTwitterUrl` substring match**
   - Add test for `notwitter.com` and similar.
   - Enforce hostname validation on recognized Twitter/X domains only.

9) **URL param decoding can throw**
   - Add test for already-decoded payload.
   - Avoid double-decoding; safely parse with fallback.

10) **UrlWatcher runs when panel closed**
   - Add test for closed state.
   - Stop polling when panel is hidden/closed.

11) **Empty tweet ID**
   - Add tests for missing status link.
   - Generate stable fallback IDs or skip such nodes safely.

12) **Reply expansion is English-only**
   - Add test using non-English labels.
   - Use data-testid or aria attributes instead of text.

## Phase 4: Low Severity + Refactors

1) **Mojibake in UI glyphs**
   - Replace non-ASCII glyphs with SVG or CSS-based icons.

2) **Panel state reset on close**
   - Add test for close -> reopen on new thread.
   - Ensure panel state clears, not just hides.

3) **Duplicate breakdown/table rendering**
   - Extract shared rendering utilities.
   - Add shared tests to prevent drift.

## Phase 5: Spec Gaps (SIDE_PANEL_MIGRATION.md)

1) Implement "load more replies" flow in panel (FR-4).
2) Replace polling URL watcher with History API hooks (TR-2.1).
3) Remove legacy message types (NAVIGATE_TAB, NAVIGATE_AND_SCRAPE, SCRAPE_CHILD_REPLIES).
4) Ensure panel state resets on close (TR-3.4) and remove redundant logic.

## Test Strategy

- Unit tests for storage, cache keys, and URL handling.
- DOM tests for scraper and panel behavior using happy-dom.
- Integration-style tests for background/content/panel message flows.
- Regression tests for each bug ID in `docs/BUGS.md`.

## Deliverables

- All bug fixes in code.
- One test per bug/spec item (at minimum).
- Updated docs if behavior changes (README/requirements).
- Clean passing checks: `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`.

