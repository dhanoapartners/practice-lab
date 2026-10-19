/**
 * @file Cart, promo codes, the four-step checkout, sign-in and the special test users.
 *
 * Expected totals come from support/pricing.ts, an independent copy of the published rules,
 * so the tests check the site's arithmetic instead of copying it.
 * Run: `npx playwright test specs/checkout.spec.ts`
 */
import { test, expect, Page, APIRequestContext } from '@playwright/test';
import { labUrl, sessionHeaders } from '../support/lab';
import { expectedTotals, money } from '../support/pricing';

/**
 * Puts items in this browser's cart through the API, which is faster and steadier than the UI.
 * The browser and `page.request` share cookies, so the page sees the same cart.
 * @param page The page whose session cart to fill.
 * @param items Product ids with quantity and optional variant.
 */
async function seedCart(page: Page, items: { productId: string; qty: number; color?: string; size?: string }[]) {
  await page.goto(labUrl('hub'));
  // The hub's first API call sets the lab_sid cookie. Wait for it, or the API calls below
  // could start a second session and the page would show a different cart.
  await expect.poll(async () => (await page.context().cookies()).some((c) => c.name === 'lab_sid')).toBe(true);
  for (const i of items) expect((await page.request.post('/api/v1/cart/items', { data: i })).status()).toBe(201);
}

/**
 * Asserts the order summary panel against independently computed totals.
 * @param page The page showing the cart.
 * @param t Totals from {@link expectedTotals}.
 */
async function expectSummary(page: Page, t: ReturnType<typeof expectedTotals>) {
  await expect(page.getByTestId('summary-subtotal')).toHaveText(money(t.subtotal));
  await expect(page.getByTestId('summary-shipping')).toHaveText(t.shipping ? money(t.shipping) : 'Free');
  await expect(page.getByTestId('summary-tax')).toHaveText(money(t.tax));
  await expect(page.getByTestId('summary-total')).toHaveText(money(t.total));
  if (t.discount) await expect(page.getByTestId('summary-discount')).toHaveText('−' + money(t.discount));
}

/** Fills step 1 (shipping) with fictional details. */
async function fillShipping(page: Page) {
  await page.getByTestId('ship-name').fill('Sam Standard');
  await page.getByTestId('ship-email').fill('sam@example.com');
  await page.getByTestId('ship-address').fill('100 Main St');
  await page.getByTestId('ship-city').fill('San Ramon');
  await page.getByTestId('ship-state').selectOption('CA');
  await page.getByTestId('ship-zip').fill('94583');
}

/** Cart lines, quantities, removal with confirmation and the order summary. */
test.describe('Cart', () => {
  test('empty cart', async ({ page }) => {
    await page.goto(labUrl('cart'));
    await expect(page.getByTestId('cart-empty')).toContainText('Your cart is empty.');
    await page.getByTestId('continue-shopping').click();
    await expect(page.getByTestId('view-shop')).toBeVisible();
  });

  test('summary under $75 pays shipping', async ({ page }) => {
    await seedCart(page, [{ productId: 'p-1006', qty: 1 }]); // Cast Iron Skillet $35
    await page.goto(labUrl('cart'));
    await expectSummary(page, expectedTotals([{ price: 35, qty: 1 }]));
  });

  test('summary at $75 or more ships free, sale prices are used', async ({ page }) => {
    await seedCart(page, [{ productId: 'p-1003', qty: 1 }, { productId: 'p-1008', qty: 1 }]); // Rain Shell $71.20 sale + Cutting Board $19.20 sale
    await page.goto(labUrl('cart'));
    await expectSummary(page, expectedTotals([{ price: 71.2, qty: 1 }, { price: 19.2, qty: 1 }]));
    await expect(page.getByTestId('summary-shipping')).toHaveText('Free');
  });

  test('changing quantity updates line and totals', async ({ page }) => {
    await seedCart(page, [{ productId: 'p-1006', qty: 1 }]);
    await page.goto(labUrl('cart'));
    await page.getByTestId('line-qty').selectOption('3');
    await expect(page.getByTestId('line-total')).toHaveText('$105.00');
    await expectSummary(page, expectedTotals([{ price: 35, qty: 3 }]));
    await expect(page.getByTestId('cart-count')).toHaveText('3');
  });

  test('remove asks first: Keep keeps it, Remove removes it', async ({ page }) => {
    await seedCart(page, [{ productId: 'p-1006', qty: 1 }, { productId: 'p-1017', qty: 1 }]);
    await page.goto(labUrl('cart'));
    const skillet = page.getByTestId('cart-line').filter({ hasText: 'Cast Iron Skillet' });
    await skillet.getByTestId('line-remove').click();
    await skillet.getByTestId('line-remove-cancel').click();
    await expect(page.getByTestId('cart-line')).toHaveCount(2);
    await page.getByTestId('cart-line').filter({ hasText: 'Cast Iron Skillet' }).getByTestId('line-remove').click();
    await page.getByTestId('line-remove-confirm').click();
    await expect(page.getByTestId('cart-line')).toHaveCount(1);
    await expect(page.getByTestId('line-name')).toHaveText('Bluetooth Speaker');
  });

  test('same product and variant merges into one line', async ({ page }) => {
    await seedCart(page, [{ productId: 'p-1001', qty: 1, color: 'Pine', size: 'M' }, { productId: 'p-1001', qty: 2, color: 'Pine', size: 'M' }, { productId: 'p-1001', qty: 1, color: 'Ink', size: 'M' }]);
    await page.goto(labUrl('cart'));
    await expect(page.getByTestId('cart-line')).toHaveCount(2);
    await expect(page.getByTestId('cart-line').filter({ hasText: 'Pine' }).getByTestId('line-qty')).toHaveValue('3');
  });
});

