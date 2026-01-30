# Phase 3: Polish for Translation Extension

Focused improvements specific to the translation reading experience.

---

## 1. Glassmorphism Header

The sticky header should blur content behind it for better visual hierarchy when scrolling.

### Implementation

```css
.header {
  position: sticky;
  top: 0;
  height: 53px;
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  background: rgba(255, 255, 255, 0.85);
  border-bottom: 1px solid var(--border);
  z-index: 10;
}

@media (prefers-color-scheme: dark) {
  .header {
    background: rgba(0, 0, 0, 0.65);
  }
}
```

### Tests

```typescript
it('header has backdrop-filter for blur effect', () => {
  const header = document.querySelector('.header');
  expect(getComputedStyle(header!).backdropFilter).toContain('blur');
});
```

---

## 2. Copy Translation Button

Users should be able to copy translations to clipboard easily.

### Implementation

```typescript
// Add copy button to each tweet card
const copyBtn = document.createElement('button');
copyBtn.className = 'tweet-action-btn tweet-copy';
copyBtn.textContent = 'Copy';
copyBtn.addEventListener('click', async (e) => {
  e.stopPropagation();
  await navigator.clipboard.writeText(translation.naturalTranslation);
  copyBtn.textContent = 'Copied!';
  setTimeout(() => copyBtn.textContent = 'Copy', 2000);
});
```

### CSS

```css
.tweet-copy.copied {
  color: var(--success);
  border-color: var(--success);
}
```

### Tests

```typescript
it('copy button copies translation to clipboard', async () => {
  const writeText = vi.fn();
  Object.assign(navigator, { clipboard: { writeText } });

  const element = renderTweet(mockTweet, mockTranslation);
  const copyBtn = element.querySelector('.tweet-copy');
  await copyBtn?.dispatchEvent(new Event('click'));

  expect(writeText).toHaveBeenCalledWith('The weather is nice today');
});

it('copy button shows confirmation feedback', async () => {
  const element = renderTweet(mockTweet, mockTranslation);
  const copyBtn = element.querySelector('.tweet-copy') as HTMLButtonElement;

  await copyBtn.click();
  expect(copyBtn.textContent).toBe('Copied!');
});
```

---

## 3. Keyboard Navigation for Breakdowns

Navigate between tweets and toggle breakdowns with keyboard.

### Implementation

```typescript
// Make tweet headers keyboard accessible
header.setAttribute('role', 'button');
header.setAttribute('tabindex', '0');
header.setAttribute('aria-expanded', 'false');

header.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    header.click();
  }
});

// Update aria-expanded on toggle
const updateAria = () => {
  const isExpanded = !breakdown.classList.contains('hidden');
  header.setAttribute('aria-expanded', String(isExpanded));
};
```

### Tests

```typescript
it('tweet header is keyboard accessible', () => {
  const element = renderTweet(mockTweet, mockTranslation);
  const header = element.querySelector('.tweet-header');

  expect(header?.getAttribute('role')).toBe('button');
  expect(header?.getAttribute('tabindex')).toBe('0');
});

it('Enter key toggles breakdown', () => {
  const element = renderTweet(mockTweet, mockTranslation);
  document.body.appendChild(element);

  const header = element.querySelector('.tweet-header');
  header?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));

  expect(element.classList.contains('expanded')).toBe(true);
});

it('aria-expanded updates on toggle', () => {
  const element = renderTweet(mockTweet, mockTranslation);
  document.body.appendChild(element);

  const header = element.querySelector('.tweet-header');
  expect(header?.getAttribute('aria-expanded')).toBe('false');

  header?.dispatchEvent(new Event('click'));
  expect(header?.getAttribute('aria-expanded')).toBe('true');
});
```

---

## 4. Smooth Scroll to New Content

When loading more replies, scroll smoothly to the first new item.

### Implementation

```typescript
private async translateNewTweets(newTweets: Tweet[]): Promise<void> {
  const firstNewId = newTweets[0]?.id;

  // ... translation logic ...

  // After translations render, scroll to first new one
  if (firstNewId) {
    const newElement = this.tweetsContainer?.querySelector(`[data-tweet-id="${firstNewId}"]`);
    newElement?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
```

### CSS

```css
html {
  scroll-behavior: smooth;
}

@media (prefers-reduced-motion: reduce) {
  html {
    scroll-behavior: auto;
  }
}
```

### Tests

```typescript
it('scrolls to first new tweet after loading more', async () => {
  const scrollIntoView = vi.fn();
  HTMLElement.prototype.scrollIntoView = scrollIntoView;

  // ... trigger load more ...

  expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
});
```

---

## 5. Better Breakdown Loading State

