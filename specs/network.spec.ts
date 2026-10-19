import { test, expect } from '@playwright/test';
import { existsSync } from 'node:fs';
import { labUrl } from '../support/lab';

test.describe('network control', () => {
  test('mock an empty catalog', async ({ page }) => {
    await page.route('**/api/v1/products?*', (route) => route.fulfill({ json: { total: 0, page: 1, limit: 8, pages: 1, items: [] } }));
    await page.goto(labUrl('shop'));
    await expect(page.getByTestId('empty-results')).toBeVisible();
  });

  test('a server error shows Retry, and Retry recovers', async ({ page }) => {
    let fail = true;
    await page.route('**/api/v1/products?*', (route) => (fail ? route.fulfill({ status: 500, json: { error: 'Boom' } }) : route.continue()));
    await page.goto(labUrl('shop'));
    await expect(page.getByTestId('grid-error')).toContainText('500');
    fail = false;
    await page.getByTestId('grid-retry').click();
    await expect(page.getByTestId('product-card').first()).toBeVisible();
  });

  test('wait for the search API before asserting', async ({ page }) => {
    await page.goto(labUrl('shop'));
    const resp = page.waitForResponse((r) => r.url().includes('/api/v1/products') && r.url().includes('q=key'));
    await page.getByTestId('search-input').fill('key');
    expect((await resp).status()).toBe(200);
    await expect(page.getByTestId('search-suggestion')).toHaveCount(1);
  });

  // Record once with `npm run har:record`, then this replays the API from the
  // HAR file with no server calls for products.
  test('replay the catalog from a HAR file', async ({ page }) => {
    const har = 'fixtures/catalog.har';
    const update = !!process.env.UPDATE_HAR;
    test.skip(!update && !existsSync(har), 'Run npm run har:record first');
    await page.routeFromHAR(har, { url: '**/api/v1/products**', update, updateContent: 'embed' });
    await page.goto(labUrl('shop'));
    await expect(page.getByTestId('product-card')).toHaveCount(8);
  });
});
