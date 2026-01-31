import { MESSAGE_TYPES } from '../messages';
import { isTwitterUrl } from '../utils/twitter';

export function formatCost(cost: number): string {
  return `$${cost.toFixed(2)}`;
}

export class PopupController {
  private translateBtn: HTMLElement | null;
  private togglePanelBtn: HTMLElement | null;
  private viewSavedBtn: HTMLElement | null;
  private settingsBtn: HTMLElement | null;
  private saveSettingsBtn: HTMLElement | null;
  private backBtn: HTMLElement | null;
  private mainView: HTMLElement | null;
  private settingsView: HTMLElement | null;
  private apiKeyInput: HTMLInputElement | null;
  private commentLimitInput: HTMLInputElement | null;
  private costThisWeek: HTMLElement | null;
  private costThisMonth: HTMLElement | null;
  private costAllTime: HTMLElement | null;
  private statusMessage: HTMLElement | null;

  constructor() {
    this.translateBtn = document.getElementById('translate-btn');
    this.togglePanelBtn = document.getElementById('toggle-panel-btn');
    this.viewSavedBtn = document.getElementById('view-saved-btn');
    this.settingsBtn = document.getElementById('settings-btn');
    this.saveSettingsBtn = document.getElementById('save-settings-btn');
    this.backBtn = document.getElementById('back-btn');
    this.mainView = document.getElementById('main-view');
    this.settingsView = document.getElementById('settings-view');
    this.apiKeyInput = document.getElementById('api-key-input') as HTMLInputElement;
    this.commentLimitInput = document.getElementById('comment-limit-input') as HTMLInputElement;
    this.costThisWeek = document.getElementById('cost-this-week');
    this.costThisMonth = document.getElementById('cost-this-month');
    this.costAllTime = document.getElementById('cost-all-time');
    this.statusMessage = document.getElementById('status-message');

    this.bindEvents();
    void this.updatePanelToggleVisibility();
    void this.applyAndroidLayout();
  }

  private bindEvents(): void {
    this.translateBtn?.addEventListener('click', () => this.translateCurrentPage());
    this.togglePanelBtn?.addEventListener('click', () => this.togglePanel());
    this.viewSavedBtn?.addEventListener('click', () => this.openSavedPage());
    this.settingsBtn?.addEventListener('click', () => this.showSettings());
    this.saveSettingsBtn?.addEventListener('click', () => this.saveSettings());
    this.backBtn?.addEventListener('click', () => this.showMain());
  }

  async openSavedPage(): Promise<void> {
    await browser.tabs.create({
      url: browser.runtime.getURL('saved.html'),
    });
    window.close();
  }

  private async updatePanelToggleVisibility(): Promise<void> {
    if (!this.togglePanelBtn) {
      return;
    }

    try {
      const tabs = await browser.tabs.query({ active: true, currentWindow: true });
      const url = tabs[0]?.url ?? '';
      const isTwitter = isTwitterUrl(url);
      this.togglePanelBtn.classList.toggle('hidden', !isTwitter);
    } catch (error) {
      console.error('Failed to determine active tab:', error);
      this.togglePanelBtn.classList.add('hidden');
    }
  }

  private async applyAndroidLayout(): Promise<void> {
    if (!this.togglePanelBtn) {
      return;
    }

    try {
      const platform = await browser.runtime.getPlatformInfo?.();
      if (platform?.os === 'android') {
        this.togglePanelBtn.classList.add('hidden');
      }
    } catch (error) {
      console.error('Failed to detect platform:', error);
    }
  }

