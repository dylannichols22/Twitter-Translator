# Requirements: Firefox for Android UX Support

## 1) Overview
This project is a Firefox extension for translating Chinese Twitter/X content using the Claude API.
Desktop Firefox remains the primary target. The mobile work must not break or regress the existing desktop
panel view or desktop workflows. The goal is to add a mobile-friendly UX on Firefox for Android.

## 2) Scope
### In Scope
- Support Firefox for Android (Fennec) with a usable translation UX.
- Preserve all existing desktop Firefox behaviors and the separate panel view.
- Maintain content script functionality on Twitter/X desktop and mobile layouts.
- Add tests for mobile-specific scraping and activation flows.

### Out of Scope
- iOS Safari support.
- Chrome/Chromium Android support.
- Native apps or OAuth.
- New translation models or backend changes (beyond plumbing for UX).

## 3) UX Requirements
### Desktop (Primary)
- R-UX-01: The existing desktop panel view must remain available and unchanged in behavior.
- R-UX-02: Desktop activation, translation, and saved-card flows must not regress.

### Android (Firefox for Android)
- R-UX-03: Provide a mobile-friendly full-page panel (new tab or dedicated view) optimized for touch.
- R-UX-04: The popup UI on Android must be minimal and link to the full-page panel.
- R-UX-05: Touch targets in the mobile panel must be at least 44px in both dimensions.
- R-UX-06: The mobile panel must respect safe-area insets for notches.

## 4) Content Script / Scraping
- R-DOM-01: Detect and scrape Twitter/X desktop layout (existing behavior).
- R-DOM-02: Detect and scrape Twitter/X mobile layout using `data-testid` selectors when possible.
- R-DOM-03: If mobile selectors fail, do not break desktop selectors; fall back gracefully.

## 5) Android Compatibility
- R-AND-01: Avoid MV3-only dependencies that are unsupported on Firefox for Android.
- R-AND-02: Background logic must tolerate short-lived lifecycles; persist critical state in storage.

## 6) Storage & State
- R-STATE-01: Persist translation state, saved cards, and settings reliably across Android process restarts.
- R-STATE-02: No reliance on long-lived background state for correctness.

## 7) Testing
- R-TEST-01: Add integration tests for mobile activation and translation flow.
- R-TEST-02: Add scraping tests for mobile DOM selectors.
- R-TEST-03: Existing desktop tests must continue to pass unchanged.

## 8) Build & Tooling
- R-BUILD-01: `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build` must pass.
- R-BUILD-02: Desktop build artifacts must remain unchanged in behavior.

## 9) Acceptance Criteria
- A Firefox for Android user can translate a Chinese tweet on mobile Twitter/X.
- The translation UI is usable on a small touchscreen device.
- Desktop panel view remains functional and unchanged in behavior.
- All automated checks pass.
