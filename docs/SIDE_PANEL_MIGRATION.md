# Side Panel Migration Requirements

This document defines requirements for migrating from the current tab-based translation UI to an in-page side panel architecture.

## Background

The current implementation opens translations in a separate browser tab and manages its own navigation stack for reply threads. This creates complexity:

- Dual code paths for opening reply threads (~90 lines)
- Manual history stack with tweet caching and scroll restoration (~30 lines)
- Four custom message types for tab coordination
- Brittle "show replies" button detection and clicking
- 13 state variables in the translation controller

The side panel approach lets Twitter handle navigation while the extension focuses solely on scraping and translating the current page.

## Goals

1. Eliminate custom navigation logic by using Twitter's native navigation
2. Simplify the codebase by removing tab coordination
3. Improve UX by keeping Twitter visible alongside translations
4. Prepare architecture for future Firefox Mobile support (full-screen sheet variant)

## Non-Goals

1. Firefox Mobile support (deferred to separate phase)
2. Changes to translation logic or API integration
3. Changes to breakdown UI functionality
4. Automatic "load more" - user-initiated loading remains for token control

---

## Functional Requirements

### FR-1: Side Panel Display

- **FR-1.1**: Panel appears as a right-side drawer overlaying Twitter content
- **FR-1.2**: Panel width is fixed (recommended: 420-480px) with the Twitter page visible beneath/beside
- **FR-1.3**: Panel has a close button that dismisses it entirely
- **FR-1.4**: Panel can be opened via browser action (toolbar icon) or context menu on tweet
- **FR-1.5**: Panel persists across Twitter navigation until explicitly closed

### FR-2: Translation Flow

- **FR-2.1**: When panel opens, scrape and translate the current Twitter thread
- **FR-2.2**: Display translated tweets in the same card format as current UI
- **FR-2.3**: Maintain breakdown functionality (expandable grammar/vocabulary tables)
- **FR-2.4**: Show token usage statistics in panel footer

### FR-3: Navigation Handling

- **FR-3.1**: When user navigates Twitter (clicks reply, back button, etc.), detect URL change
- **FR-3.2**: On URL change to a new thread, clear current translations and translate new thread
- **FR-3.3**: On URL change to non-thread page, show empty state or "Navigate to a tweet to translate"
- **FR-3.4**: No custom back/forward buttons - user uses Twitter's navigation

### FR-4: Load More

- **FR-4.1**: "Load more replies" button triggers scroll on Twitter page to load additional tweets
- **FR-4.2**: Newly loaded tweets are scraped and appended to translation list
- **FR-4.3**: Already-translated tweets are not re-translated (use cached translations)
- **FR-4.4**: Loading state shown while scraping/translating additional tweets

### FR-5: Thread Context

- **FR-5.1**: Main post is visually distinguished from replies (existing styling)
- **FR-5.2**: Reply tweets link to their thread on Twitter (clicking navigates Twitter, panel updates)
- **FR-5.3**: Remove "Show replies" button from tweet cards - user clicks on Twitter directly

---

## Technical Requirements

### TR-1: Panel Implementation

- **TR-1.1**: Panel is injected as a content script DOM element (not an iframe or separate tab)
- **TR-1.2**: Panel styles are scoped/namespaced to avoid Twitter CSS conflicts
- **TR-1.3**: Panel renders using existing tweet card and breakdown components
- **TR-1.4**: Panel z-index ensures it appears above Twitter content

### TR-2: URL Change Detection

