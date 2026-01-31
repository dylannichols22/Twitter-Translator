# Navigation Fix Checklist

> **Spec**: [NAV_PANEL_REQUIREMENTS.md](./NAV_PANEL_REQUIREMENTS.md) - Defines what the system must do
> **Implementation Guide**: [NAVIGATION_SYNC_REQUIREMENTS.md](./NAVIGATION_SYNC_REQUIREMENTS.md) - Shows how to implement with code examples

---

## P0 - Must Ship
- [x] AbortController cancels in-flight ops (SYNC REQ-1)
- [x] Source URL/thread ID tracked (SYNC REQ-2, NAV REQ-6)
- [x] resetState() clears all fields (SYNC REQ-7)
- [x] handleUrlChange: abort → reset → start

## P1 - Ship Together
- [x] Operation lock prevents concurrent scrape/loadMore (SYNC REQ-5)
- [x] Idempotent rendering (SYNC REQ-4)
- [ ] Ordered rendering or skeleton placeholders (SYNC REQ-3, NAV REQ-13)

## P2 - Fast Follow
- [ ] Exponential backoff for thread detection (SYNC REQ-6)
- [ ] MutationObserver fallback (SYNC REQ-6.2)
- [ ] Error states with retry (SYNC REQ-8, NAV REQ-15)
- [ ] Debug logging (NAV REQ-16)

---

## Acceptance Criteria (from NAV_PANEL_REQUIREMENTS)
- [ ] Navigate 2 threads in <1s → no mixed content
- [ ] Back/forward updates panel within 2s
- [ ] Non-thread URL → empty state
- [ ] Stale responses never render

## Testing Scenarios (from NAVIGATION_SYNC_REQUIREMENTS)
- [ ] Rapid navigation: Click 5 different threads quickly - only final thread renders
- [ ] Mid-scrape navigation: Navigate while "Loading..." shown - old thread doesn't appear
- [ ] Load More race: Click "Load More", navigate away - no mixed content
- [ ] Breakdown race: Open breakdown, navigate, return - clean state
- [ ] Network failure: Disconnect mid-translation - graceful error state
- [ ] Slow API: Throttle to 3G - verify ordered rendering with skeletons
