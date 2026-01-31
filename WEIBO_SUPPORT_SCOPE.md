# Weibo Support - Scope of Work

This document outlines the work required to extend the Twitter Translator extension to also support Weibo (weibo.com).

## Executive Summary

The extension is well-architected but tightly coupled to Twitter's DOM structure. Adding Weibo support requires:

1. **Creating a platform abstraction layer** to decouple platform-specific code
2. **Implementing Weibo-specific selectors** for DOM scraping
3. **Updating manifests and permissions** for weibo.com
4. **Adapting URL detection logic** for Weibo's URL patterns

**Estimated effort**: Medium-sized refactor. The translation pipeline, caching, and UI components are platform-agnostic and can be reused as-is.

---

## Current Architecture

| Component | Platform-Specific? | Notes |
|-----------|-------------------|-------|
| `scraper.ts` | YES | All DOM selectors are Twitter-specific |
| `content.ts` | YES | Tweet detection, expansion, stability checks |
| `panelIntegration.ts` | YES | Main column detection, URL watching |
| `urlWatcher.ts` | PARTIAL | Thread URL regex is Twitter-specific |
| `background.ts` | PARTIAL | URL patterns for context menus |
| `translator.ts` | NO | Platform-agnostic Claude API calls |
| `panel.ts` | NO | Generic UI rendering |
| `cache.ts` | MINIMAL | URL normalization only |

---

## Work Items

### Phase 1: Platform Abstraction Layer

**New files to create:**

#### 1. `src/platforms/types.ts`
Define platform interface:

```typescript
interface Platform {
  name: string;
  hosts: string[];

  // URL handling
  isValidUrl(url: string): boolean;
  isThreadUrl(url: string): boolean;
  extractPostId(url: string): string | null;
  normalizeUrl(url: string): string;

  // DOM selectors
  selectors: {
    postContainer: string;
    postText: string;
    authorName: string;
    timestamp: string;
    replyButton: string;
    showRepliesButton: string;
    mainColumn: string;
    cellContainer: string;
  };

  // Post ID extraction
  extractPostIdFromElement(element: Element): string | null;

  // Reply detection
  hasReplies(element: Element): boolean;
  isInlineReply(element: Element): boolean;
}
```

#### 2. `src/platforms/twitter.ts`
Extract existing Twitter-specific code into a `TwitterPlatform` class.

#### 3. `src/platforms/weibo.ts`
Implement `WeiboPlatform` with Weibo-specific selectors and logic.

#### 4. `src/platforms/index.ts`
Platform detection and routing:

```typescript
function detectPlatform(url: string): Platform | null;
function getPlatform(name: 'twitter' | 'weibo'): Platform;
```

---

### Phase 2: Weibo DOM Research

**Prerequisite**: Analyze Weibo's DOM structure to identify:

| Twitter Selector | Purpose | Weibo Equivalent (TBD) |
|-----------------|---------|----------------------|
| `article[data-testid="tweet"]` | Post container | ? |
| `[data-testid="tweetText"]` | Post text content | ? |
| `[data-testid="User-Name"]` | Author name | ? |
| `time[datetime]` | Timestamp | ? |
| `[data-testid="reply"]` | Reply count button | ? |
| `[data-testid="showMoreReplies"]` | Expand replies | ? |
| `[data-testid="cellInnerDiv"]` | Cell wrapper | ? |
| `main[role="main"]` | Main content column | ? |
| `/status/(\d+)` | Thread URL pattern | ? |

**Action required**: Manual inspection of weibo.com to map these selectors.

---

### Phase 3: Code Changes

#### Files requiring modification:

| File | Changes Required | Complexity |
|------|-----------------|------------|
| `src/scraper/scraper.ts` | Replace hardcoded selectors with platform selectors | Medium |
| `src/content.ts` | Inject platform, use platform selectors | Medium |
| `src/ui/panelIntegration.ts` | Use platform for URL detection and main column | Medium |
| `src/ui/urlWatcher.ts` | Use platform for thread URL regex | Low |
| `src/background.ts` | Add Weibo URL patterns to context menus | Low |
| `src/utils/twitter.ts` | Refactor into platform abstraction | Low |
| `src/cache/cache.ts` | Handle Weibo URL normalization | Low |
| `manifest.v2.json` | Add weibo.com permissions and content scripts | Low |
| `manifest.v3.json` | Add weibo.com permissions and content scripts | Low |

#### Detailed changes:

**`scraper.ts` (277 lines)**
- Lines 27-28: Replace `TWEET_SELECTOR` with `platform.selectors.postContainer`
- Lines 31-43: Use platform methods for text/author/timestamp extraction
- Lines 45-68: Use `platform.extractPostIdFromElement()`
- Lines 92-101: Use `platform.selectors.replyButton`
- Lines 103-121: Use platform methods for inline reply detection