  async loadSettings(): Promise<void> {
    try {
      const settings = await browser.runtime.sendMessage({
        type: MESSAGE_TYPES.GET_SETTINGS,
      });

      if (this.apiKeyInput) {
        this.apiKeyInput.value = settings.apiKey || '';
      }
      if (this.commentLimitInput) {
        this.commentLimitInput.value = String(settings.commentLimit || 10);
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  }

  async loadCostStats(): Promise<void> {
    try {
      const stats = await browser.runtime.sendMessage({
        type: MESSAGE_TYPES.GET_COST_STATS,
      });

      const thisWeek = typeof stats?.thisWeek === 'number' ? stats.thisWeek : 0;
      const thisMonth = typeof stats?.thisMonth === 'number' ? stats.thisMonth : 0;
      const allTime = typeof stats?.allTime === 'number' ? stats.allTime : 0;

      if (this.costThisWeek) {
        this.costThisWeek.textContent = formatCost(thisWeek);
      }
      if (this.costThisMonth) {
        this.costThisMonth.textContent = formatCost(thisMonth);
      }
      if (this.costAllTime) {
        this.costAllTime.textContent = formatCost(allTime);
      }
    } catch (error) {
      console.error('Failed to load cost stats:', error);
    }
  }

  async saveSettings(): Promise<void> {
    try {
      const apiKey = this.apiKeyInput?.value || '';
      const parsed = Number.parseInt(this.commentLimitInput?.value || '10', 10);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        this.showStatus('Comment limit must be a positive number');
        if (this.commentLimitInput) {
          this.commentLimitInput.value = '10';
        }
        return;
      }
      const commentLimit = parsed;

      await browser.runtime.sendMessage({
        type: MESSAGE_TYPES.SAVE_SETTINGS,
        data: { apiKey, commentLimit },
      });

      this.showStatus('Settings saved!');
    } catch (error) {
      console.error('Failed to save settings:', error);
      this.showStatus('Failed to save settings');
    }
  }

  async translateCurrentPage(): Promise<void> {
    try {
      const tabs = await browser.tabs.query({ active: true, currentWindow: true });
      const tab = tabs[0];

      if (!tab?.id) {
        this.showStatus('No active tab found');
        return;
      }

      const response = await browser.tabs.sendMessage(tab.id, {
        type: MESSAGE_TYPES.SCRAPE_PAGE,
      });

      if (!response?.success || !response.tweets) {
        this.showStatus(response?.error || 'Failed to scrape page');
        return;
      }

      await browser.runtime.sendMessage({
        type: MESSAGE_TYPES.OPEN_TRANSLATE_PAGE,
        data: {
          tweets: response.tweets,
          url: response.url || tab.url || '',
          sourceTabId: tab.id,
        },
      });

      window.close();
    } catch (error) {
      console.error('Failed to translate:', error);
      this.showStatus('Failed to start translation');
    }
  }

  async togglePanel(): Promise<void> {
    try {
      const tabs = await browser.tabs.query({ active: true, currentWindow: true });
      const tab = tabs[0];

      if (!tab?.id) {
        this.showStatus('No active tab found');
        return;
      }

      if (!isTwitterUrl(tab.url || '')) {
        this.showStatus('Open Twitter to toggle the panel');
        return;
      }

      await browser.tabs.sendMessage(tab.id, {
        type: MESSAGE_TYPES.TOGGLE_PANEL,
      });

      window.close();
    } catch (error) {
      console.error('Failed to toggle panel:', error);
      this.showStatus('Failed to toggle panel');
    }
  }

  showSettings(): void {
    this.mainView?.classList.add('hidden');
    this.settingsView?.classList.remove('hidden');
    this.loadSettings();
    this.loadCostStats();
  }

  showMain(): void {
    this.settingsView?.classList.add('hidden');
    this.mainView?.classList.remove('hidden');
  }

  private showStatus(message: string): void {
    if (this.statusMessage) {
      this.statusMessage.textContent = message;
      setTimeout(() => {
        if (this.statusMessage) {
          this.statusMessage.textContent = '';
        }
      }, 3000);
    }
  }
}

// Initialize when DOM is ready (only in actual popup, not tests)
if (typeof document !== 'undefined' && document.readyState !== 'loading') {
  new PopupController();
} else if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => new PopupController());
}
