import { test, expect } from '../support/healer';
import { L } from '../support/locators';
import { labUrl } from '../support/lab';

// Same journey as shop.plain.spec.ts, but every element goes through heal().
// Run with LAB_UI=v2: the test still passes and healing-report.md lists
// every locator that needs updating.
test('search, open a product and add it to the cart (self-healing)', async ({ page, heal }) => {
  await page.goto(labUrl('shop'));

  await (await heal(L.searchInput)).fill('speaker');
  await (await heal(L.suggestion)).first().click();

  await expect(await heal(L.productTitle)).toHaveText('Bluetooth Speaker');

  const added = page.waitForResponse((r) => r.url().includes('/api/v1/cart/items') && r.request().method() === 'POST');
  await (await heal(L.addToCart)).click();
  expect((await added).status()).toBe(201);

  await expect(await heal(L.cartCount)).toHaveText('1');
});

test('cart page shows the item and the checkout button', async ({ page, heal }) => {
  await page.request.post('/api/v1/cart/items', { data: { productId: 'p-1017', qty: 2 } });
  await page.goto(labUrl('cart'));
  await expect(page.getByTestId('line-name')).toHaveText('Bluetooth Speaker');
  await expect(await heal(L.checkout)).toBeEnabled();
});
