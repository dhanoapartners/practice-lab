/**
 * @file Page objects and fixtures in action (Chapter 13), using shared test data (Chapter 14).
 *
 * Compare with checkout.spec.ts, which uses helper functions: same journeys, but here every locator lives in
 * pages/ and every literal in support/test-data.ts.
 * Run: `npx playwright test specs/pages.spec.ts`
 */
import { test, expect } from '../support/fixtures';
import { PRODUCTS } from '../support/test-data';
import { expectedTotals, money } from '../support/pricing';

test('find a product and add it to the cart', { tag: '@smoke' }, async ({ shop }) => {
  await shop.open();
  await shop.openFirstSuggestion('speaker');
  await expect(shop.productTitle).toHaveText(PRODUCTS.speaker.name);
  await shop.addOpenProductToCart();
  await expect(shop.cartCount).toHaveText('1');
});

test('checkout end to end with page objects', { tag: '@smoke' }, async ({ checkout }) => {
  await checkout.seedCart([{ productId: PRODUCTS.simple.id, qty: 1 }]);
  await checkout.start();
  await checkout.fillShipping();
  await checkout.chooseDelivery('express');
  await checkout.pay();
  await expect(checkout.reviewTotal()).toHaveText(money(expectedTotals([{ price: PRODUCTS.simple.price, qty: 1 }]).total));
  expect(await checkout.placeOrder()).toMatch(/^KM-\d+$/);
});

// Exercise (Chapter 13): write a BankPage class in pages/ for the Accounts screen and use it here.
