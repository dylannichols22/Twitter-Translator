# Bug Inventory (Deep Audit)

This document lists code-level bugs and spec gaps found by a deep read of the current codebase.
It emphasizes correctness, reliability, and user-visible failure modes, not just UI polish.

Legend:
- Critical: data loss, security/privacy exposure, or core workflow broken
- High: frequent user-visible failure or major spec violation
- Medium: correctness gaps, wrong behavior in common edge cases
- Low: minor issues, localization gaps, or maintainability hazards

---

## Critical

1) **Thread data passed via URL query is unbounded**
   - Impact: Large threads can exceed URL length limits (navigation fails or truncates), and tweet content is exposed in the URL/history.
   - Repro: Translate a thread with many/long tweets; observe translation tab fails to load or URL becomes huge.
   - References: `src/background.ts:85`, `src/background.ts:90`, `src/ui/translate.ts:269`

2) **Session cache is stored in MV3 service worker memory**
   - Impact: The cache is wiped whenever the background service worker is suspended; violates “session cache” requirement and produces confusing behavior.
   - Repro: Translate a thread, wait for SW to suspend (idle), refresh translate view; cache unexpectedly missing.
   - References: `src/cache/cache.ts:4`, `src/background.ts:158`

---

## High

1) **Nested replies are not filtered (violates scope requirements)**
   - Impact: Scraper includes nested replies when they’re present in DOM, despite requirement to only translate main thread + direct replies.
   - Repro: Open a thread with nested replies expanded; run translation; nested replies appear in results.
   - References: `src/scraper/scraper.ts:29`, `src/content.ts:73`

2) **Cached translation path never sets API key, breaking breakdowns**
   - Impact: If a cached translation is used, clicking “Breakdown” fails with “API key is required.”
   - Repro: Translate once, open same thread (cache hit), click “Breakdown” on any tweet.
   - References: `src/ui/translate.ts:445`, `src/ui/translate.ts:381`

3) **Breakdown is re-fetched even when translation already contains it**
   - Impact: Unnecessary API calls/costs; duplicate network usage; inconsistent results if model output changes.
   - Repro: Use cached translation that includes segments/notes; click “Breakdown” and observe new API call.
   - References: `src/ui/translate.ts:389`, `src/ui/translate.ts:418`

4) **Cache key ignores settings/commentLimit**
   - Impact: Changing comment limit still returns old cached translations (partial or stale) for same URL.
   - Repro: Translate with commentLimit=10, then set commentLimit=50; open same thread and see only 10 translations.
   - References: `src/cache/cache.ts:34`, `src/ui/translate.ts:449`

5) **Panel thread detection can be fooled by any matching link in DOM**
   - Impact: Panel may scrape the wrong thread if the target thread ID appears in sidebars/quoted tweets.
   - Repro: Open thread A; DOM includes link to thread B; panel may accept readiness and scrape wrong thread.
   - References: `src/ui/panelIntegration.ts:122`, `src/ui/panelIntegration.ts:163`

---

## Medium

1) **Context menu can target stale or wrong tweet**
   - Impact: Right-clicking outside a tweet leaves `lastContextTweetUrl` stale; context menu action may open previous tweet.
   - Repro: Right-click a tweet (sets URL), then right-click empty space and choose context menu.
   - References: `src/content.ts:12`, `src/content.ts:241`

2) **Quote tweets can select the wrong status link**
   - Impact: Scraper/context menu may pick the quoted tweet’s status link instead of the main tweet.
   - Repro: Right-click on a quote tweet; context menu opens quoted tweet instead of OP.
   - References: `src/content.ts:249`, `src/scraper/scraper.ts:37`

3) **`commentLimit` accepts NaN, causing undefined behavior**
   - Impact: NaN is stored as commentLimit and passed through scraping logic.
   - Repro: Clear the comment limit input or enter non-numeric; save settings.
   - References: `src/popup/popup.ts:113`, `src/storage/storage.ts:27`

4) **Missing timeout for `waitForTabComplete`**
   - Impact: Background operations can hang indefinitely if tab never reaches `"complete"`.
   - Repro: Trigger context menu or NAVIGATE_AND_SCRAPE on a tab that never completes (blocked/mid-load).
   - References: `src/background.ts:20`, `src/background.ts:108`

5) **Streaming results are appended in arrival order**
   - Impact: Translations can appear out of thread order if streaming returns tweets in a different order.
   - Repro: Use a long thread; streaming may interleave results; UI order mismatches thread.
   - References: `src/ui/translate.ts:500`, `src/ui/panelIntegration.ts:224`

