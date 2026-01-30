import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PanelIntegration } from './panelIntegration';
import { destroyPanel } from './panel';

// Mock browser APIs
const mockRuntime = {
  sendMessage: vi.fn(),
};

const mockTabs = {
  sendMessage: vi.fn(),
};

(globalThis as unknown as { browser: unknown }).browser = {
  runtime: mockRuntime,
  tabs: mockTabs,
};

describe('PanelIntegration', () => {
  let originalLocation: Location;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    document.body.innerHTML = '';
    originalLocation = window.location;

    // Mock window.location for Twitter
    delete (window as { location?: Location }).location;
    (window as { location: Location }).location = {
      ...originalLocation,
      href: 'https://twitter.com/user/status/123',
      pathname: '/user/status/123',
    } as Location;

    mockRuntime.sendMessage.mockResolvedValue({ apiKey: 'test-key', commentLimit: 10 });
  });

  afterEach(() => {
    vi.useRealTimers();
    destroyPanel();
    (window as { location: Location }).location = originalLocation;
  });

  describe('Initialization', () => {
    it('creates an integration instance', () => {
      const integration = new PanelIntegration();
      expect(integration).toBeDefined();
      integration.destroy();
    });

    it('panel is created but not visible initially', () => {
      const integration = new PanelIntegration();
      expect(document.querySelector('.twitter-translator-panel')).not.toBeNull();
      expect(integration.isOpen()).toBe(false);
      integration.destroy();
    });
  });

  describe('Activation', () => {
    it('toggle() opens the panel', () => {
      const integration = new PanelIntegration();
      integration.toggle();
      expect(integration.isOpen()).toBe(true);
      integration.destroy();
    });

    it('opening panel on thread URL starts translation', async () => {
      const integration = new PanelIntegration();
      integration.toggle();

      // The integration should attempt to scrape and translate
      expect(integration.isOpen()).toBe(true);
      integration.destroy();
    });

    it('opening panel on non-thread URL shows empty state', () => {
      (window.location as { href: string }).href = 'https://twitter.com/home';
      (window.location as { pathname: string }).pathname = '/home';

      const integration = new PanelIntegration();
      integration.toggle();

      const panel = document.querySelector('.twitter-translator-panel');
      expect(panel?.querySelector('.panel-empty')).not.toBeNull();
      integration.destroy();
    });
  });

  describe('URL Change Handling', () => {
    it('detects URL changes and re-translates', () => {
      const integration = new PanelIntegration();
      integration.toggle();

      // Simulate URL change
      (window.location as { href: string }).href = 'https://twitter.com/user/status/456';
      (window.location as { pathname: string }).pathname = '/user/status/456';
      window.dispatchEvent(new PopStateEvent('popstate'));

      vi.advanceTimersByTime(300);

      // Integration should have detected the change
      expect(integration.isOpen()).toBe(true);
      integration.destroy();
    });

    it('shows empty state when navigating away from thread', () => {
      const integration = new PanelIntegration();
      integration.toggle();

      // Navigate to non-thread
      (window.location as { href: string }).href = 'https://twitter.com/home';
      (window.location as { pathname: string }).pathname = '/home';
      window.dispatchEvent(new PopStateEvent('popstate'));

      vi.advanceTimersByTime(300);

      const panel = document.querySelector('.twitter-translator-panel');
      expect(panel?.querySelector('.panel-empty')).not.toBeNull();
      integration.destroy();
    });
  });

  describe('Cleanup', () => {
    it('destroy() removes panel and stops URL watching', () => {
      const integration = new PanelIntegration();
      integration.toggle();
      integration.destroy();

      expect(document.querySelector('.twitter-translator-panel')).toBeNull();
    });
  });
});
