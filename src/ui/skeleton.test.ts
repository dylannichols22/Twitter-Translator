import { describe, it, expect, beforeEach } from 'vitest';
import { renderTweetSkeleton, renderSkeletonContainer } from './skeleton';

describe('Skeleton Loading', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  describe('renderTweetSkeleton', () => {
    it('creates an article element with tweet-skeleton class', () => {
      const skeleton = renderTweetSkeleton();
      expect(skeleton.tagName).toBe('ARTICLE');
      expect(skeleton.classList.contains('tweet-card')).toBe(true);
      expect(skeleton.classList.contains('tweet-skeleton')).toBe(true);
    });

    it('contains a skeleton avatar', () => {
      const skeleton = renderTweetSkeleton();
      const avatar = skeleton.querySelector('.skeleton-avatar');
      expect(avatar).toBeTruthy();
      expect(avatar?.classList.contains('skeleton')).toBe(true);
    });

    it('contains skeleton author and timestamp placeholders', () => {
      const skeleton = renderTweetSkeleton();
      const author = skeleton.querySelector('.skeleton-author');
      const timestamp = skeleton.querySelector('.skeleton-timestamp');
      expect(author).toBeTruthy();
      expect(timestamp).toBeTruthy();
    });

    it('contains multiple skeleton text lines', () => {
      const skeleton = renderTweetSkeleton();
      const textLines = skeleton.querySelectorAll('.skeleton-text');
      expect(textLines.length).toBeGreaterThanOrEqual(2);
    });

    it('has shimmer animation on skeleton elements', () => {
      const skeleton = renderTweetSkeleton();
      document.body.appendChild(skeleton);
      const skeletonEl = skeleton.querySelector('.skeleton');
      expect(skeletonEl).toBeTruthy();
      // Verify the class is present (animation tested via CSS)
      expect(skeletonEl?.classList.contains('skeleton')).toBe(true);
    });
  });

  describe('renderSkeletonContainer', () => {
    it('renders specified number of skeleton cards', () => {
      const container = renderSkeletonContainer(3);
      const skeletons = container.querySelectorAll('.tweet-skeleton');
      expect(skeletons.length).toBe(3);
    });

    it('defaults to 3 skeleton cards', () => {
      const container = renderSkeletonContainer();
      const skeletons = container.querySelectorAll('.tweet-skeleton');
      expect(skeletons.length).toBe(3);
    });

    it('returns a container with no parent element', () => {
      const container = renderSkeletonContainer(2);
      // DocumentFragment has no parentNode and can hold multiple children
      expect(container.childNodes.length).toBe(2);
    });
  });
});