6) **Empty/invalid timestamps render “Invalid Date”**
   - Impact: UI shows “Invalid Date” for tweets without a `<time>` element.
   - Repro: Scrape tweets missing a time element; view translation.
   - References: `src/ui/translate.ts:124`

7) **Group connector logic ignores exclusions**
   - Impact: Thread gutter lines can connect across excluded tweets, making visual grouping incorrect.
   - Repro: Exclude a tweet ID; remaining cards still render as if adjacent.
   - References: `src/scraper/scraper.ts:144`, `src/scraper/scraper.ts:180`

8) **`isTwitterUrl` uses substring match**
   - Impact: Non-Twitter domains containing “twitter.com” in the hostname/path are treated as Twitter.
   - Repro: Try a URL like `https://notwitter.com`; toggle panel logic treats it as Twitter.
   - References: `src/background.ts:149`, `src/popup/popup.ts:43`

9) **URL param decoding can throw on already-decoded strings**
   - Impact: `decodeURIComponent` can fail on `%` sequences already decoded by `URLSearchParams`, causing “No tweets to translate.”
   - Repro: Open a translate tab with a JSON payload containing `%` or malformed encoding; parsing fails.
   - References: `src/ui/translate.ts:273`

10) **UrlWatcher runs continuously even when panel closed**
    - Impact: 100ms polling loop stays active, wasting CPU; it only stops when panel is destroyed.
    - Repro: Open Twitter, ensure panel is closed; observe UrlWatcher still polling.
    - References: `src/ui/urlWatcher.ts:37`, `src/ui/panelIntegration.ts:20`

11) **Tweet ID can be empty**
    - Impact: Empty IDs break caching, dedupe, and mapping translations back to tweets.
    - Repro: Scrape a tweet without a status link; ID becomes `''` and conflicts.
    - References: `src/scraper/scraper.ts:41`, `src/scraper/scraper.ts:78`

12) **Reply expansion relies on English-only button text**
    - Impact: In non-English Twitter UI, “Show replies” detection fails; replies aren’t expanded.
    - Repro: Use Twitter in another language; expandReplies does nothing.
    - References: `src/content.ts:84`

---

## Low

1) **Mojibake in UI glyphs**
   - Impact: Down-arrow/emoji characters render as garbled text in some builds.
   - Repro: Open translate view/panel; arrow icon shows garbled characters.
   - References: `translate.html:236`, `src/ui/panel.css.ts:164`

2) **Panel state does not reset on close**
   - Impact: Closing the panel leaves cached UI/tweets; reopening shows stale content.
   - Repro: Open panel, translate; close panel; reopen on different thread; old content briefly persists.
   - References: `src/ui/panelIntegration.ts:83`

3) **Duplicate breakdown/table rendering logic**
   - Impact: Drift risk between translate view and panel; fixes may be applied to one only.
   - References: `src/ui/translate.ts:30`, `src/ui/panelIntegration.ts:74`

---

## Spec Gaps (Documented Requirements Not Yet Met)

1) **Side panel “load more replies” flow not implemented**
   - Required by SIDE_PANEL_MIGRATION FR-4; there’s no load-more trigger in panel.
   - References: `docs/SIDE_PANEL_MIGRATION.md`, `src/ui/panelIntegration.ts`

2) **URL change detection not using History API hooks**
   - SIDE_PANEL_MIGRATION TR-2.1 expects pushState/replaceState monitoring; current approach polls.
   - References: `docs/SIDE_PANEL_MIGRATION.md`, `src/ui/urlWatcher.ts:37`

3) **Legacy message types still present**
   - Migration plan says remove NAVIGATE_TAB/NAVIGATE_AND_SCRAPE/SCRAPE_CHILD_REPLIES; still in code.
   - References: `docs/SIDE_PANEL_MIGRATION.md`, `src/messages.ts:8`, `src/background.ts:203`

4) **Panel state reset on close not implemented**
   - TR-3.4 states panel state resets when closed; current integration just toggles visibility.
   - References: `docs/SIDE_PANEL_MIGRATION.md`, `src/ui/panelIntegration.ts:83`

---

## Next Steps (Optional)

If you want, I can:
1) Prioritize and fix the High/Critical issues.
2) Add regression tests for each bug.
3) Implement the side panel migration gaps and remove legacy code paths.
@