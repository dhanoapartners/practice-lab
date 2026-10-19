/**
 * @file Small helpers shared by the specs.
 */

/** UI version under test: `v1` (default) or `v2` from the `LAB_UI` environment variable. */
export const UI = process.env.LAB_UI === 'v2' ? 'v2' : 'v1';

/**
 * URL for a Practice Lab screen, pinned to the UI version under test.
 * @param view Screen name as it appears after `#`, e.g. `shop`, `bank`, `playground`.
 * @example await page.goto(labUrl('bank')); // → /?ui=v1#bank
 */
export const labUrl = (view: string = 'hub') => `/?ui=${UI}#${view}`;

/**
 * A fresh `X-Session-Id` header. Each API test that sends one gets its own cart, bank and orders,
 * so tests can run in parallel without seeing each other's data.
 */
export const sessionHeaders = () => ({ 'X-Session-Id': 'pw' + crypto.randomUUID().replace(/-/g, '') });
