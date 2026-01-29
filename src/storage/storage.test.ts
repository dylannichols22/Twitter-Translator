import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  DEFAULT_SETTINGS,
  StorageManager,
} from './storage';

// Mock the browser storage API
const mockStorage: Record<string, string> = {};

const mockBrowserStorage = {
  local: {
    get: vi.fn((keys: string[]) => {
      const result: Record<string, unknown> = {};
      for (const key of keys) {
        if (mockStorage[key]) {
          result[key] = JSON.parse(mockStorage[key]);
        }
      }
      return Promise.resolve(result);
    }),
    set: vi.fn((items: Record<string, unknown>) => {
      for (const [key, value] of Object.entries(items)) {
        mockStorage[key] = JSON.stringify(value);
      }
      return Promise.resolve();
    }),
    remove: vi.fn((keys: string[]) => {
      for (const key of keys) {
        delete mockStorage[key];
      }
      return Promise.resolve();
    }),
  },
};

// @ts-expect-error - mocking browser global
globalThis.browser = { storage: mockBrowserStorage };

describe('Storage Module', () => {
  beforeEach(() => {
    // Clear mock storage
    for (const key of Object.keys(mockStorage)) {
      delete mockStorage[key];
    }
    vi.clearAllMocks();
  });

  describe('DEFAULT_SETTINGS', () => {
    it('has sensible defaults', () => {
      expect(DEFAULT_SETTINGS.apiKey).toBe('');
      expect(DEFAULT_SETTINGS.commentLimit).toBeGreaterThan(0);
      expect(typeof DEFAULT_SETTINGS.commentLimit).toBe('number');
    });
  });

  describe('StorageManager', () => {
    let storage: StorageManager;

    beforeEach(() => {
      storage = new StorageManager();
    });

    describe('getSettings', () => {
      it('returns default settings when storage is empty', async () => {
        const settings = await storage.getSettings();
        expect(settings).toEqual(DEFAULT_SETTINGS);
      });

      it('returns stored settings', async () => {
        mockStorage['settings'] = JSON.stringify({
          apiKey: 'test-key',
          commentLimit: 20,
        });

        const settings = await storage.getSettings();
        expect(settings.apiKey).toBe('test-key');
        expect(settings.commentLimit).toBe(20);
      });

      it('merges stored settings with defaults', async () => {
        mockStorage['settings'] = JSON.stringify({
          apiKey: 'test-key',
        });

        const settings = await storage.getSettings();
        expect(settings.apiKey).toBe('test-key');
        expect(settings.commentLimit).toBe(DEFAULT_SETTINGS.commentLimit);
      });
    });

    describe('saveSettings', () => {
      it('saves settings to storage', async () => {
        await storage.saveSettings({
          apiKey: 'new-key',
          commentLimit: 30,
        });

        expect(mockBrowserStorage.local.set).toHaveBeenCalled();
        const saved = JSON.parse(mockStorage['settings']);
        expect(saved.apiKey).toBe('new-key');
        expect(saved.commentLimit).toBe(30);
      });

      it('validates comment limit is positive', async () => {
        await expect(
          storage.saveSettings({
            apiKey: '',
            commentLimit: -5,
          })
        ).rejects.toThrow('Comment limit must be positive');
      });

      it('validates comment limit is a number', async () => {
        await expect(
          storage.saveSettings({
            apiKey: '',
            // @ts-expect-error - testing runtime validation
            commentLimit: 'invalid',
          })
        ).rejects.toThrow('Comment limit must be a number');
      });
    });

    describe('getApiKey', () => {
      it('returns empty string when not set', async () => {
        const key = await storage.getApiKey();
        expect(key).toBe('');
      });

      it('returns stored API key', async () => {
        mockStorage['settings'] = JSON.stringify({
          apiKey: 'stored-key',
          commentLimit: 10,
        });

        const key = await storage.getApiKey();
        expect(key).toBe('stored-key');
      });
    });

    describe('setApiKey', () => {
      it('saves API key to settings', async () => {
        await storage.setApiKey('new-api-key');

        const saved = JSON.parse(mockStorage['settings']);
        expect(saved.apiKey).toBe('new-api-key');
      });

      it('preserves other settings when updating API key', async () => {
        mockStorage['settings'] = JSON.stringify({
          apiKey: 'old-key',
          commentLimit: 25,
        });

        await storage.setApiKey('new-api-key');

        const saved = JSON.parse(mockStorage['settings']);
        expect(saved.apiKey).toBe('new-api-key');
        expect(saved.commentLimit).toBe(25);
      });
    });

    describe('getCostData', () => {
      it('returns empty string when not set', async () => {
        const data = await storage.getCostData();
        expect(data).toBe('');
      });

      it('returns stored cost data', async () => {
        mockStorage['costData'] = JSON.stringify('serialized-cost-data');

        const data = await storage.getCostData();
        expect(data).toBe('serialized-cost-data');
      });
    });

    describe('saveCostData', () => {
      it('saves cost data to storage', async () => {
        await storage.saveCostData('cost-data-string');

        expect(mockBrowserStorage.local.set).toHaveBeenCalled();
        const saved = JSON.parse(mockStorage['costData']);
        expect(saved).toBe('cost-data-string');
      });
    });

    describe('clearAll', () => {
      it('clears all stored data', async () => {
        mockStorage['settings'] = JSON.stringify({ apiKey: 'key' });
        mockStorage['costData'] = JSON.stringify('data');

        await storage.clearAll();

        expect(mockBrowserStorage.local.remove).toHaveBeenCalledWith(['settings', 'costData']);
      });
    });
  });
});
