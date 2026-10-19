import { defineConfig, devices } from '@playwright/test';

/**
 * @file Playwright configuration for the Practice Lab suite.
 *
 * Environment variables:
 * - `LAB_URL`: where Practice Lab runs. Defaults to the live site; use http://localhost:8788 for a local copy.
 *   Against the live site the suite uses 2 workers to stay under its rate limit (100 API requests per 10 s per IP).
 * - `LAB_UI`: `v1` (default) or `v2`. v2 simulates a release that renames test IDs and labels.
 * - `LAB_LLM=1`: include tests that call the live LLM (Workers AI).
 * - `VISUAL=1`: include baseline screenshot tests.
 * - `PW_CHROMIUM_PATH`: use an already-installed Chromium instead of `npx playwright install`.
 */
/** Where the tests run. */
const BASE_URL = process.env.LAB_URL || 'https://www.dhanoapartners.com';
/** True when testing a local copy, where full parallelism is safe. */
const LOCAL = /localhost|127\.0\.0\.1/.test(BASE_URL);

export default defineConfig({
  testDir: './specs',
  timeout: 30_000,
  expect: { timeout: 7_000 },
  fullyParallel: true,
  workers: LOCAL ? undefined : 2,
  retries: process.env.CI ? 1 : 0,
  // In CI the `github` reporter turns each failure into an annotation on the run.
  reporter: [...(process.env.CI ? [['github'] as const] : []), ['list'], ['html', { open: 'never' }], ['./support/healing-reporter.ts']],
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // Optional: point at an already-installed Chromium instead of `npx playwright install`.
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
