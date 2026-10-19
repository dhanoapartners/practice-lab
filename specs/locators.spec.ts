/**
 * @file Fifteen chained-locator patterns: narrow down step by step instead of writing one long selector.
 *
 * Scoping, filter({ hasText / has / hasNot }), first/last/nth, or(), and(), iframes, shadow DOM,
 * walking up to a parent, visible-only matches and chaining into SVG.
 * Run: `npx playwright test specs/locators.spec.ts`
 */
import { test, expect } from '@playwright/test';
import { labUrl } from '../support/lab';

/** Find a container first, then look inside it. */
test.describe('Chaining: scope, then find', () => {
  test('1. Scope to a container, then find inside it', async ({ page }) => {
    await page.goto(labUrl('playground'));
    const tile = page.getByTestId('tile-dropdowns');              // container
    await tile.getByLabel('Native select').selectOption('Mango'); // only searches inside the tile
    await expect(tile.getByTestId('out-dropdowns')).toContainText('native=Mango');
  });

  test('2. Table cell by row text and column index', async ({ page }) => {
    await page.goto(labUrl('playground'));
    const row = page.getByTestId('data-table').getByRole('row').filter({ hasText: 'Ben Cho' });
    await expect(row.getByRole('cell').nth(3)).toHaveText('$118,000');
  });

  test('3. Inside an iframe: frameLocator, then a locator', async ({ page }) => {
    await page.goto(labUrl('playground'));
    const frame = page.frameLocator('[data-testid="frame-newsletter"]');
    await frame.getByTestId('frame-email').fill('student@example.com');
    await frame.getByTestId('frame-submit').click();
    await expect(frame.getByTestId('frame-message')).toHaveText('Subscribed: student@example.com');
  });

  test('4. Through an open shadow root: just chain', async ({ page }) => {
    await page.goto(labUrl('playground'));
    const host = page.getByTestId('shadow-host');
    await host.getByTestId('shadow-input').fill('SAVE10');        // Playwright pierces open shadow DOM
    await host.getByTestId('shadow-button').click();
    await expect(page.getByTestId('out-shadow')).toHaveText('Shadow input: SAVE10');
  });
});

/** Pick among many similar elements by what they contain or don't contain. */
test.describe('Chaining with filter()', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(labUrl('shop'));
    await page.getByTestId('per-page').selectOption('24');       // all 24 products on one page
    await expect(page.getByTestId('product-card')).toHaveCount(24);
  });

  test('5. filter({ hasText }): pick one card by its text', async ({ page }) => {
    const card = page.getByTestId('product-card').filter({ hasText: 'Bluetooth Speaker' });
    await expect(card.getByTestId('product-price')).toHaveText('$59.00');
  });

  test('6. filter({ hasText: /regex/ }): match a pattern', async ({ page }) => {
    const kitchen = page.getByTestId('product-card').filter({ hasText: /Skillet|Bowls|Board/ });
    await expect(kitchen).toHaveCount(3);
  });

  test('7. filter({ has }): cards that contain an "Out of stock" badge', async ({ page }) => {
    const soldOut = page.getByTestId('product-card').filter({ has: page.getByText('Out of stock', { exact: true }) });
    await expect(soldOut).toHaveCount(3);
    await expect(soldOut.getByTestId('product-name')).toHaveText(['Insulated Water Bottle', 'Ceramic Table Lamp', 'Mechanical Keyboard']);
  });

  test('8. filter({ hasNot }): cards without a Sale badge', async ({ page }) => {
    // 5 products are on sale, but a sold-out sale item shows "Out of stock" instead of "Sale".
    const fullPrice = page.getByTestId('product-card').filter({ hasNot: page.getByText('Sale', { exact: true }) });
    await expect(fullPrice).toHaveCount(20);
  });

  test('9. Chain two filters: in stock AND on sale', async ({ page }) => {
    const deals = page.getByTestId('product-card')
      .filter({ has: page.getByText('Sale', { exact: true }) })
      .filter({ hasNot: page.getByText('Out of stock', { exact: true }) });
    await expect(deals).toHaveCount(4);
  });

  test('10. first(), last() and nth()', async ({ page }) => {
    const names = page.getByTestId('product-card').getByTestId('product-name');
    await expect(names.first()).toHaveText('Everyday Crew Tee');
    await expect(names.last()).toHaveText('Aluminum Laptop Stand');
    await expect(names.nth(16)).toHaveText('Bluetooth Speaker');
  });
});

/** Position, alternatives (or), intersections (and), parents and visibility. */
test.describe('Combining locators', () => {
  test('11. or(): one locator that works on UI v1 and v2', async ({ page }) => {
    await page.goto('/?ui=v2#shop');
    await page.getByTestId('product-card').or(page.getByTestId('product-tile')).first().click();
    const addButton = page.getByTestId('add-to-cart').or(page.getByTestId('add-to-bag'));
    await expect(addButton).toBeVisible();
  });

  test('12. and(): both conditions must match the same element', async ({ page }) => {
    await page.goto(labUrl('playground'));
    await expect(page.getByRole('button').and(page.getByTestId('btn-disabled'))).toBeDisabled();
  });

  test('13. Walk up to the parent row from a child', async ({ page }) => {
    await page.request.post('/api/v1/cart/items', { data: { productId: 'p-1017', qty: 2 } });
    await page.goto(labUrl('cart'));
    const line = page.getByTestId('line-name').filter({ hasText: 'Bluetooth Speaker' })
      .locator('xpath=ancestor::*[@data-testid="cart-line"]');
    await expect(line.getByTestId('line-total')).toHaveText('$118.00');
  });

  test('14. Only visible matches: locator("visible=true")', async ({ page }) => {
    await page.goto(labUrl('shop'));
    await page.getByTestId('search-input').fill('speaker');
    // The header has hidden <option> elements too; keep only the visible suggestion.
    await expect(page.getByRole('option').locator('visible=true')).toHaveCount(1);
  });

  test('15. Chain into an SVG chart', async ({ page }) => {
    await page.goto(labUrl('charts'));
    const march = page.getByTestId('bar-chart').getByTestId('bar').filter({ has: page.getByText('Mar', { exact: true }) });
    await expect(march.getByTestId('bar-value')).toHaveText('$14,100');
  });
});
