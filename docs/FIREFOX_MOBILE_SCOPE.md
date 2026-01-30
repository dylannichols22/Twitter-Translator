# Firefox Mobile Scope Assessment

This documents the current assessment for making the extension usable on Firefox Mobile (Android). It is intentionally a future-facing note since the web UI and core desktop functionality still need refinement.

## Summary

Supporting Firefox Mobile is feasible but likely a significant product/UX rewrite rather than a straight port. The current architecture assumes desktop tab, popup, and background flow that are limited or unavailable on mobile.

## Key Constraints (Firefox Mobile)

- Popup and context menu UX are limited or unavailable; activation must be rethought.
- Some `browser.*` APIs behave differently or are not supported (tabs and window APIs are the biggest risk).
- Opening a new tab for `translate.html` is unreliable on mobile and not ideal for small screens.
- E2E testing is harder (Playwright cannot target Firefox Mobile directly).

## UX/Activation Changes Needed

- Replace popup/context menu with an in-page action button injected on Twitter/X pages.
- Render translations in a page overlay or side panel instead of a new translate tab.
- Make all navigation (replies, back) happen within the same page.

## UI Changes Needed

- Build a mobile layout for the translation view (stacked, touch-friendly, simpler header).
- Make breakdown tables horizontally scrollable with clear affordances.
- Reduce reliance on large fixed widths and desktop spacing.

## Architecture Changes Needed

- Create an in-page UI renderer to replace `translate.html` on mobile.
- Feature detect API availability to select desktop vs mobile behaviors.
- Maintain thread history within the page overlay (no new tabs).

## Testing Plan (High Level)

- Manual testing on Android Firefox (Nightly recommended).
- Add lightweight smoke checks for content-script injection and basic translation UI.

## Recommendation

Defer Firefox Mobile support until:

- The desktop web UI is stabilized.
- Core reply/navigation flows are reliable.
- Translation UI/UX is polished.

Once those are done, schedule a separate mobile phase focused on UX, activation, and in-page rendering.

## Migration Concept (Reuse vs. New Work)

We do not need to throw away the current implementation. The goal is to migrate the existing translation UI into an in-page overlay so desktop and mobile can share logic.

What we can keep:

- Translate view rendering logic (tweet cards, breakdown UI).
- Translation controller logic (load more, cache, usage tracking).
- Scraper + background messaging and settings.

What we need to adapt:

- Replace `translate.html` with an in-page overlay container.
- Popup/context menu should open the overlay and pass data to it.
- Add responsive layout rules for desktop (side panel) vs mobile (full-screen sheet).

## Envisioned UX (Desktop + Mobile)

Desktop:

- Right-side panel (drawer) that does not replace Twitter content.
- Clicking “Translate” opens the panel and starts translation.
- User can navigate Twitter normally; panel updates when the thread URL changes.
- Back button in the panel restores previous translated thread state.

Mobile:

- Full-screen sheet overlay with a compact header and close control.
- Same actions (breakdown, load more) but with larger touch targets.
- No new tabs; all navigation stays in the same page.

## Why This Helps

- Reduces custom navigation handling: Twitter page navigation stays native.
- Keeps one UI codepath for desktop and mobile.
- Preserves existing logic while improving UX and feasibility on mobile.
