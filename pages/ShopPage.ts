/**
 * @file Page object for the Kestrel Market shop (Chapter 13).
 *
 * A page object keeps locators and steps for one screen in one class. Tests call `shop.search('speaker')`
 * instead of repeating test IDs, so when a release renames an element you fix it here, once.
 */
import { expect, type Locator, type Page } from '@playwright/test';
import { labUrl } from '../support/lab';

export class ShopPage {
  readonly search: Locator;
  readonly suggestions: Locator;
  readonly cards: Locator;
  readonly resultsCount: Locator;
  readonly productTitle: Locator;
  readonly addToCart: Locator;
  readonly cartCount: Locator;

  constructor(private readonly page: Page) {
    this.search = page.getByTestId('search-input');
    this.suggestions = page.getByTestId('search-suggestion');
    this.cards = page.getByTestId('product-card');
    this.resultsCount = page.getByTestId('results-count');
    this.productTitle = page.getByTestId('product-title');
    this.addToCart = page.getByTestId('add-to-cart');
    this.cartCount = page.getByTestId('cart-count');
  }

  /** Opens the shop. */
  async open() {
    await this.page.goto(labUrl('shop'));
  }

  /** Types a search and opens the first suggestion's product page. */
  async openFirstSuggestion(text: string) {
    await this.search.fill(text);
    await this.suggestions.first().click();
  }

  /** Adds the open product to the cart and waits for the API to confirm. */
  async addOpenProductToCart() {
    const added = this.page.waitForResponse((r) => r.url().includes('/api/v1/cart/items') && r.request().method() === 'POST');
    await this.addToCart.click();
    expect((await added).status()).toBe(201);
  }

  /** Waits until the result line reports `n` products. */
  async expectResults(n: number) {
    await expect(this.resultsCount).toHaveText(new RegExp(`^${n} products?\\b`));
  }
}
