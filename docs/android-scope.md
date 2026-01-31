# Scope: Firefox for Android Support

## Goal
Make the extension work on Firefox for Android with parity for core translation and saved-card flows.

## Non-Goals
- No iOS Safari support.
- No Chrome/Chromium Android support.
- No in-browser OAuth or native app companion.

## User Stories
- As a user, I can translate Chinese tweets on Firefox for Android.
- As a user, I can save translated cards and review them later.
- As a user, I can access translation UI that is easy to use on touch devices.

## UX Surface
- Use a full-page panel/new-tab view for primary UI on mobile.
- Keep popup minimal; link to the full-page panel when needed.
- Increase touch target sizes and support safe-area insets.

## Android Compatibility
- Avoid MV3 service worker dependencies.
- Use background/event pages that are compatible with Firefox for Android.
- Ensure content scripts are injected on mobile Twitter/X URLs.

## Twitter/X Mobile DOM
- Add selectors for mobile layout.
- Prefer `data-testid` attributes when available.
- Keep desktop selectors intact; choose based on DOM detection.

## Storage & Lifecycle
- Persist critical state to storage; do not rely on long-lived background state.
- Handle process death and quick resume.

## Testing
- Add mobile viewport integration tests for activation + translation + save.
- Add DOM scraping fixtures for mobile layout.

## Open Questions
- Do we need a dedicated “mobile mode” toggle?
- Should the panel auto-open on translation?

## Success Criteria
- Mobile Twitter/X pages are detected and scraped reliably.
- Translation UI is usable with touch and small screens.
- No regressions to desktop behavior.