**`content.ts` (318 lines)**
- Lines 62-118: Replace Twitter selectors with platform selectors for stability detection
- Lines 122-162: Use platform selectors for "show replies" buttons
- Lines 170-200: Use platform for URL validation

**`panelIntegration.ts` (848 lines)**
- Lines 220-225: Replace `main[role="main"]` with `platform.selectors.mainColumn`
- Lines 300-350: Use platform for thread URL detection
- Lines 400-450: Use platform for URL normalization

**`urlWatcher.ts` (214 lines)**
- Lines 50-70: Use `platform.isThreadUrl()` instead of hardcoded regex

**`background.ts` (324 lines)**
- Lines 45-50: Add `*://weibo.com/*`, `*://*.weibo.com/*` to documentUrlPatterns
- Lines 120-130: Add Weibo to tab query patterns

**Manifests**
Add to `host_permissions` / `permissions`:
```json
"https://weibo.com/*",
"https://*.weibo.com/*"
```

Add to `content_scripts.matches`:
```json
"https://weibo.com/*",
"https://*.weibo.com/*"
```

---

### Phase 4: Weibo-Specific Considerations

#### Authentication
- Weibo requires login for most content
- May need to detect logged-out state and show guidance

#### Language Detection
- Twitter extension targets Chinese → English
- Weibo is primarily Chinese; same translation direction works
- Consider: Should we support Chinese posts on Twitter AND Weibo with same logic?

#### Rate Limiting
- Weibo may have different rate limiting behavior
- Monitor for scraping restrictions

#### Mobile Support
- Current extension supports Twitter mobile
- Weibo mobile (m.weibo.com) may have different DOM structure
- May require separate mobile selectors

#### URL Structure Differences
- Twitter: `twitter.com/username/status/123456`
- Weibo: `weibo.com/user/123456` or `weibo.com/detail/123456` (TBD - needs research)

---

## Testing Requirements

1. **Unit tests**: Update existing tests to work with platform abstraction
2. **Integration tests**: Add Weibo-specific test fixtures
3. **Manual testing checklist**:
   - [ ] Single post translation on Weibo
   - [ ] Thread/reply expansion on Weibo
   - [ ] Panel toggle on Weibo
   - [ ] Context menu on Weibo
   - [ ] Cache works across platforms
   - [ ] Cost tracking works for Weibo posts
   - [ ] Existing Twitter functionality unaffected

---

## Risks and Unknowns

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Weibo DOM changes frequently | Medium | High | Abstract selectors, add fallbacks |
| Weibo blocks scraping | Medium | High | Test thoroughly, add error handling |
| Authentication required | High | Medium | Detect and guide user |
| Different reply expansion UX | Medium | Medium | Research Weibo's pattern |
| Mobile Weibo has different DOM | High | Medium | May need separate mobile selectors |

---

## Recommended Approach

### Option A: Full Abstraction (Recommended)
- Create complete platform abstraction layer
- Clean separation of concerns
- Easier to add more platforms later (Mastodon, Bluesky, etc.)
- More upfront work, better long-term maintainability

### Option B: Minimal Weibo Support
- Add Weibo selectors alongside Twitter selectors
- Use if/else branching based on current URL
- Faster initial implementation
- Creates technical debt

**Recommendation**: Option A. The codebase is clean enough that abstraction won't be painful, and it future-proofs for additional platforms.

---

## Task Breakdown

| Task | Est. Files Changed | Dependencies |
|------|-------------------|--------------|
| 1. Research Weibo DOM structure | 0 (research only) | None |
| 2. Create platform types/interface | 1 new file | None |
| 3. Extract TwitterPlatform class | 1 new file, refactor 2-3 | Task 2 |
| 4. Implement WeiboPlatform class | 1 new file | Tasks 1, 2 |
| 5. Refactor scraper to use platform | 1 file | Task 3 |
| 6. Refactor content.ts to use platform | 1 file | Task 3 |
| 7. Refactor panelIntegration to use platform | 1 file | Task 3 |
| 8. Refactor urlWatcher to use platform | 1 file | Task 3 |
| 9. Update background.ts URL patterns | 1 file | None |
| 10. Update manifests | 2 files | None |
| 11. Update/add tests | 3-5 files | Tasks 5-8 |
| 12. Manual testing & bug fixes | Various | All above |

---

## Summary

Adding Weibo support is a medium-sized project. The main work is:

1. **Research** (~2-4 hours): Understand Weibo's DOM structure
2. **Abstraction layer** (~4-6 hours): Create platform interface and extract Twitter code
3. **Weibo implementation** (~4-6 hours): Implement Weibo selectors and patterns
4. **Refactoring** (~4-6 hours): Update all consumers to use platform abstraction
5. **Testing** (~2-4 hours): Verify both platforms work correctly

The translation engine, caching, UI, and cost tracking are all reusable. The work is primarily about abstracting the DOM scraping layer to be platform-aware.
