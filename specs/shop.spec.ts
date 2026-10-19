/**
 * @file Kestrel Market storefront: search, filters, sorting, paging and the product page.
 *
 * The catalog is fixed (24 products), so counts and prices below are stable.
 * Run: `npx playwright test specs/shop.spec.ts`
 */
import { test, expect, Page } from '@playwright/test';
import { labUrl } from '../support/lab';

/**
 * Waits until the result line reports `n` products.
 * Retries until it matches, because the count updates only after the products API answers;
 * reading the text once would return the stale count from before the filter.
 * @param page The Playwright page on the shop view.
 * @param n Expected number of matching products.
 */
async function expectTotal(page: Page, n: number) {
  await expect(page.getByTestId('results-count')).toHaveText(new RegExp(`^${n} products?\\b`));
}

/**
 * Collects the price shown on every product card (sale price when there is one).
 * @param page The Playwright page on the shop view.
 * @returns Prices in the order the cards appear.
 */
async function cardPrices(page: Page) {
  return page.getByTestId('product-card').getByTestId('product-price').evaluateAll((els) =>
    els.map((e) => Number(e.childNodes[0].textContent!.replace(/[$,]/g, ''))));
}

test.beforeEach(async ({ page }) => { await page.goto(labUrl('shop')); });

/** Live search suggestions, Enter to search, keyboard navigation and "no results". */
test.describe('Search', () => {
  test('suggestions appear after two letters and highlight the match', async ({ page }) => {
    await page.getByTestId('search-input').fill('s');
    await expect(page.getByTestId('search-suggestions')).toBeHidden();
    await page.getByTestId('search-input').fill('skil');
    await expect(page.getByTestId('search-suggestion')).toHaveCount(1);
    await expect(page.getByTestId('search-suggestion').locator('mark')).toHaveText('Skil');
  });

  test('pick a suggestion with the keyboard', async ({ page }) => {
    await page.getByTestId('search-input').fill('speaker');
    await expect(page.getByTestId('search-suggestion')).toHaveCount(1);
    await page.getByTestId('search-input').press('ArrowDown');
    await expect(page.getByTestId('search-suggestion').first()).toHaveAttribute('aria-selected', 'true');
    await page.getByTestId('search-input').press('Enter');
    await expect(page.getByTestId('product-title')).toHaveText('Bluetooth Speaker');
  });

  test('Enter runs a full search, and Clear search resets it', async ({ page }) => {
    await page.getByTestId('search-input').fill('kitchen');
    await page.getByTestId('search-input').press('Enter');
    await expect(page.getByTestId('active-query')).toContainText('"kitchen"');
    await expectTotal(page, 5); // search also matches category names
    await page.getByTestId('clear-query').click();
    await expectTotal(page, 24);
  });

  test('no matches', async ({ page }) => {
    await page.getByTestId('search-input').fill('zzz');
    await expect(page.getByTestId('search-no-results')).toHaveText('No products match "zzz".');
  });

  test('Escape closes the suggestions', async ({ page }) => {
    await page.getByTestId('search-input').fill('lamp');
    await expect(page.getByTestId('search-suggestions')).toBeVisible();
    await page.getByTestId('search-input').press('Escape');
    await expect(page.getByTestId('search-suggestions')).toBeHidden();
  });
});

