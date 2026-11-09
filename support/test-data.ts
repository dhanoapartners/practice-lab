/**
 * @file All fixed test data in one place (Chapter 14).
 *
 * Every value here is fictional and stable on the lab. Tests import from this file instead of
 * repeating literals, so a change (a new password, a renamed product) is made once.
 */

/** Password shared by every lab user. */
export const PASSWORD = 'practice123';

/** The lab's special users and what each one does. */
export const USERS = {
  standard: 'standard_user',
  /** Sign-in is refused with 403. */
  locked: 'locked_user',
  /** Every request takes about 3 seconds longer. */
  slow: 'slow_user',
  /** About half of all writes fail with 500. */
  error: 'error_user',
} as const;

/** Products with known, stable details. */
export const PRODUCTS = {
  speaker: { id: 'p-1017', name: 'Bluetooth Speaker' },
  /** $35.00, no variants: the simplest item to buy. */
  simple: { id: 'p-1006', price: 35 },
  outOfStock: ['p-1004', 'p-1011', 'p-1018'],
} as const;

/** Promo codes the store accepts. */
export const PROMO = { save10: 'SAVE10', freeShip: 'FREESHIP' } as const;

/** A fictional shipping address. */
export const ADDRESS = {
  name: 'Sam Standard',
  email: 'sam@example.com',
  street: '100 Main St',
  city: 'San Ramon',
  state: 'CA',
  zip: '94583',
} as const;

/** Card numbers from the lab's test-card table (not real cards). */
export const CARDS = {
  success: '4242424242424242',
  declined: '4000000000000002',
  expiry: '1230',
  cvc: '123',
} as const;