Show inline skeleton while breakdown loads instead of just text.

### Implementation

```typescript
// Instead of just "Loading breakdown..."
const loadingSkeleton = `
  <div class="breakdown-loading-skeleton">
    <div class="skeleton skeleton-table"></div>
    <div class="skeleton skeleton-notes"></div>
  </div>
`;
breakdownInner.innerHTML = loadingSkeleton;
```

### CSS

```css
.breakdown-loading-skeleton {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.skeleton-table {
  height: 80px;
  width: 100%;
  border-radius: 8px;
}

.skeleton-notes {
  height: 40px;
  width: 60%;
  border-radius: 8px;
}
```

### Tests

```typescript
it('shows skeleton while loading breakdown', async () => {
  // Trigger expand on tweet without cached breakdown
  const element = renderTweet(mockTweet, { id: '1', naturalTranslation: 'Hello' });
  document.body.appendChild(element);

  const header = element.querySelector('.tweet-header');
  header?.dispatchEvent(new Event('click'));

  const skeleton = element.querySelector('.breakdown-loading-skeleton');
  expect(skeleton).toBeTruthy();
});
```

---

## 6. Retry Failed Translations

Add retry button for individual failed translations.

### Implementation

```typescript
interface FailedTranslation {
  tweet: Tweet;
  error: string;
}

private renderFailedTweet(tweet: Tweet, error: string): HTMLElement {
  const article = document.createElement('article');
  article.className = 'tweet-card tweet-failed';
  article.innerHTML = `
    <div class="tweet-shell">
      <div class="tweet-avatar">${this.getInitials(tweet.author)}</div>
      <div class="tweet-body">
        <div class="tweet-header">
          <span class="tweet-author">${tweet.author}</span>
        </div>
        <div class="tweet-original">${tweet.text}</div>
        <div class="tweet-error">
          <span>Translation failed</span>
          <button class="tweet-retry-btn">Retry</button>
        </div>
      </div>
    </div>
  `;

  article.querySelector('.tweet-retry-btn')?.addEventListener('click', () => {
    this.retryTranslation(tweet);
  });

  return article;
}
```

### CSS

```css
.tweet-failed {
  opacity: 0.7;
}

.tweet-error {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 8px;
  color: var(--warning);
  font-size: 14px;
}

.tweet-retry-btn {
  background: transparent;
  border: 1px solid var(--warning);
  color: var(--warning);
  border-radius: 9999px;
  padding: 4px 12px;
  font-size: 13px;
  cursor: pointer;
}

.tweet-retry-btn:hover {
  background: rgba(180, 83, 9, 0.1);
}
```

### Tests

```typescript
it('shows retry button on failed translation', () => {
  const element = controller.renderFailedTweet(mockTweet, 'Network error');
  expect(element.querySelector('.tweet-retry-btn')).toBeTruthy();
});

it('retry button triggers retranslation', () => {
  const retrySpy = vi.spyOn(controller, 'retryTranslation');
  const element = controller.renderFailedTweet(mockTweet, 'Error');
  document.body.appendChild(element);

  (element.querySelector('.tweet-retry-btn') as HTMLButtonElement).click();
  expect(retrySpy).toHaveBeenCalledWith(mockTweet);
});
```

---

## 7. SVG Back Arrow Icon

Replace CSS-drawn arrow with proper SVG for crispness.

### Implementation

```html
<button class="nav-back" type="button" aria-label="Back">
  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
    <path d="M7.414 13l5.043 5.043-1.414 1.414L3.586 12l7.457-7.457 1.414 1.414L7.414 11H21v2H7.414z" fill="currentColor"/>
  </svg>
</button>
```

### CSS Update

```css
.nav-back {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 9999px;
  border: none;
  background: transparent;
  cursor: pointer;
  color: var(--text);
}

/* Remove old ::before pseudo-element arrow */
```

### Tests

```typescript
it('back button uses SVG icon', () => {
  const backBtn = document.querySelector('.nav-back');
  expect(backBtn?.querySelector('svg')).toBeTruthy();
});
```

---

## Implementation Priority

1. **Keyboard navigation** - Accessibility requirement
2. **Copy button** - High user value for a translation app
3. **Glassmorphism header** - Visual polish
4. **SVG back arrow** - Clean up hacky CSS
5. **Breakdown skeleton** - Better loading UX
6. **Retry failed** - Error recovery
7. **Smooth scroll** - Nice-to-have polish

---

## Summary

Phase 3 focuses on:
- **Accessibility**: Keyboard nav, ARIA attributes
- **Utility**: Copy translations, retry failures
- **Visual polish**: Blur header, SVG icons, better loading states

All features are specific to the translation reading experience.
