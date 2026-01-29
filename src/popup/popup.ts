import { MESSAGE_TYPES } from '../background';

export function formatCost(cost: number): string {
  return `$${cost.toFixed(2)}`;
}

export class PopupController {
  private translateBtn: HTMLElement | null;
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
  }

  private bindEvents(): void {
    this.translateBtn?.addEventListener('click', () => this.translateCurrentPage());
    this.settingsBtn?.addEventListener('click', () => this.showSettings());
    this.saveSettingsBtn?.addEventListener('click', () => this.saveSettings());
    this.backBtn?.addEventListener('click', () => this.showMain());
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

      if (this.costThisWeek) {
        this.costThisWeek.textContent = formatCost(stats.thisWeek);
      }
      if (this.costThisMonth) {
        this.costThisMonth.textContent = formatCost(stats.thisMonth);
      }
      if (this.costAllTime) {
        this.costAllTime.textContent = formatCost(stats.allTime);
      }
    } catch (error) {
      console.error('Failed to load cost stats:', error);
    }
  }

  async saveSettings(): Promise<void> {
    try {
      const apiKey = this.apiKeyInput?.value || '';
      const commentLimit = parseInt(this.commentLimitInput?.value || '10', 10);

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

      await browser.tabs.sendMessage(tab.id, {
        type: MESSAGE_TYPES.SCRAPE_PAGE,
      });

      window.close();
    } catch (error) {
      console.error('Failed to translate:', error);
      this.showStatus('Failed to start translation');
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