/** SAVE10 and FREESHIP, invalid codes and removing a code. */
test.describe('Promo codes', () => {
  test.beforeEach(async ({ page }) => {
    await seedCart(page, [{ productId: 'p-1006', qty: 1 }]);
    await page.goto(labUrl('cart'));
  });

  test('SAVE10 takes 10% off before tax', async ({ page }) => {
    await page.getByTestId('promo-input').fill('save10'); // codes are case-insensitive
    await page.getByTestId('promo-apply').click();
    await expect(page.getByTestId('promo-applied')).toContainText('SAVE10 applied · 10% off');
    await expectSummary(page, expectedTotals([{ price: 35, qty: 1 }], 'SAVE10'));
  });

  test('FREESHIP removes shipping', async ({ page }) => {
    await page.getByTestId('promo-input').fill('FREESHIP');
    await page.getByTestId('promo-apply').click();
    await expectSummary(page, expectedTotals([{ price: 35, qty: 1 }], 'FREESHIP'));
  });

  test('invalid and empty codes', async ({ page }) => {
    await page.getByTestId('promo-apply').click();
    await expect(page.getByTestId('promo-message')).toHaveText('Enter a promo code.');
    await page.getByTestId('promo-input').fill('BOGUS');
    await page.getByTestId('promo-apply').click();
    await expect(page.getByTestId('promo-message')).toHaveText('That code is not valid. Try SAVE10 or FREESHIP.');
    await expect(page.getByTestId('promo-input')).toHaveAttribute('aria-invalid', 'true');
  });

  test('remove an applied code', async ({ page }) => {
    await page.getByTestId('promo-input').fill('SAVE10');
    await page.getByTestId('promo-apply').click();
    await page.getByTestId('promo-remove').click();
    await expect(page.getByTestId('promo-applied')).toHaveCount(0);
    await expectSummary(page, expectedTotals([{ price: 35, qty: 1 }]));
  });
});

