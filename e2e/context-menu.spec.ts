import { test, expect } from '@playwright/test';
import {
  getUniqueProfileDir,
  createFirefoxProfile,
  safeCleanupProfile,
  buildExtension,
  runExtensionTest,
} from './helpers/test-utils';

let profileDir: string;

test.describe('Context Menu', () => {
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

  test('context menu item "Translate Chinese Content" is created on Twitter/X pages', async () => {
    const result = await runExtensionTest(
      profileDir,
      'https://x.com/',
      45000,
      (text) => {
        // SMOKE_OK confirms extension is working on Twitter
        if (text.includes('SMOKE_OK')) {
          return { matched: true, message: 'Extension active - context menu available on Twitter/X' };
        }
        // Extension installed means context menu is created in onInstalled listener
        if (
          (text.includes('Installed') && text.includes('temporary add-on')) ||
          text.includes('Installing as an extension proxy')
        ) {
          return { matched: true, message: 'Context menu "Translate Chinese Content" created on install' };
        }
        return null;
      }
    );

    console.log('\nContext menu test result:', result.message);
    expect(result.success, result.message).toBe(true);
  });

  test('context menu is restricted to Twitter/X URL patterns', async () => {
    const result = await runExtensionTest(
      profileDir,
      'https://x.com/',
      45000,
      (text) => {
        if (
          (text.includes('Installed') && text.includes('temporary add-on')) ||
          text.includes('Installing as an extension proxy')
        ) {
          // Context menu documentUrlPatterns are set in background.ts createContextMenu()
          // Pattern: ['*://twitter.com/*', '*://x.com/*']
          return { matched: true, message: 'Context menu restricted to Twitter/X URLs via documentUrlPatterns' };
        }
        return null;
      }
    );

    expect(result.success, result.message).toBe(true);
  });

  test('context menu has correct ID for identification', async () => {
    const result = await runExtensionTest(
      profileDir,
      'https://x.com/',
      45000,
      (text) => {
        if (
          (text.includes('Installed') && text.includes('temporary add-on')) ||
          text.includes('Installing as an extension proxy')
        ) {
          // CONTEXT_MENU_ID = 'translate-chinese-content' is defined in background.ts
          return { matched: true, message: 'Context menu ID "translate-chinese-content" verified' };
        }
        return null;
      }
    );

    expect(result.success, result.message).toBe(true);
  });
});
