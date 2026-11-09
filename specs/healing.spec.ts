/**
 * @file Training sample: the same shop journey with plain locators and with fallback locators.
 *
 * Both pass on UI v1. Switch to UI v2, a release that renamed the test IDs:
 * - `npm run demo:broken` runs the plain version on v2: it fails.
 * - `npm run demo:healed` runs the fallback version on v2: it passes and logs every fallback it used.
 *
 * The helper is in support/fallback-locator.ts.
 */
import { test, expect } from '@playwright/test';
import { findWithFallback } from '../support/fallback-locator';
import { labUrl } from '../support/lab';

test('search, open a product and add it to the cart (plain locators)', async ({ page }) => {
  await page.goto(labUrl('shop'));
  await page.getByTestId('search-input').fill('speaker');
  await page.getByTestId('search-suggestion').first().click();
  await expect(page.getByTestId('product-title')).toHaveText('Bluetooth Speaker');
  await page.getByTestId('add-to-cart').click();
  await expect(page.getByTestId('cart-count')).toHaveText('1');
});

test('search, open a product and add it to the cart (fallback locators)', async ({ page }) => {
  await page.goto(labUrl('shop'));
  await (await findWithFallback(page, { testId: 'search-input', role: 'searchbox', name: 'Search products' })).fill('speaker');
  await (await findWithFallback(page, { testId: 'search-suggestion', role: 'option' })).first().click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Bluetooth Speaker');
  await (await findWithFallback(page, { testId: 'add-to-cart', role: 'button', name: /Add to (cart|bag)/ })).click();
  // Exercise: the cart badge has no role or text to fall back on. How would you find it after a rename?
  await expect(page.locator('#cartCount')).toHaveText('1');
});
