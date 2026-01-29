export interface Settings {
  apiKey: string;
  commentLimit: number;
}

export const DEFAULT_SETTINGS: Settings = {
  apiKey: '',
  commentLimit: 10, // Default to 10 comments
};

const STORAGE_KEYS = {
  settings: 'settings',
  costData: 'costData',
} as const;

export class StorageManager {
  async getSettings(): Promise<Settings> {
    const result = await browser.storage.local.get([STORAGE_KEYS.settings]);
    const stored = result[STORAGE_KEYS.settings] as Partial<Settings> | undefined;

    return {
      ...DEFAULT_SETTINGS,
      ...stored,
    };
  }

  async saveSettings(settings: Settings): Promise<void> {
    if (typeof settings.commentLimit !== 'number') {
      throw new Error('Comment limit must be a number');
    }
    if (settings.commentLimit <= 0) {
      throw new Error('Comment limit must be positive');
    }

    await browser.storage.local.set({
      [STORAGE_KEYS.settings]: settings,
    });
  }

  async getApiKey(): Promise<string> {
    const settings = await this.getSettings();
    return settings.apiKey;
  }

  async setApiKey(apiKey: string): Promise<void> {
    const settings = await this.getSettings();
    settings.apiKey = apiKey;
    await this.saveSettings(settings);
  }

  async getCostData(): Promise<string> {
    const result = await browser.storage.local.get([STORAGE_KEYS.costData]);
    return (result[STORAGE_KEYS.costData] as string) || '';
  }

  async saveCostData(data: string): Promise<void> {
    await browser.storage.local.set({
      [STORAGE_KEYS.costData]: data,
    });
  }

  async clearAll(): Promise<void> {
    await browser.storage.local.remove([STORAGE_KEYS.settings, STORAGE_KEYS.costData]);
  }
}
