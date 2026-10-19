/**
 * @file Independent copy of Kestrel Market's published pricing rules.
 *
 * Tests compute the expected cart totals here instead of reading them from the page,
 * so a pricing bug on the site shows up as a mismatch rather than being copied into the test.
 * Rules come from the lab's help documents: 8.25% tax on the subtotal after discounts,
 * $7.95 standard shipping, free shipping at $75 or more (before discounts) or with FREESHIP.
 */

/** Sales tax rate applied to the subtotal after discounts. */
export const TAX_RATE = 0.0825;
/** Standard shipping fee in USD. */
export const SHIPPING_FEE = 7.95;
/** Orders with a subtotal at or above this amount ship free. */
export const FREE_SHIPPING_OVER = 75;

/** Rounds half-up to the cent, avoiding floating-point drift such as 1.005 → 1.00. */
export const cents = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Formats a number the way the site shows money, for example `$1,234.50`. */
export const money = (n: number) => '$' + n.toFixed(2);

/** A cart line for {@link expectedTotals}: unit price (sale price if on sale) and quantity. */
export interface Line { price: number; qty: number }

/**
 * Expected order summary for a cart.
 * @param lines Cart lines with their effective unit price.
 * @param promo Optional promo code: `SAVE10` (10% off) or `FREESHIP`.
 * @returns Subtotal, discount, shipping, tax and total, each rounded to the cent.
 * @example expectedTotals([{ price: 35, qty: 1 }], 'SAVE10') // { subtotal: 35, discount: 3.5, shipping: 7.95, tax: 2.6, total: 42.05 }
 */
export function expectedTotals(lines: Line[], promo?: 'SAVE10' | 'FREESHIP') {
  const subtotal = cents(lines.reduce((s, l) => s + l.price * l.qty, 0));
  const discount = promo === 'SAVE10' ? cents(subtotal * 0.1) : 0;
  const shipping = subtotal === 0 || subtotal >= FREE_SHIPPING_OVER || promo === 'FREESHIP' ? 0 : SHIPPING_FEE;
  const tax = cents((subtotal - discount) * TAX_RATE);
  return { subtotal, discount, shipping, tax, total: cents(subtotal - discount + shipping + tax) };
}