/** The four checkout steps, their validation, and the confirmation page. */
test.describe('Checkout', () => {
  test.beforeEach(async ({ page }) => {
    await seedCart(page, [{ productId: 'p-1006', qty: 1 }]);
    await page.goto(labUrl('cart'));
    await page.getByTestId('checkout-button').click();
  });

  test('happy path to an order number', async ({ page }) => {
    await fillShipping(page);
    await page.getByTestId('shipping-continue').click();
    await page.getByTestId('delivery-express').check();
    await page.getByTestId('delivery-continue').click();
    await page.getByTestId('pay-card').fill('4242424242424242');
    await expect(page.getByTestId('pay-card')).toHaveValue('4242 4242 4242 4242'); // formatted as you type
    await page.getByTestId('pay-expiry').fill('1230');
    await expect(page.getByTestId('pay-expiry')).toHaveValue('12/30');
    await page.getByTestId('pay-cvc').fill('123');
    await page.getByTestId('payment-continue').click();
    await expect(page.getByTestId('review-address')).toContainText('100 Main St, San Ramon, CA 94583');
    await expect(page.getByTestId('review-total')).toHaveText(money(expectedTotals([{ price: 35, qty: 1 }]).total));
    await page.getByTestId('place-order').click();
    await expect(page.getByTestId('order-number')).toHaveText(/^KM-\d+$/);
    await expect(page.getByTestId('cart-count')).toBeHidden(); // cart is empty after ordering
  });

  test('shipping step: every required field is checked', async ({ page }) => {
    await page.getByTestId('shipping-continue').click();
    await expect(page.getByTestId('error-name')).toHaveText('Enter your full name.');
    await expect(page.getByTestId('error-email')).toHaveText('Enter an email address like name@example.com.');
    await expect(page.getByTestId('error-address')).toHaveText('Enter your street address.');
    await expect(page.getByTestId('error-city')).toHaveText('Enter a city.');
    await expect(page.getByTestId('error-state')).toHaveText('Select a state.');
    await expect(page.getByTestId('error-zip')).toHaveText('ZIP code must be 5 digits.');
    await expect(page.getByTestId('ship-name')).toBeFocused(); // focus moves to the first problem
  });

  test('shipping step: optional phone is validated only when filled', async ({ page }) => {
    await fillShipping(page);
    await page.getByTestId('ship-phone').fill('123');
    await page.getByTestId('shipping-continue').click();
    await expect(page.getByTestId('error-phone')).toHaveText('Enter a 10-digit phone number or leave it blank.');
    await page.getByTestId('ship-phone').clear();
    await page.getByTestId('shipping-continue').click();
    await expect(page.getByTestId('delivery-form')).toBeVisible();
  });

  test('gift message appears only for gifts and counts characters', async ({ page }) => {
    await expect(page.getByTestId('ship-gift-message')).toBeHidden();
    await page.getByTestId('ship-gift').check();
    await page.getByTestId('ship-gift-message').fill('Happy birthday!');
    await expect(page.getByText('15/150')).toBeVisible();
  });

  test('delivery date must be at least 2 days out', async ({ page }) => {
    await fillShipping(page);
    await page.getByTestId('shipping-continue').click();
    await page.getByTestId('delivery-date').fill(new Date().toISOString().slice(0, 10));
    await page.getByTestId('delivery-continue').click();
    await expect(page.getByTestId('error-ddate')).toHaveText('Choose a date at least 2 days from today.');
  });

  test('payment step: bad card, declined card, past expiry, short CVC', async ({ page }) => {
    await fillShipping(page);
    await page.getByTestId('shipping-continue').click();
    await page.getByTestId('delivery-continue').click();
    await page.getByTestId('pay-card').fill('4242424242424241');
    await page.getByTestId('pay-expiry').fill('0120');
    await page.getByTestId('pay-cvc').fill('12');
    await page.getByTestId('payment-continue').click();
    await expect(page.getByTestId('error-card')).toHaveText('Enter a valid 16-digit card number.');
    await expect(page.getByTestId('error-exp')).toHaveText('Enter a future expiry date as MM/YY.');
    await expect(page.getByTestId('error-cvc')).toHaveText('CVC must be 3 or 4 digits.');
    await page.getByTestId('pay-card').fill('4000000000000002');
    await page.getByTestId('payment-continue').click();
    await expect(page.getByTestId('error-card')).toHaveText('This card was declined. Use a different card.');
  });

  test('Back keeps what you typed', async ({ page }) => {
    await fillShipping(page);
    await page.getByTestId('shipping-continue').click();
    await page.getByRole('button', { name: 'Back' }).click();
    await expect(page.getByTestId('ship-city')).toHaveValue('San Ramon');
  });
});

/** Header sign-in and the four test users' behaviors. */
test.describe('Test users', () => {
  /** Signs in through the header modal. */
  async function signIn(page: Page, username: string, password = 'practice123') {
    await page.getByTestId('header-login').click();
    await page.getByTestId('login-username').selectOption(username);
    await page.getByTestId('login-password').fill(password);
    await page.getByTestId('login-submit').click();
  }

  test('standard_user signs in and out', async ({ page }) => {
    await page.goto(labUrl('hub'));
    await signIn(page, 'standard_user');
    await expect(page.getByTestId('header-login')).toHaveText('Sign out (standard_user)');
    await page.getByTestId('header-login').click();
    await expect(page.getByTestId('header-login')).toHaveText('Sign in');
  });

  test('wrong password and locked_user show clear errors', async ({ page }) => {
    await page.goto(labUrl('hub'));
    await signIn(page, 'standard_user', 'nope');
    await expect(page.getByTestId('login-error')).not.toBeEmpty();
    await page.getByTestId('login-modal').getByRole('button', { name: 'Cancel' }).click();
    await signIn(page, 'locked_user');
    await expect(page.getByTestId('login-error')).toContainText('locked');
  });

  test('slow_user: every request takes about 3 seconds longer', async ({ request }) => {
    const login = await (await request.post('/api/v1/auth/login', { data: { username: 'slow_user', password: 'practice123' } })).json();
    const t0 = Date.now();
    const r = await request.get('/api/v1/cart', { headers: { ...sessionHeaders(), Authorization: 'Bearer ' + login.token } });
    expect(r.status()).toBe(200);
    expect(Date.now() - t0).toBeGreaterThan(2_500);
  });

  test('error_user: about half of all writes fail with 500', async ({ request }) => {
    const login = await (await request.post('/api/v1/auth/login', { data: { username: 'error_user', password: 'practice123' } })).json();
    const headers = { ...sessionHeaders(), Authorization: 'Bearer ' + login.token };
    const codes: number[] = [];
    for (let i = 0; i < 20; i++) codes.push((await request.post('/api/v1/cart/items', { headers, data: { productId: 'p-1006', qty: 1 } })).status());
    // Random by design: assert the behavior (some of each), never an exact count.
    expect(codes.filter((c) => c === 500).length).toBeGreaterThan(0);
    expect(codes.filter((c) => c === 201).length).toBeGreaterThan(0);
  });
});