- **TR-2.1**: Detect Twitter SPA navigation via History API monitoring (`pushState`/`replaceState`)
- **TR-2.2**: Also handle `popstate` events for browser back/forward
- **TR-2.3**: Debounce rapid URL changes (e.g., 200ms) to avoid redundant scrapes
- **TR-2.4**: Only trigger re-translation when URL path changes (ignore query params/hash changes that don't indicate new thread)

### TR-3: State Management

- **TR-3.1**: Panel state consists of: current URL, tweets array, cached translations, usage stats
- **TR-3.2**: Remove: `historyStack`, `sourceTabId` coordination
- **TR-3.3**: Translation cache keyed by tweet ID persists across URL changes within session
- **TR-3.4**: Panel state resets when panel is closed and reopened

### TR-4: Message Simplification

Remove the following message types:
- `NAVIGATE_TAB`
- `NAVIGATE_AND_SCRAPE`
- `SCRAPE_CHILD_REPLIES`

Retain:
- `SCRAPE_PAGE` - scrape current tab's Twitter content
- `SCRAPE_MORE` - scroll and scrape additional tweets (may need modification)
- `TRANSLATE` - send tweets to API for translation
- `GET_SETTINGS` / `SAVE_SETTINGS`

### TR-5: Content Script Architecture

- **TR-5.1**: Single content script handles both scraping and panel rendering
- **TR-5.2**: Panel component is lazy-loaded (not injected until user activates translation)
- **TR-5.3**: Scraper functions remain unchanged
- **TR-5.4**: Background script no longer manages tab navigation

### TR-6: Styling

- **TR-6.1**: Reuse existing tweet card CSS with minimal modifications
- **TR-6.2**: Panel container uses fixed positioning with right: 0
- **TR-6.3**: Add panel open/close animation (slide in/out)
- **TR-6.4**: Ensure panel is usable at Twitter's minimum supported viewport width

---

## Components to Modify

### Keep (minimal changes)

| Component | Location | Changes |
|-----------|----------|---------|
| Tweet card rendering | `src/ui/translate.ts` | Remove "Show replies" button |
| Breakdown UI | `src/ui/translate.ts` | None |
| Translation controller | `src/ui/translate.ts` | Remove history stack, simplify state |
| Scraper | `src/scraper/scraper.ts` | None |
| Translator API | `src/translator/translator.ts` | None |
| Settings | `src/ui/settings.ts` | None |

### Remove

| Component | Location | Reason |
|-----------|----------|--------|
| History stack | `src/ui/translate.ts:261, 608-640` | Twitter handles navigation |
| Back button | `src/ui/translate.ts` | Twitter handles navigation |
| openReplyThread() | `src/ui/translate.ts:773-865` | Twitter handles navigation |
| NAVIGATE_TAB handler | `src/background.ts` | No tab coordination |
| NAVIGATE_AND_SCRAPE handler | `src/background.ts` | No tab coordination |
| SCRAPE_CHILD_REPLIES handler | `src/background.ts` | No tab coordination |
| translate.html | `src/ui/translate.html` | Panel replaces separate page |
| Show replies button clicking | `src/content.ts:130-166` | User clicks on Twitter |

### Add

| Component | Purpose |
|-----------|---------|
| Panel container | DOM element injected into Twitter page |
| Panel open/close logic | Handle toolbar click, context menu, close button |
| URL change listener | Detect Twitter navigation, trigger re-translation |
| Panel styles | Scoped CSS for panel layout |
| Empty state | UI for non-thread pages |

---

## Migration Steps

### Phase 1: Panel Infrastructure

1. Create panel container component with open/close functionality
2. Add scoped panel styles
3. Wire up browser action to toggle panel
4. Panel shows placeholder content

### Phase 2: Translation in Panel

1. Move tweet card rendering into panel
2. Move breakdown UI into panel
3. Connect scraper to panel (scrape on open)
4. Connect translator to panel
5. Panel now shows translations for current page

### Phase 3: URL Change Handling

1. Implement URL change detection (History API monitoring)
2. Clear and re-translate on URL change
3. Add empty state for non-thread URLs
4. Add debouncing

### Phase 4: Load More

1. Adapt "load more" to work within panel context
2. Scroll Twitter page, scrape new tweets, append to panel
3. Preserve translation cache across load-more operations

### Phase 5: Cleanup

1. Remove translate.html and associated routing
2. Remove unused message types and handlers
3. Remove history stack code
4. Remove "Show replies" button from tweet cards
5. Remove show-replies clicking logic from content script

### Phase 6: Polish

1. Add panel open/close animations
2. Test at various viewport widths
3. Verify no Twitter CSS conflicts
4. Update extension permissions if needed

---

## Acceptance Criteria

- [ ] Panel opens when clicking browser action on a Twitter thread page
- [ ] Panel displays translated tweets matching current page
- [ ] Clicking a reply tweet on Twitter updates the panel with new thread
- [ ] Browser back button on Twitter updates the panel with previous thread
- [ ] "Load more" appends additional translated tweets without duplicates
- [ ] Breakdown tables expand/collapse correctly in panel
- [ ] Closing and reopening panel re-scrapes current page
- [ ] Panel does not break Twitter's native functionality
- [ ] No console errors from CSS conflicts
- [ ] Token usage displays correctly

---

## Open Questions

1. **Panel width**: Fixed 420px, or user-resizable?
2. **Activation**: Browser action only, or also inject a floating button on Twitter?
3. **Persistence**: Should panel state survive page refresh? (Current answer: no)
4. **Context menu**: Keep "Translate this thread" context menu, update to open panel?
5. **Keyboard shortcut**: Add shortcut to toggle panel?

---

## Future Considerations (Out of Scope)

- Mobile full-screen sheet variant
- Panel position preference (left vs right)
- Panel width preference
- Offline translation cache
- Multiple simultaneous translations
