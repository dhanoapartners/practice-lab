/**
 * @file Release night: a deliberately failing run for the failure triage exercise.
 *
 * Excluded from `npm test`. Run it with `npm run demo:triage`: the run fails on purpose, then triage-basic sorts the failures.
 * The same story is told on the site at https://www.dhanoapartners.com/#triage.
 *
 * Four things go wrong in one nightly run, each produced by a real Practice Lab feature:
 * | What happened                          | Lab feature             | Right answer            |
 * |----------------------------------------|-------------------------|-------------------------|
 * | The storefront shipped UI v2           | `?ui=v2`                | Test issue (x2)         |
 * | The bank release shipped two defects   | `X-Bank-Bug` header     | Product bug (x2)        |
 * | A backend dependency went down         | `X-Chaos: down` header  | Environment (x3)        |
 * | A slow first run on a cold environment | `?chaos=1`, retry 0 only| Flaky (x1)              |
 *
 * The triage script never sees this table: it only gets each failure's error text and retry history.
 */
import { test, expect } from '@playwright/test';
import { sessionHeaders } from '../../support/lab';

/** Fail fast on missing elements instead of waiting for the whole test timeout. */
test.use({ actionTimeout: 5_000 });

const BANK = '/api/v1/bank';

/** Standard amortization, rounded half-up to the cent. Computed independently of the bank. */
function expectedPayment(amount: number, aprPct: number, months: number) {
  const r = aprPct / 100 / 12;
  const raw = (amount * r) / (1 - Math.pow(1 + r, -months));
  return Math.round((raw + Number.EPSILON) * 100) / 100;
}

test.describe('Storefront after the UI v2 release', () => {
  // The tests below were written for v1 and never updated: the app works, the tests are stale.
  test('search for a speaker and open it', async ({ page }) => {
    await page.goto('/?ui=v2#shop');
    await page.getByTestId('search-input').fill('speaker'); // v2 renamed it to "site-search"
    await page.getByTestId('search-suggestion').first().click();
    await expect(page.getByTestId('product-title')).toHaveText('Bluetooth Speaker');
  });

  test('open the cart from the header', async ({ page }) => {
    await page.goto('/?ui=v2#shop');
    await page.getByTestId('header-cart').click(); // v2 renamed it to "header-bag"
    await expect(page.getByTestId('view-cart')).toBeVisible();
  });
});

test.describe('Harbor Demo Bank after the bank release', () => {
  test('a transfer over the $2,500.00 daily limit is rejected', async ({ request }) => {
    const headers = { ...sessionHeaders(), 'X-Bank-Bug': 'limit_off_by_one' };
    const res = await request.post(`${BANK}/transfers`, {
      headers,
      data: { fromAccountId: 'CHK-1001', toAccountId: 'SAV-2001', amount: 2500.01 },
    });
    expect(res.status(), 'a $2,500.01 transfer must be rejected with 422').toBe(422);
  });

  test('the auto loan payment matches the amortization formula', async ({ request }) => {
    const headers = { ...sessionHeaders(), 'X-Bank-Bug': 'rounding' };
    const res = await request.post(`${BANK}/pricing`, {
      headers,
      data: { product: 'auto', amount: 20000, termMonths: 60, creditScore: 742, collateralValue: 40000 },
    });
    expect(res.ok()).toBeTruthy();
    const quote = await res.json();
    expect(quote.monthlyPayment, 'monthly payment must be rounded half-up to the cent').toBe(
      expectedPayment(20000, quote.apr, 60),
    );
  });
});

test.describe('Catalog and bank during a backend outage', () => {
  test('the shop shows the product catalog', async ({ page }) => {
    await page.setExtraHTTPHeaders({ 'X-Chaos': 'down' });
    await page.goto('/?ui=v1#shop');
    await expect(page.getByTestId('product-card').first()).toBeVisible();
  });

  test('product search API returns results', async ({ request }) => {
    const res = await request.get('/api/v1/products?q=speaker', { headers: { 'X-Chaos': 'down' } });
    expect(res.ok(), `GET /products returned ${res.status()}`).toBeTruthy();
  });

  test('bank accounts load for the customer', async ({ request }) => {
    const res = await request.get(`${BANK}/accounts`, { headers: { ...sessionHeaders(), 'X-Chaos': 'down' } });
    expect(res.ok(), `GET /bank/accounts returned ${res.status()}`).toBeTruthy();
  });
});

test.describe('Playground on a cold environment', () => {
  test('dynamic loading shows the greeting', async ({ page }, testInfo) => {
    // First attempt only: Chaos mode adds 1.5 s to this widget, like a slow first run after a deploy.
    // The 3-second wait is too tight for that, so the test fails once and passes on retry.
    await page.goto(testInfo.retry === 0 ? '/?ui=v1&chaos=1#playground' : '/?ui=v1#playground');
    await page.getByTestId('dynamic-start').click();
    await expect(page.getByTestId('dynamic-result')).toHaveText('Hello, tester!', { timeout: 3_000 });
  });
});
