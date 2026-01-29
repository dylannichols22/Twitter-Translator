import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 60000,
  retries: 0,
  // Run tests serially to avoid Firefox profile conflicts
  workers: 1,
  // Fail fast to save time
  maxFailures: 5,
  use: {
    headless: false, // Extensions need a visible browser
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'firefox',
      use: {
        browserName: 'firefox',
      },
    },
  ],
});
