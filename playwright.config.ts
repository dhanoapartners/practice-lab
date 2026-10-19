import { defineConfig, devices } from '@playwright/test';

// LAB_URL: where Practice Lab runs. Defaults to the live lab; use http://localhost:8788 for a local copy.
// LAB_UI:  v1 (default) or v2. v2 simulates a release that renames test IDs and labels.
export default defineConfig({
  testDir: './specs',
  timeout: 30_000,
  expect: { timeout: 7_000 },
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }], ['./support/healing-reporter.ts']],
  use: {
    baseURL: process.env.LAB_URL || 'https://www.dhanoapartners.com',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // Optional: point at an already-installed Chromium instead of `npx playwright install`.
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