/** Category and color multi-selects, price slider, rating, stock and the quick category bar. */
test.describe('Filters', () => {
  test('quick category button', async ({ page }) => {
    await page.getByTestId('cat-electronics').click();
    await expect(page.getByTestId('cat-electronics')).toHaveAttribute('aria-pressed', 'true');
    await expectTotal(page, 6);
    await expect(page.getByTestId('promo-banner')).toHaveCount(0); // banner hides while filtering
  });

  test('multi-select two categories, then remove one with its chip', async ({ page }) => {
    await page.getByTestId('filter-cat').click();
    await page.getByTestId('filter-cat-option-kitchen').check();
    await page.getByTestId('filter-cat-option-home').check();
    await page.getByTestId('filter-cat-apply').click();
    await expect(page.getByTestId('filter-cat-summary')).toHaveText('2 selected');
    await expectTotal(page, 10);
    await page.getByTestId('filter-chip').filter({ hasText: 'Home' }).click();
    await expectTotal(page, 5);
  });

  test('select all and clear inside the multi-select', async ({ page }) => {
    await page.getByTestId('filter-color').click();
    await page.getByTestId('filter-color-select-all').click();
    await expect(page.getByTestId('filter-color-options').getByRole('checkbox', { checked: true })).toHaveCount(5);
    await page.getByTestId('filter-color-clear').click();
    await page.getByTestId('filter-color-option-clay').check();
    await page.getByTestId('filter-color-apply').click();
    await expectTotal(page, 12);
  });

  test('in stock only hides the three sold-out products', async ({ page }) => {
    await page.getByTestId('filter-in-stock').check();
    await expectTotal(page, 21);
    await expect(page.getByTestId('product-card').filter({ hasText: 'Out of stock' })).toHaveCount(0);
  });

  test('rating 4.5 and up', async ({ page }) => {
    await page.getByTestId('filter-rating-4-5').check();
    await expectTotal(page, 7);
  });

  test('price slider uses the sale price', async ({ page }) => {
    await page.getByTestId('filter-price').fill('20');
    await expect(page.getByTestId('filter-price-value')).toHaveText('$20.00');
    await page.getByTestId('filter-price').dispatchEvent('change'); // fill() fires input; the grid reloads on change
    await expectTotal(page, 4); // socks, tee, candle ($15.20 on sale), cutting board ($19.20 on sale)
    for (const p of await cardPrices(page)) expect(p).toBeLessThanOrEqual(20);
  });

  test('filters that match nothing show an empty state, Clear filters resets', async ({ page }) => {
    await page.getByTestId('cat-apparel').click();
    await page.getByTestId('filter-rating-4-5').check();
    await expect(page.getByTestId('empty-results')).toBeVisible();
    await page.getByTestId('filter-clear').click();
    await expectTotal(page, 24);
  });
});

/** Sorting, page size and the pager. */
test.describe('Sorting and paging', () => {
  test('price low to high, across the first page', async ({ page }) => {
    await page.getByTestId('sort-select').selectOption('price_asc');
    await expect(page.getByTestId('product-name').first()).toHaveText('Merino Trail Socks');
    const prices = await cardPrices(page);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
  });

  test('name A–Z', async ({ page }) => {
    await page.getByTestId('sort-select').selectOption('name');
    await expect(page.getByTestId('product-name').first()).toHaveText('Aluminum Laptop Stand');
  });

  test('paging: 8 per page, then 12 per page', async ({ page }) => {
    await expect(page.getByTestId('results-count')).toHaveText('24 products · page 1 of 3');
    await expect(page.getByTestId('page-prev')).toBeDisabled();
    await page.getByTestId('page-next').click();
    await expect(page.getByTestId('page-2')).toHaveAttribute('aria-current', 'page');
    await page.getByTestId('per-page').selectOption('12');
    await expect(page.getByTestId('results-count')).toHaveText('24 products · page 1 of 2');
    await expect(page.getByTestId('product-card')).toHaveCount(12);
  });

  test('every product appears exactly once across pages', async ({ page }) => {
    const seen: string[] = [];
    for (const p of [1, 2, 3]) {
      await page.getByTestId(`page-${p}`).click();
      await expect(page.getByTestId('results-count')).toHaveText(`24 products · page ${p} of 3`);
      await expect(page.getByTestId('product-card')).toHaveCount(8); // skeletons show while the page loads
      seen.push(...(await page.getByTestId('product-card').evaluateAll((els) => els.map((e) => e.getAttribute('data-sku')!))));
    }
    expect(new Set(seen).size).toBe(24);
  });
});

