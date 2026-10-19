import type { Target } from './healer';

// One place for every element the UI tests touch. The primary locator is the
// test ID; the other fields are the "fingerprint" the healer falls back on
// when a release changes the test ID.
export const L = {
  searchInput:  { key: 'searchInput',  testId: 'search-input',      role: 'searchbox', name: 'Search products' },
  suggestion:   { key: 'suggestion',   testId: 'search-suggestion', role: 'option' },
  productTitle: { key: 'productTitle', testId: 'product-title',     role: 'heading', roleOptions: { level: 1 } },
  addToCart:    { key: 'addToCart',    testId: 'add-to-cart',       role: 'button', name: 'Add to cart', text: 'Add to cart' },
  cartCount:    { key: 'cartCount',    testId: 'cart-count',        css: '#cartCount' },
  headerCart:   { key: 'headerCart',   testId: 'header-cart',       role: 'button', name: 'Cart' },
  checkout:     { key: 'checkout',     testId: 'checkout-button',   role: 'button', name: 'Check out', css: '#toCheckout' },
} satisfies Record<string, Target>;
