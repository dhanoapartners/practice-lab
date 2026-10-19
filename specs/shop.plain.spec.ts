import { test, expect } from '@playwright/test';
import { labUrl } from '../support/lab';

// The "before" picture for the self-healing demo: plain test-ID locators.
// Passes on UI v1. Fails on UI v2 because the release renamed the test IDs.
test('search, open a product and add it to the cart (plain locators)', async ({ page }) => {
  await page.goto(labUrl('shop'));
  await page.getByTestId('search-input').fill('speaker');
  await page.getByTestId('search-suggestion').first().click();
  await expect(page.getByTestId('product-title')).toHaveText('Bluetooth Speaker');
  await page.getByTestId('add-to-cart').click();
  await expect(page.getByTestId('cart-count')).toHaveText('1');
});
