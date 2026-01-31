import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  formatCost,
  PopupController,
} from './popup';

// Mock browser APIs
const mockTabs = {
  query: vi.fn(),
  sendMessage: vi.fn(),
};

const mockRuntime = {
  sendMessage: vi.fn(),
  getPlatformInfo: vi.fn(),
};

(globalThis as unknown as { browser: unknown }).browser = {
  tabs: mockTabs,
  runtime: mockRuntime,
};

describe('Popup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = '';
  });

  describe('formatCost', () => {
    it('formats cost as USD currency', () => {
      expect(formatCost(0.0123)).toBe('$0.01');
      expect(formatCost(1.5)).toBe('$1.50');
      expect(formatCost(0)).toBe('$0.00');
    });

    it('handles very small costs', () => {
      expect(formatCost(0.001)).toBe('$0.00');
      expect(formatCost(0.005)).toBe('$0.01');
    });

    it('handles larger costs', () => {
      expect(formatCost(10.99)).toBe('$10.99');
      expect(formatCost(100)).toBe('$100.00');
    });
  });

  describe('PopupController', () => {
    let controller: PopupController;

    beforeEach(() => {
      mockTabs.query.mockResolvedValue([]);
      mockRuntime.getPlatformInfo.mockResolvedValue({ os: 'win' });
      document.body.innerHTML = `
        <div id="translate-btn"></div>
        <button id="toggle-panel-btn" class="hidden"></button>
        <div id="settings-btn"></div>
        <div id="main-view"></div>
        <div id="settings-view" class="hidden"></div>
        <input id="api-key-input" type="password" />
        <input id="comment-limit-input" type="number" />
        <button id="save-settings-btn"></button>
        <button id="back-btn"></button>
        <div id="cost-this-week"></div>
        <div id="cost-this-month"></div>
        <div id="cost-all-time"></div>
        <div id="status-message"></div>
      `;

      controller = new PopupController();
    });

    describe('initialization', () => {
      it('binds event listeners to DOM elements', () => {
        const translateBtn = document.getElementById('translate-btn');
        const settingsBtn = document.getElementById('settings-btn');

        expect(translateBtn).toBeTruthy();
        expect(settingsBtn).toBeTruthy();
      });

      it('hides panel toggle on Android', async () => {
        const toggleBtn = document.getElementById('toggle-panel-btn');
        toggleBtn?.classList.remove('hidden');

        mockRuntime.getPlatformInfo.mockResolvedValue({ os: 'android' });

        await (controller as unknown as { applyAndroidLayout: () => Promise<void> }).applyAndroidLayout();

        expect(toggleBtn?.classList.contains('hidden')).toBe(true);
      });
    });

    describe('loadSettings', () => {
      it('loads settings from background script', async () => {
        mockRuntime.sendMessage.mockResolvedValue({
          apiKey: 'test-key',
          commentLimit: 15,
        });

        await controller.loadSettings();

        const apiKeyInput = document.getElementById('api-key-input') as HTMLInputElement;
        const commentLimitInput = document.getElementById('comment-limit-input') as HTMLInputElement;

        expect(apiKeyInput.value).toBe('test-key');
        expect(commentLimitInput.value).toBe('15');
      });
    });

    describe('loadCostStats', () => {
      it('loads cost statistics from background script', async () => {
        mockRuntime.sendMessage.mockResolvedValue({
          thisWeek: 0.05,
          thisMonth: 0.25,
          allTime: 1.50,
        });

        await controller.loadCostStats();

        const weekEl = document.getElementById('cost-this-week');
        const monthEl = document.getElementById('cost-this-month');
        const allTimeEl = document.getElementById('cost-all-time');

        expect(weekEl?.textContent).toBe('$0.05');
        expect(monthEl?.textContent).toBe('$0.25');
        expect(allTimeEl?.textContent).toBe('$1.50');
      });

      it('handles missing cost stats gracefully', async () => {
        mockRuntime.sendMessage.mockResolvedValue({});

        await controller.loadCostStats();

        const weekEl = document.getElementById('cost-this-week');
        const monthEl = document.getElementById('cost-this-month');
        const allTimeEl = document.getElementById('cost-all-time');

        expect(weekEl?.textContent).toBe('$0.00');
        expect(monthEl?.textContent).toBe('$0.00');
        expect(allTimeEl?.textContent).toBe('$0.00');
      });
    });

    describe('saveSettings', () => {
      it('saves settings via background script', async () => {
        mockRuntime.sendMessage.mockResolvedValue({ success: true });

        const apiKeyInput = document.getElementById('api-key-input') as HTMLInputElement;
        const commentLimitInput = document.getElementById('comment-limit-input') as HTMLInputElement;

        apiKeyInput.value = 'new-api-key';
        commentLimitInput.value = '20';

        await controller.saveSettings();

        expect(mockRuntime.sendMessage).toHaveBeenCalledWith({
          type: 'SAVE_SETTINGS',
          data: {
            apiKey: 'new-api-key',
            commentLimit: 20,
          },
        });
      });

      it('shows success message after saving', async () => {
        mockRuntime.sendMessage.mockResolvedValue({ success: true });

        const apiKeyInput = document.getElementById('api-key-input') as HTMLInputElement;
        const commentLimitInput = document.getElementById('comment-limit-input') as HTMLInputElement;
        apiKeyInput.value = 'key';
        commentLimitInput.value = '10';

        await controller.saveSettings();

        const statusEl = document.getElementById('status-message');
        expect(statusEl?.textContent).toContain('saved');
      });
    });

    describe('translateCurrentPage', () => {
      it('sends message to current tab to trigger translation', async () => {
        mockTabs.query.mockResolvedValue([{ id: 123 }]);
        mockTabs.sendMessage.mockResolvedValue({
          success: true,
          tweets: [{ id: '1', text: 'test', author: 'a', timestamp: '', isMainPost: true }],
          url: 'https://twitter.com/user/status/1',
        });

        await controller.translateCurrentPage();

        expect(mockTabs.query).toHaveBeenCalledWith({
          active: true,
          currentWindow: true,
        });
        expect(mockTabs.sendMessage).toHaveBeenCalledWith(123, {
          type: 'SCRAPE_PAGE',
        });
        expect(mockRuntime.sendMessage).toHaveBeenCalledWith({
          type: 'OPEN_TRANSLATE_PAGE',
          data: {
            tweets: [{ id: '1', text: 'test', author: 'a', timestamp: '', isMainPost: true }],
            url: 'https://twitter.com/user/status/1',
            sourceTabId: 123,
          },
        });
      });

      it('handles no active tab gracefully', async () => {
        mockTabs.query.mockResolvedValue([]);

        await expect(controller.translateCurrentPage()).resolves.not.toThrow();
      });

      it('shows error when scraping fails', async () => {
        mockTabs.query.mockResolvedValue([{ id: 123 }]);
        mockTabs.sendMessage.mockResolvedValue({ success: false, error: 'Not a Twitter page' });

        await controller.translateCurrentPage();

        expect(mockRuntime.sendMessage).not.toHaveBeenCalled();
        const statusEl = document.getElementById('status-message');
        expect(statusEl?.textContent).toContain('Not a Twitter page');
      });
    });

    describe('togglePanel', () => {
      it('sends toggle panel message to current Twitter tab', async () => {
        mockTabs.query.mockResolvedValue([{ id: 456, url: 'https://twitter.com/home' }]);
        mockTabs.sendMessage.mockResolvedValue({ success: true });

        await controller.togglePanel();

        expect(mockTabs.sendMessage).toHaveBeenCalledWith(456, {
          type: 'TOGGLE_PANEL',
        });
      });

      it('hides toggle panel button on non-Twitter pages', async () => {
        mockTabs.query.mockResolvedValue([{ id: 456, url: 'https://example.com' }]);

        await (controller as unknown as { updatePanelToggleVisibility: () => Promise<void> }).updatePanelToggleVisibility();

        const toggleBtn = document.getElementById('toggle-panel-btn');
        expect(toggleBtn?.classList.contains('hidden')).toBe(true);
      });
    });

    describe('view switching', () => {
      it('shows settings view when settings button clicked', () => {
        controller.showSettings();

        const mainView = document.getElementById('main-view');
        const settingsView = document.getElementById('settings-view');

        expect(mainView?.classList.contains('hidden')).toBe(true);
        expect(settingsView?.classList.contains('hidden')).toBe(false);
      });

      it('shows main view when back button clicked', () => {
        controller.showSettings();
        controller.showMain();

        const mainView = document.getElementById('main-view');
        const settingsView = document.getElementById('settings-view');

        expect(mainView?.classList.contains('hidden')).toBe(false);
        expect(settingsView?.classList.contains('hidden')).toBe(true);
      });
    });
  });

  describe('Popup HTML', () => {
    it('includes privacy note in settings view', () => {
      const html = readFileSync('popup.html', 'utf-8');
      expect(html).toContain("Tweet content is sent to Anthropic's API");
    });
  });
});
