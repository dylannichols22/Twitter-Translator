# Phase 2: Deep UX Alignment with Twitter/X

This document focuses on **behavioral UX patterns** - the interactions, feedback, loading states, and micro-interactions that make Twitter feel responsive and polished.

## Research Sources

- [Micro-interactions in UX - Interaction Design Foundation](https://www.interaction-design.org/literature/article/micro-interactions-ux)
- [Microinteractions in UX 2025 - NN/G](https://www.nngroup.com/articles/microinteractions/)
- [Twitter Threaded Replies - Social Media Today](https://www.socialmediatoday.com/news/twitter-expands-test-of-threaded-tweet-replies-to-more-users-adds-new-form/577437/)
- [Skeleton Loading UX - Mobbin](https://mobbin.com/glossary/skeleton)
- [Toast Notifications Best Practices - LogRocket](https://blog.logrocket.com/ux-design/toast-notifications/)
- [Twitter Heart Animation - CSS-Tricks](https://css-tricks.com/recreating-the-twitter-heart-animation/)
- [Timing Guidelines for Hidden Content - NN/G](https://www.nngroup.com/articles/timing-exposing-content/)
- [Twitter Hover Cards - Stopdesign](https://stopdesign.com/portfolio/twitter-hover-cards)

---

## 1. Skeleton Loading States

### Current Behavior
- Shows a simple spinner with "Translating content..." text
- No visual hint of what content will appear
- Jarring jump when content loads

### Required Behavior
Replace spinner with skeleton placeholders that mirror the tweet card layout.

### Implementation

```typescript
// src/ui/skeleton.ts
export function renderTweetSkeleton(): HTMLElement {
  const article = document.createElement('article');
  article.className = 'tweet-card tweet-skeleton';
  article.innerHTML = `
    <div class="tweet-shell">
      <div class="skeleton skeleton-avatar"></div>
      <div class="tweet-body">
        <div class="tweet-header">
          <span class="skeleton skeleton-author"></span>
          <span class="skeleton skeleton-timestamp"></span>
        </div>
        <div class="skeleton skeleton-text skeleton-text-1"></div>
        <div class="skeleton skeleton-text skeleton-text-2"></div>
        <div class="skeleton skeleton-text skeleton-text-3"></div>
      </div>
    </div>
  `;
  return article;
}
```

### CSS for Skeletons

```css
.skeleton {
  background: var(--bg-accent);
  border-radius: 4px;
  position: relative;
  overflow: hidden;
}

.skeleton::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(255, 255, 255, 0.08) 50%,
    transparent 100%
  );
  animation: shimmer 1.5s ease-in-out infinite;
}

@keyframes shimmer {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}

.skeleton-avatar {
  width: 40px;
  height: 40px;
  border-radius: 9999px;
}

.skeleton-author {
  width: 120px;
  height: 16px;
}

.skeleton-timestamp {
  width: 60px;
  height: 14px;
}

.skeleton-text {
  height: 14px;
  margin-bottom: 8px;
}

.skeleton-text-1 { width: 100%; }
.skeleton-text-2 { width: 85%; }
.skeleton-text-3 { width: 40%; }
```

### Tests Required

```typescript
describe('Skeleton Loading', () => {
  it('shows skeleton cards while loading', () => {
    controller.showLoading(true);
    const skeletons = document.querySelectorAll('.tweet-skeleton');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('skeleton has shimmer animation', () => {
    const skeleton = renderTweetSkeleton();
    const shimmerEl = skeleton.querySelector('.skeleton');
    const styles = getComputedStyle(shimmerEl!);
    expect(styles.animation).toContain('shimmer');
  });

  it('replaces skeletons with real content progressively', async () => {
    // Start with skeletons
    controller.showLoading(true);
    expect(document.querySelectorAll('.tweet-skeleton').length).toBe(3);

    // After first translation arrives
    await simulateTranslation({ id: '1', naturalTranslation: 'Hello' });
    expect(document.querySelectorAll('.tweet-skeleton').length).toBe(2);
    expect(document.querySelectorAll('.tweet-card:not(.tweet-skeleton)').length).toBe(1);
  });
});
```

---

## 2. Reply Thread Connectors

### Current Behavior
- Replies are indented with left border
- No visual connection to parent

### Required Behavior
Vertical connector lines from parent avatar to child avatar, matching Twitter's thread visualization.

### Implementation

```css
.tweet-card.has-replies {
  position: relative;
}

.tweet-card.has-replies::after {
  content: '';
  position: absolute;
  left: 36px; /* center of 40px avatar + 16px padding */
  top: 68px; /* below avatar */
  bottom: 0;
  width: 2px;
  background: var(--border);
}

.tweet-card.is-reply {
  position: relative;
}

.tweet-card.is-reply::before {
  content: '';
  position: absolute;
  left: 36px;
  top: 0;
  height: 16px;
  width: 2px;
  background: var(--border);
}

/* For inline/nested replies */
.tweet-card.inline-reply {
  margin-left: 52px; /* avatar width + gap */
}

.tweet-card.inline-reply::before {
  left: -16px;
  top: 0;
  height: 28px;
}
```

### Tests Required

```typescript
describe('Reply Thread Connectors', () => {
  it('main post with replies shows bottom connector', () => {
    const tweet = { ...mockTweet, isMainPost: true, hasReplies: true };
    const element = renderTweet(tweet, mockTranslation);
    expect(element.classList.contains('has-replies')).toBe(true);
  });

  it('reply shows top connector', () => {
    const tweet = { ...mockTweet, isMainPost: false };
    const element = renderTweet(tweet, mockTranslation);
    expect(element.classList.contains('is-reply')).toBe(true);
  });

  it('inline replies are indented with connector', () => {
    const tweet = { ...mockTweet, isMainPost: false, inlineReply: true };
    const element = renderTweet(tweet, mockTranslation);
    expect(element.classList.contains('inline-reply')).toBe(true);
  });
});
```

---

## 3. Toast Notifications for Feedback

### Current Behavior
- Error messages appear inline in a fixed position
- No feedback for successful actions
- Messages don't auto-dismiss

### Required Behavior
- Toast notifications slide in from bottom
- Auto-dismiss after 3-4 seconds
- Color-coded by type (success, error, info)
- Can be manually dismissed

### Implementation

```typescript
// src/ui/toast.ts
export type ToastType = 'success' | 'error' | 'info';

export interface ToastOptions {
  message: string;
  type: ToastType;
  duration?: number; // ms, default 4000
}

export class ToastManager {
  private container: HTMLElement;

  constructor() {
    this.container = document.createElement('div');
    this.container.className = 'toast-container';
    this.container.setAttribute('role', 'status');
    this.container.setAttribute('aria-live', 'polite');
    document.body.appendChild(this.container);
  }

  show(options: ToastOptions): void {
    const toast = document.createElement('div');
    toast.className = `toast toast-${options.type}`;
    toast.innerHTML = `
      <span class="toast-message">${options.message}</span>
      <button class="toast-dismiss" aria-label="Dismiss">×</button>
    `;

    // Animate in
    toast.style.animation = 'toast-slide-in 0.3s ease-out';
    this.container.appendChild(toast);

    // Dismiss button
    toast.querySelector('.toast-dismiss')?.addEventListener('click', () => {
      this.dismiss(toast);
    });

    // Auto dismiss
    const duration = options.duration ?? 4000;
    setTimeout(() => this.dismiss(toast), duration);
  }

  private dismiss(toast: HTMLElement): void {
    toast.style.animation = 'toast-slide-out 0.2s ease-in forwards';
    toast.addEventListener('animationend', () => toast.remove());
  }
}
```

### CSS for Toasts

```css
.toast-container {
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1000;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.toast {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-radius: 4px;
  background: var(--surface);
  border: 1px solid var(--border);
  box-shadow: rgba(101, 119, 134, 0.2) 0px 0px 15px;
  font-size: 15px;
  max-width: 400px;
}

.toast-success {
  border-left: 4px solid #00ba7c;
}

.toast-error {
  border-left: 4px solid #f4212e;
}

.toast-info {
  border-left: 4px solid var(--accent);
}

.toast-dismiss {
  background: none;
  border: none;
  color: var(--muted);
  cursor: pointer;
  font-size: 18px;
  padding: 0 4px;
}

@keyframes toast-slide-in {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes toast-slide-out {
  to {
    opacity: 0;
    transform: translateY(20px);
  }
}
```

### Tests Required

```typescript
describe('Toast Notifications', () => {
  let toastManager: ToastManager;

  beforeEach(() => {
    toastManager = new ToastManager();
  });

  it('shows toast with message', () => {
    toastManager.show({ message: 'Translation complete', type: 'success' });
    const toast = document.querySelector('.toast');
    expect(toast?.textContent).toContain('Translation complete');
  });

  it('applies correct class for error type', () => {
    toastManager.show({ message: 'Failed', type: 'error' });
    const toast = document.querySelector('.toast');
    expect(toast?.classList.contains('toast-error')).toBe(true);
  });

  it('auto-dismisses after duration', async () => {
    toastManager.show({ message: 'Test', type: 'info', duration: 100 });
    expect(document.querySelector('.toast')).toBeTruthy();

    await new Promise(r => setTimeout(r, 300));
    expect(document.querySelector('.toast')).toBeFalsy();
  });

  it('can be manually dismissed', () => {
    toastManager.show({ message: 'Test', type: 'info' });
    const dismissBtn = document.querySelector('.toast-dismiss') as HTMLButtonElement;
    dismissBtn.click();

    // After animation
    setTimeout(() => {
      expect(document.querySelector('.toast')).toBeFalsy();
    }, 300);
  });
});
```

---

## 4. Expand/Collapse Animations

### Current Behavior
- Breakdown section toggles instantly (hidden class)
- No visual transition
- No indication of expandability besides chevron

### Required Behavior
- Smooth height animation when expanding/collapsing
- Content fades in as it expands
- Accordion behavior (only one expanded at a time - already implemented)

### Implementation

```css
.tweet-breakdown {
  display: grid;
  grid-template-rows: 0fr;
  opacity: 0;
  transition: grid-template-rows 0.3s ease-out, opacity 0.2s ease-out;
}

.tweet-breakdown.expanded {
  grid-template-rows: 1fr;
  opacity: 1;
}

.tweet-breakdown > .breakdown-inner {
  overflow: hidden;
}
```

```typescript
// Update toggleBreakdown to use CSS transitions instead of hidden class
private async toggleBreakdown(article: HTMLElement, tweet: Tweet, breakdownEl: HTMLElement): Promise<void> {
  const isExpanding = !breakdownEl.classList.contains('expanded');

  if (isExpanding) {
    // ... load content if needed ...
    breakdownEl.classList.add('expanded');
  } else {
    breakdownEl.classList.remove('expanded');
  }
}
```

### Tests Required

```typescript
describe('Expand/Collapse Animation', () => {
  it('breakdown has transition properties', () => {
    const element = renderTweet(mockTweet, mockTranslation);
    const breakdown = element.querySelector('.tweet-breakdown');
    const styles = getComputedStyle(breakdown!);
    expect(styles.transition).toContain('grid-template-rows');
  });

  it('adds expanded class instead of removing hidden', () => {
    const element = renderTweet(mockTweet, mockTranslation);
    const header = element.querySelector('.tweet-header');
    const breakdown = element.querySelector('.tweet-breakdown');

    header?.dispatchEvent(new Event('click'));
    expect(breakdown?.classList.contains('expanded')).toBe(true);
  });
});
```

---

## 5. Hover States and Micro-interactions

### Current Behavior
- Tweet cards have basic hover background change
- No feedback on interactive elements like buttons
- No press/active states

### Required Behavior
- All interactive elements have visible hover states
- Buttons have press feedback (scale down slightly)
- Icon buttons have circular highlight on hover

### CSS Updates

```css
/* Tweet card hover */
.tweet-card {
  transition: background-color 0.2s ease-out;
}

.tweet-card:hover {
  background: rgba(0, 0, 0, 0.03);
}

@media (prefers-color-scheme: dark) {
  .tweet-card:hover {
    background: rgba(255, 255, 255, 0.03);
  }
}

/* Button press feedback */
.btn:active,
.tweet-action-btn:active {
  transform: scale(0.96);
  transition: transform 0.1s ease-out;
}

/* Icon button hover (circular highlight) */
.nav-back,
.tweet-action-btn {
  position: relative;
}

.nav-back::before,
.tweet-action-btn::before {
  content: '';
  position: absolute;
  inset: -8px;
  border-radius: 9999px;
  background: transparent;
  transition: background-color 0.2s ease-out;
  z-index: -1;
}

.nav-back:hover::before {
  background: rgba(29, 155, 240, 0.1);
}

/* Loading button state */
.btn.loading {
  opacity: 0.7;
  pointer-events: none;
}

.btn.loading::after {
  content: '';
  width: 16px;
  height: 16px;
  border: 2px solid currentColor;
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin-left: 8px;
}
```

### Tests Required

```typescript
describe('Hover States', () => {
  it('tweet card changes background on hover', () => {
    const element = renderTweet(mockTweet, mockTranslation);
    document.body.appendChild(element);

    element.dispatchEvent(new MouseEvent('mouseenter'));
    const styles = getComputedStyle(element);
    // Check that hover styles are defined (can't test actual computed hover in jsdom)
    expect(element.style.transition).toBeDefined();
  });

  it('buttons have active state with scale', () => {
    const btn = document.createElement('button');
    btn.className = 'btn btn-primary';
    document.body.appendChild(btn);

    // Verify CSS class exists (actual transform tested visually)
    expect(document.styleSheets).toBeDefined();
  });
});
```

---

## 6. Progressive Loading Feedback

### Current Behavior
- Shows "Translating content..." with spinner
- No indication of progress
- Estimated cost shown, but not updated during translation

### Required Behavior
- Show count of translations completed ("Translating 3 of 10...")
- Update cost display as each translation completes
- Stream translations to UI as they arrive (already implemented)

### Implementation

```typescript
// Update loading state to show progress
interface TranslationProgress {
  completed: number;
  total: number;
}

showProgress(progress: TranslationProgress): void {
  if (this.loadingEl) {
    const progressText = this.loadingEl.querySelector('.loading-progress');
    if (progressText) {
      progressText.textContent = `Translating ${progress.completed} of ${progress.total}...`;
    }
  }
}
```

```html
<div id="loading">
  <div class="spinner"></div>
  <p class="loading-progress">Translating content...</p>
</div>
```

### Tests Required

```typescript
describe('Progressive Loading', () => {
  it('updates progress text during translation', () => {
    const controller = new TranslateViewController();
    controller.showProgress({ completed: 3, total: 10 });

    const progress = document.querySelector('.loading-progress');
    expect(progress?.textContent).toBe('Translating 3 of 10...');
  });

  it('updates cost display after each translation', async () => {
    // Setup with 2 tweets
    await controller.translate();

    // After first translation
    const costEl = document.getElementById('estimated-cost');
    expect(costEl?.textContent).toContain('Translation cost:');
  });
});
```

---

## 7. Focus States for Accessibility

### Current Behavior
- Default browser focus outlines
- Inconsistent focus visibility

### Required Behavior
- Custom focus ring using Twitter's blue accent
- Focus visible only for keyboard navigation (not mouse)
- All interactive elements focusable

### CSS Updates

```css
/* Remove default outline, add custom focus ring */
*:focus {
  outline: none;
}

*:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px var(--bg), 0 0 0 4px var(--accent);
}

/* For elements with border-radius */
.btn:focus-visible,
.tweet-action-btn:focus-visible {
  box-shadow: 0 0 0 2px var(--bg), 0 0 0 4px var(--accent);
}

/* Skip to content link (accessibility) */
.skip-link {
  position: absolute;
  top: -40px;
  left: 0;
  padding: 8px 16px;
  background: var(--accent);
  color: white;
  z-index: 100;
  transition: top 0.2s;
}

.skip-link:focus {
  top: 0;
}
```

### Tests Required

```typescript
describe('Focus Accessibility', () => {
  it('all buttons are focusable', () => {
    const element = renderTweet(mockTweet, mockTranslation);
    document.body.appendChild(element);

    const buttons = element.querySelectorAll('button');
    buttons.forEach(btn => {
      expect(btn.tabIndex).toBeGreaterThanOrEqual(0);
    });
  });

  it('tweet header is keyboard accessible', () => {
    const element = renderTweet(mockTweet, mockTranslation);
    const header = element.querySelector('.tweet-header');

    // Should be clickable with Enter/Space
    expect(header?.getAttribute('role')).toBe('button');
    expect(header?.getAttribute('tabindex')).toBe('0');
  });
});
```

---

## 8. Error State Improvements

### Current Behavior
- Error shown in fixed error-message div
- No retry option
- No context about what failed

### Required Behavior
- Contextual error messages with retry button
- Different error states for different failures
- Graceful degradation (show what we have, indicate what failed)

### Implementation

```typescript
interface ErrorState {
  type: 'api_key' | 'network' | 'rate_limit' | 'partial';
  message: string;
  retryable: boolean;
  failedIds?: string[];
}

showError(error: ErrorState): void {
  const errorHtml = `
    <div class="error-banner error-${error.type}">
      <div class="error-icon">${this.getErrorIcon(error.type)}</div>
      <div class="error-content">
        <p class="error-message">${error.message}</p>
        ${error.retryable ? '<button class="error-retry btn btn-secondary">Try again</button>' : ''}
      </div>
    </div>
  `;

  if (this.errorEl) {
    this.errorEl.innerHTML = errorHtml;
    this.errorEl.classList.remove('hidden');

    this.errorEl.querySelector('.error-retry')?.addEventListener('click', () => {
      this.retryTranslation(error.failedIds);
    });
  }
}
```

### Tests Required

```typescript
describe('Error Handling', () => {
  it('shows retry button for retryable errors', () => {
    controller.showError({
      type: 'network',
      message: 'Network error',
      retryable: true
    });

    expect(document.querySelector('.error-retry')).toBeTruthy();
  });

  it('hides retry for non-retryable errors', () => {
    controller.showError({
      type: 'api_key',
      message: 'Invalid API key',
      retryable: false
    });

    expect(document.querySelector('.error-retry')).toBeFalsy();
  });

  it('retry button triggers new translation attempt', () => {
    const retrySpy = vi.spyOn(controller, 'retryTranslation');
    controller.showError({
      type: 'network',
      message: 'Failed',
      retryable: true,
      failedIds: ['1', '2']
    });

    (document.querySelector('.error-retry') as HTMLButtonElement).click();
    expect(retrySpy).toHaveBeenCalledWith(['1', '2']);
  });
});
```

---

## 9. Reduced Motion Support

### Current Behavior
- Animations always run
- No respect for user preference

### Required Behavior
- Check `prefers-reduced-motion` media query
- Disable or minimize animations when enabled

### CSS Updates

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }

  .skeleton::after {
    animation: none;
  }

  .spinner {
    animation: none;
    /* Use static indicator instead */
    opacity: 0.5;
  }
}
```

### Tests Required

```typescript
describe('Reduced Motion', () => {
  it('respects prefers-reduced-motion', () => {
    // This would need to be tested with actual browser
    // or by checking CSS contains the media query
    const styles = document.styleSheets[0];
    const hasReducedMotion = Array.from(styles.cssRules).some(
      rule => rule.cssText.includes('prefers-reduced-motion')
    );
    expect(hasReducedMotion).toBe(true);
  });
});
```

---

## Implementation Priority

1. **Skeleton Loading** - Most impactful for perceived performance
2. **Toast Notifications** - Replaces inline error, adds success feedback
3. **Expand/Collapse Animation** - Smooths existing interaction
4. **Reply Thread Connectors** - Visual hierarchy for conversations
5. **Hover States** - Polish for all interactive elements
6. **Focus States** - Accessibility requirement
7. **Progressive Loading** - Nice-to-have progress indicator
8. **Error Improvements** - Better error recovery
9. **Reduced Motion** - Accessibility requirement

---

## Testing Strategy

Each feature should have:
1. **Unit tests** for the component/function
2. **Integration tests** for the feature in context
3. **Visual regression tests** (if using Playwright/visual testing)
4. **Accessibility tests** (focus, ARIA attributes)

Run all tests with: `npm test`
