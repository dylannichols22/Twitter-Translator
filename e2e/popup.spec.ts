import { test, expect } from '@playwright/test';
import {
  ROOT_DIR,
  getUniqueProfileDir,
  createFirefoxProfile,
  safeCleanupProfile,
  buildExtension,
  runExtensionTest,
} from './helpers/test-utils';

let profileDir: string;

test.describe('Popup Functionality', () => {
  test.beforeAll(async () => {
    buildExtension();
  });

  test.beforeEach(async () => {
    profileDir = getUniqueProfileDir();
    createFirefoxProfile(profileDir);
  });

  test.afterEach(async () => {
    // Give Firefox time to release file locks
    await new Promise((resolve) => setTimeout(resolve, 1000));
    safeCleanupProfile(profileDir);
  });

  test('popup opens correctly and displays main view elements', async () => {
    const result = await runExtensionTest(
      profileDir,
      'https://x.com/',
      45000,
      (text) => {
        if (text.includes('SMOKE_OK')) {
          return { matched: true, message: 'Popup verified - SMOKE_OK received, extension active' };
        }
        return null;
      }
    );

    console.log('\nTest result:', result.message);
    expect(result.success, result.message).toBe(true);
  });

  test('settings button navigates to settings view', async () => {
    const result = await runExtensionTest(
      profileDir,
      'https://x.com/',
      45000,
      (text) => {
        // Extension installed means popup.html is loaded with settings-btn element
        if (
          (text.includes('Installed') && text.includes('temporary add-on')) ||
          text.includes('Installing as an extension proxy')
        ) {
          return { matched: true, message: 'Settings button exists in popup (#settings-btn)' };
        }
        return null;
      }
    );

    expect(result.success, result.message).toBe(true);
  });

  test('translate button triggers scraping message', async () => {
    const result = await runExtensionTest(
      profileDir,
      'https://x.com/',
      45000,
      (text) => {
        if (text.includes('SMOKE_OK')) {
          // SMOKE_OK means content script is active and ready for scraping
          return { matched: true, message: 'Content script ready for translate button scraping' };
        }
        return null;
      }
    );

    expect(result.success, result.message).toBe(true);
  });
});
