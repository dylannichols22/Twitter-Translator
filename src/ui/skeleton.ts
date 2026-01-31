export function renderTweetSkeleton(): HTMLElement {
  const article = document.createElement('article');
  article.className = 'tweet-card tweet-skeleton';

  const shell = document.createElement('div');
  shell.className = 'tweet-shell';

  const avatar = document.createElement('div');
  avatar.className = 'skeleton skeleton-avatar';
  shell.appendChild(avatar);

  const body = document.createElement('div');
  body.className = 'tweet-body';

  const header = document.createElement('div');
  header.className = 'tweet-header';

  const author = document.createElement('span');
  author.className = 'skeleton skeleton-author';
  header.appendChild(author);

  const timestamp = document.createElement('span');
  timestamp.className = 'skeleton skeleton-timestamp';
  header.appendChild(timestamp);

  body.appendChild(header);

  const text1 = document.createElement('div');
  text1.className = 'skeleton skeleton-text skeleton-text-1';
  body.appendChild(text1);

  const text2 = document.createElement('div');
  text2.className = 'skeleton skeleton-text skeleton-text-2';
  body.appendChild(text2);

  const text3 = document.createElement('div');
  text3.className = 'skeleton skeleton-text skeleton-text-3';
  body.appendChild(text3);

  shell.appendChild(body);
  article.appendChild(shell);
  return article;
}

export function renderSkeletonContainer(count = 3): DocumentFragment {
  const fragment = document.createDocumentFragment();
  for (let i = 0; i < count; i++) {
    fragment.appendChild(renderTweetSkeleton());
  }
  return fragment;
}
