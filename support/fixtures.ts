/**
 * @file Custom fixtures (Chapter 13): every test gets ready-made page objects.
 *
 * @example
 * import { test, expect } from '../support/fixtures';
 * test('buy something', async ({ shop, checkout }) => { await shop.open(); ... });
 */
import { test as base, expect } from '@playwright/test';
import { ShopPage } from '../pages/ShopPage';
import { CheckoutPage } from '../pages/CheckoutPage';

export const test = base.extend<{ shop: ShopPage; checkout: CheckoutPage }>({
  shop: async ({ page }, use) => { await use(new ShopPage(page)); },
  checkout: async ({ page }, use) => { await use(new CheckoutPage(page)); },
});
export { expect };
