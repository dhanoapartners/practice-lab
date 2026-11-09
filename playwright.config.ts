import { defineConfig, devices } from '@playwright/test';

/**
 * @file Playwright configuration for the Practice Lab suite.
 *
 * Environment variables:
 * - `LAB_URL`: where Practice Lab runs. Defaults to the live site; use http://localhost:8788 for a local copy.
 *   Against the live site the suite uses 2 workers to stay under its rate limit (100 API requests per 10 s per IP).
 * - `LAB_UI`: `v1` (default) or `v2`. v2 simulates a release that renames test IDs and labels.
 * - `VISUAL=1`: include baseline screenshot tests.
 * - `TRIAGE_DEMO=1`: run only the deliberately failing release-night specs (`npm run demo:triage`).
 * - `PW_CHROMIUM_PATH`: use an already-installed Chromium instead of `npx playwright install`.
 */
/** Where the tests run. */
const BASE_URL = process.env.LAB_URL || 'https://www.dhanoapartners.com';
/** True when testing a local copy, where full parallelism is safe. */
const LOCAL = /localhost|127\.0\.0\.1/.test(BASE_URL);
/** `TRIAGE_DEMO=1` runs only the deliberately failing release-night specs in `specs/triage/`. */
const TRIAGE_DEMO = process.env.TRIAGE_DEMO === '1';

export default defineConfig({
  testDir: TRIAGE_DEMO ? './specs/triage' : './specs',
  testIgnore: TRIAGE_DEMO ? [] : ['**/triage/**'],
  timeout: 30_000,
  expect: { timeout: 7_000 },
  fullyParallel: true,
  workers: LOCAL ? undefined : 2,
  retries: process.env.CI ? 1 : 0,
  // In CI the `github` reporter turns each failure into an annotation on the run.
  // The JSON report feeds the triage-basic training script (`npm run triage`).
  reporter: [
    ...(process.env.CI ? [['github'] as const] : []),
    ['list'],
    ['html', { open: 'never' }],
    ['json', { outputFile: 'reports/results.json' }],
    // Allure: writes raw results to allure-results/; `npm run allure:generate` turns them into a report.
    ['allure-playwright', { resultsDir: 'allure-results', detail: true, suiteTitle: true }],
  ],
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // Optional: point at an already-installed Chromium instead of `npx playwright install`.
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
