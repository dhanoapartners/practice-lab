/**
 * @file Page object for the cart and the four-step checkout (Chapter 13).
 *
 * Methods are steps a user takes ("fill shipping", "pay"), not clicks. Tests read like the journey,
 * and the test IDs live here only.
 */
import { expect, type Page } from '@playwright/test';
import { labUrl } from '../support/lab';
import { ADDRESS, CARDS } from '../support/test-data';

export class CheckoutPage {
  constructor(private readonly page: Page) {}

  /** Puts items in this browser's cart through the API (faster and steadier than the UI). */
  async seedCart(items: { productId: string; qty: number }[]) {
    await this.page.goto(labUrl('hub'));
    // The hub's first API call sets the session cookie; wait for it so the API calls share the page's cart.
    await expect.poll(async () => (await this.page.context().cookies()).some((c) => c.name === 'lab_sid')).toBe(true);
    for (const i of items) expect((await this.page.request.post('/api/v1/cart/items', { data: i })).status()).toBe(201);
  }

  /** Opens the cart and starts checkout. */
  async start() {
    await this.page.goto(labUrl('cart'));
    await this.page.getByTestId('checkout-button').click();
  }

  /** Step 1: shipping details. */
  async fillShipping(a = ADDRESS) {
    const p = this.page;
    await p.getByTestId('ship-name').fill(a.name);
    await p.getByTestId('ship-email').fill(a.email);
    await p.getByTestId('ship-address').fill(a.street);
    await p.getByTestId('ship-city').fill(a.city);
    await p.getByTestId('ship-state').selectOption(a.state);
    await p.getByTestId('ship-zip').fill(a.zip);
    await p.getByTestId('shipping-continue').click();
  }

  /** Step 2: delivery speed. */
  async chooseDelivery(speed: 'standard' | 'express' = 'standard') {
    await this.page.getByTestId(`delivery-${speed}`).check();
    await this.page.getByTestId('delivery-continue').click();
  }

  /** Step 3: card details. */
  async pay(card: string = CARDS.success) {
    await this.page.getByTestId('pay-card').fill(card);
    await this.page.getByTestId('pay-expiry').fill(CARDS.expiry);
    await this.page.getByTestId('pay-cvc').fill(CARDS.cvc);
    await this.page.getByTestId('payment-continue').click();
  }

  /** Step 4: place the order and return its number. */
  async placeOrder(): Promise<string> {
    await this.page.getByTestId('place-order').click();
    const n = this.page.getByTestId('order-number');
    await expect(n).toHaveText(/^KM-\d+$/);
    return (await n.textContent())!;
  }

  /** The total shown on the review step. */
  reviewTotal() {
    return this.page.getByTestId('review-total');
  }
}
