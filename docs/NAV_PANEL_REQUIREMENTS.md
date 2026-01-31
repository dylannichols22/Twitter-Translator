# Navigation & Panel Correctness Requirements

## Goal
Make Twitter/X SPA navigation detection reliable and ensure the side panel always renders content that matches the current thread the user is viewing.

## Scope
- Content script navigation detection and panel refresh behavior.
- Panel data correctness, stale-response handling, and UI states during navigation.

## Non-Goals
- Changing translation quality or model behavior.
- Redesigning the panel UI beyond state-specific messaging.
- Adding new translation features unrelated to navigation or panel correctness.

## Terminology
- **Thread URL**: Any URL matching `/status/{tweetId}` on `twitter.com` or `x.com`.
- **Primary thread tweet**: The top-most top-level tweet element in the main column.
- **Navigation event**: Any user action that changes the current thread (clicks, back/forward, inline route change).
- **Navigation token**: A monotonic identifier used to discard stale async work.

## Functional Requirements

### Navigation Detection
1. **History API tracking**
   - The content script MUST detect URL changes triggered by `pushState`, `replaceState`, and `popstate`.
   - The detector MUST be debounced to avoid redundant work when multiple events fire in quick succession.

2. **DOM-based thread change detection**
   - The content script MUST detect when the primary thread tweet in the DOM changes even if the URL has not updated yet.
   - The detector MUST use stable attributes (e.g., `data-testid="tweet"` and `time` → `a[href*="/status/"]`) to extract the primary thread tweet id.
   - The detector MUST ignore nested tweets (e.g., quoted tweets) and only consider top-level thread items.

3. **Thread readiness gating**
   - The panel MUST only begin scraping when both:
     - The URL is a thread URL, and
     - The primary thread tweet id in the DOM matches the URL thread id.
   - If a mismatch persists, the system MUST retry for up to 8 seconds and then surface a "Unable to detect thread" state with a retry action.

4. **Navigation source coverage**
   - The detector MUST handle:
     - Clicking tweets in the timeline.
     - Browser back/forward.
     - Opening the panel via context menu or browser action.

5. **Watcher lifecycle**
   - The URL/DOM watcher MUST only be active while the panel is open.
   - The watcher MUST shut down cleanly when the panel closes and MUST not leak event listeners.

### Panel Content Correctness
6. **Source binding**
   - Each scrape/translation request MUST be tied to a `sourceUrl` and `sourceThreadId`.
   - The panel MUST only render data that matches the current `sourceUrl` and `sourceThreadId`.

7. **Stale response rejection**
   - Every async scrape/translate operation MUST include a `navigation token`.
   - If a response arrives with a stale token, the panel MUST discard it without rendering.

8. **Clear-on-navigate**
   - On thread change, the panel MUST clear:
     - Rendered tweets
     - Cached translations for the prior thread
     - Breakdown cache
     - Usage counters
   - The panel MUST show a loading state until fresh data is rendered.

9. **Consistent empty states**
   - If the user is not on a thread URL, the panel MUST show an explicit empty state and disable "Load more."
   - If scraping yields zero tweets, the panel MUST show an empty state with a retry action.

10. **Load more replies correctness**
    - Load-more MUST:
      - Use the current thread id as the source of truth.
      - Exclude already-rendered tweet ids.
      - Reject results if the thread id or navigation token no longer matches.

11. **Context-menu targeting**
    - When triggered from the context menu, the panel MUST attempt to open on the specific tweet under the cursor.
    - If that tweet URL is unavailable or invalid, the panel MUST fall back to the active thread URL.

12. **Cache safety**
    - Any cached translation MUST be keyed by at minimum:
      - Normalized thread URL
      - Comment limit
    - Cached translations MUST not be reused across different thread ids.

## UX Requirements
13. **Loading state**
    - Show a loading indicator immediately on navigation changes.
    - The loading indicator MUST disappear after:
      - First translation render, or
      - A terminal error state.

14. **Mismatch state**
    - If DOM thread id and URL thread id mismatch beyond the timeout, show a clear error message:
      - "We couldn't detect the thread yet. Retry."

15. **Recovery**
    - The panel MUST allow retry from both empty and mismatch states without requiring a full page reload.

## Instrumentation
16. **Debug logs (dev only)**
    - When `__DEV__` or similar flag is enabled, log:
      - URL changes
      - DOM thread id changes
      - Navigation token values
      - Mismatch timeouts

## Acceptance Criteria
- Navigating between two different thread URLs within 1 second never results in mixed content in the panel.
- Back/forward navigation updates the panel to the correct thread within 2 seconds.
- Opening the panel on a non-thread URL always shows the empty state.
- Stale responses never overwrite current thread content.
