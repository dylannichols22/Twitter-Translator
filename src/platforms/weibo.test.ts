import { describe, expect, it } from 'vitest';
import { weiboPlatform } from './weibo';

describe('weiboPlatform', () => {
  it('extracts post id from mobile detail URLs', () => {
    const url = 'https://m.weibo.cn/detail/5261077984314647';
    expect(weiboPlatform.isThreadUrl(url)).toBe(true);
    expect(weiboPlatform.extractPostId(url)).toBe('5261077984314647');
  });

  it('extracts post id from elements containing mobile detail links', () => {
    const container = document.createElement('div');
    container.innerHTML = '<a href="https://m.weibo.cn/detail/5261077984314647">detail</a>';
    expect(weiboPlatform.extractPostIdFromElement(container)).toBe('5261077984314647');
  });

  it('extracts post id from elements with data-mid', () => {
    const element = document.createElement('div');
    element.setAttribute('data-mid', '5261077984314647');
    expect(weiboPlatform.extractPostIdFromElement(element)).toBe('5261077984314647');
  });

  it('falls back to URL id for weibo main article when element lacks attributes', () => {
    const element = document.createElement('article');
    element.className = 'weibo-main';
    Object.defineProperty(window, 'location', {
      value: { href: 'https://m.weibo.cn/detail/5261077984314647' },
      writable: true,
      configurable: true,
    });
    expect(weiboPlatform.extractPostIdFromElement(element)).toBe('5261077984314647');
  });

  it('falls back to URL id for woo-panel main article when element lacks attributes', () => {
    const element = document.createElement('article');
    element.className = 'woo-panel-main';
    Object.defineProperty(window, 'location', {
      value: { href: 'https://weibo.com/3036474003/QpvUKvcOp' },
      writable: true,
      configurable: true,
    });
    expect(weiboPlatform.extractPostIdFromElement(element)).toBe('QpvUKvcOp');
  });
});
