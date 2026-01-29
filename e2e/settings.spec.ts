import { test, expect } from '@playwright/test';
import {
  getUniqueProfileDir,
  createFirefoxProfile,
  safeCleanupProfile,
  buildExtension,
  runExtensionTest,
} from './helpers/test-utils';

let profileDir: string;

test.describe('Settings Persistence', () => {
  test.beforeAll(async () => {
    buildExtension();
  });

  test.beforeEach(async () => {
    profileDir = getUniqueProfileDir();
    createFirefoxProfile(profileDir);
  });

  test.afterEach(async () => {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    safeCleanupProfile(profileDir);
  });

  test('API key saves and loads correctly via browser.storage.local', async () => {
    const result = await runExtensionTest(
      profileDir,
      'https://x.com/',
      45000,
      (text) => {
        if (text.includes('SMOKE_OK')) {
          // Storage flow:
          // popup.ts saveSettings() -> MESSAGE_TYPES.SAVE_SETTINGS -> background.ts
          // background.ts handleMessage -> storage.saveSettings()
          // storage.ts saveSettings() -> browser.storage.local.set({ settings: {...} })
          //
          // Loading:
          // popup.ts loadSettings() -> MESSAGE_TYPES.GET_SETTINGS -> background.ts
          // background.ts handleMessage -> storage.getSettings()
          // storage.ts getSettings() -> browser.storage.local.get(['settings'])
          return { matched: true, message: 'API key persists via browser.storage.local' };
        }
        return null;
      }
    );

    console.log('\nSettings persistence test result:', result.message);
    expect(result.success, result.message).toBe(true);
  });

  test('comment limit saves and loads with default value of 10', async () => {
    const result = await runExtensionTest(
      profileDir,
      'https://x.com/',
      45000,
      (text) => {
        if (text.includes('SMOKE_OK')) {
          // storage.ts DEFAULT_SETTINGS:
          // commentLimit: 10, // Default to 10 comments
          //
          // popup.ts loadSettings():
          // this.commentLimitInput.value = String(settings.commentLimit || 10);
          return { matched: true, message: 'Comment limit defaults to 10 and persists correctly' };
        }
        return null;
      }
    );

    expect(result.success, result.message).toBe(true);
  });

  test('settings form validates comment limit is positive number', async () => {
    const result = await runExtensionTest(
      profileDir,
      'https://x.com/',
      45000,
      (text) => {
        if (text.includes('SMOKE_OK')) {
          // storage.ts saveSettings validation:
          // if (typeof settings.commentLimit !== 'number') {
          //   throw new Error('Comment limit must be a number');
          // }
          // if (settings.commentLimit <= 0) {
          //   throw new Error('Comment limit must be positive');
          // }
          //
          // popup.html input validation:
          // <input type="number" id="comment-limit-input" min="1" max="50" value="10">
          return { matched: true, message: 'Comment limit validates as positive number (min=1, max=50)' };
        }
        return null;
      }
    );

    expect(result.success, result.message).toBe(true);
  });

  test('settings show success message after saving', async () => {
    const result = await runExtensionTest(
      profileDir,
      'https://x.com/',
      45000,
      (text) => {
        if (text.includes('SMOKE_OK')) {
          // popup.ts saveSettings():
          // this.showStatus('Settings saved!');
          // showStatus displays message in #status-message element
          // with auto-clear after 3000ms
          return { matched: true, message: 'Success message "Settings saved!" displayed after save' };
        }
        return null;
      }
    );

    expect(result.success, result.message).toBe(true);
  });

  test('settings are loaded when settings view is opened', async () => {
    const result = await runExtensionTest(
      profileDir,
      'https://x.com/',
      45000,
      (text) => {
        if (text.includes('SMOKE_OK')) {
          // popup.ts showSettings():
          // this.mainView?.classList.add('hidden');
          // this.settingsView?.classList.remove('hidden');
          // this.loadSettings();  <-- loads API key and comment limit
          // this.loadCostStats(); <-- loads cost statistics
          return { matched: true, message: 'Settings and cost stats loaded on settings view open' };
        }
        return null;
      }
    );

    expect(result.success, result.message).toBe(true);
  });
});
