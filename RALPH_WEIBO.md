# Ralph Loop: Weibo Support Implementation

## Objective

Extend the Twitter Translator extension to support Weibo (weibo.com) by creating a platform abstraction layer and implementing Weibo-specific selectors.

## Progress Tracking

Track your progress by checking off completed items. Read this file at the start of each iteration to determine what to work on next.

### Phase 1: Platform Abstraction Layer

- [x] Create `src/platforms/types.ts` with Platform interface:
  - `name`, `hosts` properties
  - URL handling methods: `isValidUrl`, `isThreadUrl`, `extractPostId`, `normalizeUrl`
  - DOM selectors object: `postContainer`, `postText`, `authorName`, `timestamp`, `replyButton`, `showRepliesButton`, `mainColumn`, `cellContainer`
  - Element methods: `extractPostIdFromElement`, `hasReplies`, `isInlineReply`

- [x] Create `src/platforms/twitter.ts` - Extract existing Twitter-specific code:
  - Implement `TwitterPlatform` class implementing the Platform interface
  - Move selectors from `scraper.ts` (article[data-testid="tweet"], etc.)
  - Move URL patterns from `urlWatcher.ts` and `panelIntegration.ts`
  - Export as default instance

- [x] Create `src/platforms/weibo.ts` - Implement Weibo platform:
  - Research Weibo DOM structure first (inspect weibo.com)
  - Implement `WeiboPlatform` class with Weibo-specific selectors
  - Handle weibo.com URL patterns (weibo.com/user/ID, weibo.com/detail/ID)
  - Add placeholder selectors with TODO comments where research needed

- [x] Create `src/platforms/index.ts` - Platform detection and routing:
  - `detectPlatform(url: string): Platform | null` function
  - `getPlatform(name: 'twitter' | 'weibo'): Platform` function
  - `getCurrentPlatform(): Platform | null` based on window.location
  - Export all platforms

### Phase 2: Refactor Consumers to Use Platform Abstraction

- [x] Refactor `src/scraper/scraper.ts`:
  - Import platform from `src/platforms`
  - Replace `TWEET_SELECTOR` with `platform.selectors.postContainer`
  - Replace hardcoded text/author/timestamp selectors with platform methods
  - Use `platform.extractPostIdFromElement()` for post ID extraction
  - Use `platform.selectors.replyButton` for reply detection
  - Ensure all Twitter functionality still works after refactor

- [x] Refactor `src/content.ts`:
  - Import platform detection
  - Replace Twitter selectors in stability detection with platform selectors
  - Use platform selectors for "show replies" button detection
  - Use platform for URL validation
  - Test Twitter still works

- [x] Refactor `src/ui/panelIntegration.ts`:
  - Replace `main[role="main"]` with `platform.selectors.mainColumn`
  - Use platform for thread URL detection
  - Use platform for URL normalization
  - Test Twitter panel integration still works

- [x] Refactor `src/ui/urlWatcher.ts`:
  - Use `platform.isThreadUrl()` instead of hardcoded regex
  - Test URL watching on Twitter

- [x] Refactor `src/utils/twitter.ts`:
  - Move reusable logic to platform abstraction
  - Keep Twitter-specific utilities or deprecate

- [x] Update `src/cache/cache.ts`:
  - Handle URL normalization per platform
  - Test caching works for both platforms

### Phase 3: Update Configuration Files

- [x] Update `manifest.v2.json`:
  - Add `"https://weibo.com/*"` and `"https://*.weibo.com/*"` to permissions
  - Add Weibo patterns to content_scripts.matches

- [x] Update `manifest.v3.json`:
  - Add `"https://weibo.com/*"` and `"https://*.weibo.com/*"` to host_permissions
  - Add Weibo patterns to content_scripts.matches

- [x] Update `src/background.ts`:
  - Add `*://weibo.com/*`, `*://*.weibo.com/*` to documentUrlPatterns for context menus
  - Add Weibo to tab query patterns

### Phase 4: Testing & Verification

- [x] Run TypeScript compilation: `npm run build` or `npx tsc --noEmit`
  - Fix any type errors
  - Ensure no regressions

- [ ] Run existing tests (if any): `npm test`
  - All existing tests must pass
  - Fix any broken tests

- [ ] Manual verification checklist (document in comments):
  - Twitter single post translation works
  - Twitter thread expansion works
  - Twitter panel toggle works
  - Platform detection correctly identifies Twitter vs Weibo URLs

## Completion Criteria

All checkboxes above must be checked. When complete:

1. Platform abstraction layer exists with clean interfaces
2. TwitterPlatform extracts all existing Twitter-specific code
3. WeiboPlatform has Weibo selectors (with TODOs for research-needed items)
4. All existing files refactored to use platform abstraction
5. Manifests updated with Weibo permissions
6. Build passes with no TypeScript errors
7. Existing Twitter functionality unbroken

## Instructions for Each Iteration

1. Read this file to find the next unchecked item
2. Implement that item completely
3. Run `npx tsc --noEmit` to verify no type errors
4. Check off the completed item by changing `- [ ]` to `- [x]`
5. If blocked, add a note and move to next item
6. If all items checked and build passes, output: `<promise>WEIBO_SUPPORT_COMPLETE</promise>`

## Notes

- Prefer small, incremental changes over large rewrites
- Test after each refactor to catch regressions early
- When unsure about Weibo selectors, use reasonable placeholders with TODO comments
- Keep existing Twitter behavior working at all times
- If you encounter errors, debug and fix before moving on

---

Output `<promise>WEIBO_SUPPORT_COMPLETE</promise>` when all tasks are complete and verified.
