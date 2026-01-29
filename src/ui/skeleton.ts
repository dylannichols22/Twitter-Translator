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

export function renderSkeletonContainer(count = 3): DocumentFragment {
  const fragment = document.createDocumentFragment();
  for (let i = 0; i < count; i++) {
    fragment.appendChild(renderTweetSkeleton());
  }
  return fragment;
}