/** Product detail page: gallery, variants, quantity rules, pickup check, tabs and reviews. */
test.describe('Product page', () => {
  /** Opens a product by searching for it, the way a shopper would. */
  async function open(page: Page, term: string, name: string) {
    await page.getByTestId('search-input').fill(term);
    await page.getByTestId('search-suggestion').filter({ hasText: name }).click();
    await expect(page.getByTestId('product-title')).toHaveText(name);
  }

  test('breadcrumb, SKU, stock and color swatch', async ({ page }) => {
    await open(page, 'speaker', 'Bluetooth Speaker');
    await expect(page.getByTestId('breadcrumbs')).toContainText('Electronics');
    await expect(page.getByTestId('product-sku')).toHaveText(/^KM-/);
    await expect(page.getByTestId('stock-status')).toHaveText('In stock');
    await page.getByTestId('swatch-ink').click();
    await expect(page.getByTestId('selected-color')).toHaveText('Ink');
    await expect(page.getByTestId('swatch-ink')).toHaveAttribute('aria-pressed', 'true');
  });

  test('thumbnails change the main image', async ({ page }) => {
    await open(page, 'speaker', 'Bluetooth Speaker');
    await page.getByTestId('thumb-3').click();
    await expect(page.getByTestId('product-image')).toHaveAttribute('aria-label', 'Bluetooth Speaker, view 3');
  });

  test('size is required, and sold-out sizes are disabled', async ({ page }) => {
    await open(page, 'tee', 'Everyday Crew Tee');
    await expect(page.getByTestId('stock-status')).toHaveText('Only 3 left');
    await expect(page.getByTestId('size-select').locator('option', { hasText: 'XS' })).toBeDisabled();
    await page.getByTestId('add-to-cart').click();
    await expect(page.getByTestId('size-error')).toHaveText('Choose a size before adding to cart.');
    await page.getByTestId('size-select').selectOption('M');
    await page.getByTestId('add-to-cart').click();
    await expect(page.getByTestId('toast')).toContainText('Added 1 × Everyday Crew Tee');
    await expect(page.getByTestId('cart-count')).toHaveText('1');
  });

  test('quantity stays between 1 and 10', async ({ page }) => {
    await open(page, 'speaker', 'Bluetooth Speaker');
    await page.getByTestId('qty-decrease').click();
    await expect(page.getByTestId('qty-input')).toHaveValue('1');
    await page.getByTestId('qty-input').fill('11');
    await expect(page.getByTestId('qty-error')).toHaveText('Enter a quantity from 1 to 10.');
    await page.getByTestId('qty-input').fill('9');
    await page.getByTestId('qty-increase').click();
    await page.getByTestId('qty-increase').click();
    await expect(page.getByTestId('qty-input')).toHaveValue('10');
  });

  test('out-of-stock product cannot be added', async ({ page }) => {
    await open(page, 'lamp', 'Ceramic Table Lamp');
    await expect(page.getByTestId('add-to-cart')).toBeDisabled();
    await expect(page.getByTestId('add-to-cart')).toHaveText('Out of stock');
  });

  test('store pickup check validates the ZIP', async ({ page }) => {
    await open(page, 'speaker', 'Bluetooth Speaker');
    await page.getByTestId('zip-input').fill('123');
    await page.getByTestId('zip-check').click();
    await expect(page.getByTestId('zip-result')).toHaveText('Enter a 5-digit ZIP code.');
    await page.getByTestId('zip-input').fill('94583');
    await page.getByTestId('zip-check').click();
    await expect(page.getByTestId('store-row')).toHaveCount(2);
    await expect(page.getByTestId('store-row').first()).toContainText('Kestrel Market Downtown · 2.4 mi');
  });

  test('tabs and "load more" reviews until there are no more', async ({ page }) => {
    await open(page, 'speaker', 'Bluetooth Speaker');
    await page.getByTestId('tab-specs').click();
    await expect(page.getByTestId('tab-specs')).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByTestId('spec-table')).toContainText('Units in stock');
    await page.getByTestId('tab-reviews').click();
    await expect(page.getByTestId('review')).toHaveCount(3);
    for (const n of [6, 9, 12]) {
      await page.getByTestId('reviews-load-more').click();
      await expect(page.getByTestId('review')).toHaveCount(n);
    }
    await expect(page.getByTestId('reviews-load-more')).toBeHidden();
  });

  test('wishlist toggle', async ({ page }) => {
    await open(page, 'speaker', 'Bluetooth Speaker');
    await page.getByTestId('wishlist-toggle').click();
    await expect(page.getByTestId('wishlist-toggle')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('wishlist-toggle')).toHaveText('Saved');
  });
});
