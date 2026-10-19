/**
 * @file REST API tests for the shop: products, reviews, stores, auth, cart, promo codes,
 * orders, reset, chaos mode and error shapes.
 *
 * Every test that writes sends a fresh `X-Session-Id`, so tests never share a cart and can run in parallel.
 * Run: `npx playwright test specs/api.spec.ts`
 */
import { test, expect } from '@playwright/test';
import { sessionHeaders } from '../support/lab';

/** Base path of the lab API. */
const API = '/api/v1';

/** Core shop API flows, kept short for the API video. */
test.describe('Practice Lab API', () => {
  test('search returns the lamp with a stable price', async ({ request }) => {
    const r = await request.get(`${API}/products`, { params: { q: 'lamp' } });
    expect(r.status()).toBe(200);
    const body = await r.json();
    expect(body.total).toBe(1);
    expect(body.items[0]).toMatchObject({ id: 'p-1011', name: 'Ceramic Table Lamp', price: 64 });
  });

  test('locked_user cannot sign in', async ({ request }) => {
    const r = await request.post(`${API}/auth/login`, { data: { username: 'locked_user', password: 'practice123' } });
    expect(r.status()).toBe(403);
    expect((await r.json()).error).toContain('locked');
  });

  test('out-of-stock product is rejected', async ({ request }) => {
    const r = await request.post(`${API}/cart/items`, { headers: sessionHeaders(), data: { productId: 'p-1011', qty: 1 } });
    expect(r.status()).toBe(409);
    expect((await r.json()).error).toContain('out of stock');
  });

  test('cart validates quantity', async ({ request }) => {
    const r = await request.post(`${API}/cart/items`, { headers: sessionHeaders(), data: { productId: 'p-1011', qty: 11 } });
    expect(r.status()).toBe(422);
    expect(await r.json()).toMatchObject({ field: 'qty' });
  });

  test('orders need a token', async ({ request }) => {
    const r = await request.post(`${API}/orders`, { headers: sessionHeaders(), data: {} });
    expect(r.status()).toBe(401);
  });

  test('full order: login, add, apply SAVE10, place order', async ({ request }) => {
    const h = sessionHeaders();
    const { token } = await (await request.post(`${API}/auth/login`, { data: { username: 'standard_user', password: 'practice123' } })).json();
    expect((await request.post(`${API}/cart/items`, { headers: h, data: { productId: 'p-1017', qty: 2 } })).status()).toBe(201);
    const cart = await (await request.get(`${API}/cart`, { headers: h, params: { promo: 'SAVE10' } })).json();
    expect(cart).toMatchObject({ count: 2, subtotal: 118, discount: 11.8, shipping: 0 });
    const order = await request.post(`${API}/orders`, {
      headers: { ...h, Authorization: `Bearer ${token}` },
      data: { promo: 'SAVE10', shipping: { name: 'Sam Standard', email: 'sam@example.com', address: '100 Main St', city: 'San Ramon', state: 'CA', zip: '94583' } },
    });
    expect(order.status()).toBe(201);
    expect((await order.json()).orderId).toMatch(/^KM-\d{5}$/);
    expect((await (await request.get(`${API}/cart`, { headers: h })).json()).count).toBe(0);
  });
});

/** Catalog queries: filters, sorting, paging and lookups. */
test.describe('Products API', () => {
  test('health check', async ({ request }) => {
    const r = await request.get(`${API}/health`);
    expect(r.status()).toBe(200);
    expect(await r.json()).toMatchObject({ ok: true });
  });

  test('24 products, 8 per page by default', async ({ request }) => {
    const body = await (await request.get(`${API}/products`)).json();
    expect(body).toMatchObject({ total: 24, page: 1, pages: 3, limit: 8 });
    expect(body.items).toHaveLength(8);
  });

  test('filters combine: category, color, in stock, max price', async ({ request }) => {
    const body = await (await request.get(`${API}/products`, { params: { category: 'Electronics', color: 'Clay', inStock: 'true', maxPrice: 60, limit: 50 } })).json();
    for (const p of body.items) {
      expect(p.category).toBe('Electronics');
      expect(p.colors).toContain('Clay');
      expect(p.stock).toBeGreaterThan(0);
      expect(p.salePrice ?? p.price).toBeLessThanOrEqual(60);
    }
    expect(body.items.map((p: any) => p.id).sort()).toEqual(['p-1016', 'p-1024']);
  });

  test('sort by price uses the sale price', async ({ request }) => {
    const body = await (await request.get(`${API}/products`, { params: { sort: 'price_desc', limit: 50 } })).json();
    const prices = body.items.map((p: any) => p.salePrice ?? p.price);
    expect(prices).toEqual([...prices].sort((a: number, b: number) => b - a));
  });

  test('pages do not overlap', async ({ request }) => {
    const ids = new Set<string>();
    for (const page of [1, 2, 3]) for (const p of (await (await request.get(`${API}/products`, { params: { page } })).json()).items) ids.add(p.id);
    expect(ids.size).toBe(24);
  });

  test('one product, and an unknown id is 404', async ({ request }) => {
    expect(await (await request.get(`${API}/products/p-1017`)).json()).toMatchObject({ id: 'p-1017', name: 'Bluetooth Speaker', price: 59 });
    const missing = await request.get(`${API}/products/p-9999`);
    expect(missing.status()).toBe(404);
    expect((await missing.json()).error).toBeTruthy();
  });

  test('reviews are paged, 3 per page, 4 pages', async ({ request }) => {
    const p1 = await (await request.get(`${API}/products/p-1017/reviews`, { params: { page: 1 } })).json();
    expect(p1).toMatchObject({ page: 1, hasMore: true });
    expect(p1.items).toHaveLength(3);
    expect((await (await request.get(`${API}/products/p-1017/reviews`, { params: { page: 4 } })).json()).hasMore).toBe(false);
  });

  test('store availability validates the ZIP', async ({ request }) => {
    const ok = await (await request.get(`${API}/stores/availability`, { params: { productId: 'p-1017', zip: '94583' } })).json();
    expect(ok.stores).toHaveLength(2);
    const bad = await request.get(`${API}/stores/availability`, { params: { productId: 'p-1017', zip: '9458' } });
    expect(bad.status()).toBe(422);
  });
});

/** Cart writes, promo validation, order rules and reset. */
test.describe('Cart and orders API', () => {
  test('add, change and remove a line', async ({ request }) => {
    const headers = sessionHeaders();
    await request.post(`${API}/cart/items`, { headers, data: { productId: 'p-1006', qty: 1 } });
    const cart = await (await request.get(`${API}/cart`, { headers })).json();
    const lineId = cart.items[0].lineId;
    expect((await request.patch(`${API}/cart/items/${lineId}`, { headers, data: { qty: 4 } })).status()).toBe(200);
    expect((await (await request.get(`${API}/cart`, { headers })).json()).count).toBe(4);
    expect((await request.delete(`${API}/cart/items/${lineId}`, { headers })).status()).toBe(200);
    expect((await (await request.get(`${API}/cart`, { headers })).json()).count).toBe(0);
  });

  test('apparel needs a size, and colors must exist', async ({ request }) => {
    const headers = sessionHeaders();
    const noSize = await request.post(`${API}/cart/items`, { headers, data: { productId: 'p-1001', qty: 1 } });
    expect(noSize.status()).toBe(422);
    const badColor = await request.post(`${API}/cart/items`, { headers, data: { productId: 'p-1006', qty: 1, color: 'Purple' } });
    expect(badColor.status()).toBe(422);
    expect((await badColor.json()).field).toBe('color');
  });

  test('promo codes', async ({ request }) => {
    expect(await (await request.post(`${API}/promo/validate`, { data: { code: ' save10 ' } })).json()).toMatchObject({ code: 'SAVE10', type: 'pct', value: 10 });
    expect((await request.post(`${API}/promo/validate`, { data: { code: 'NOPE' } })).status()).toBe(404);
  });

  test('ordering with an empty cart is 409, missing fields are 422', async ({ request }) => {
    const headers = sessionHeaders();
    const { token } = await (await request.post(`${API}/auth/login`, { data: { username: 'standard_user', password: 'practice123' } })).json();
    const auth = { ...headers, Authorization: `Bearer ${token}` };
    expect((await request.post(`${API}/orders`, { headers: auth, data: { shipping: {} } })).status()).toBe(409);
    await request.post(`${API}/cart/items`, { headers, data: { productId: 'p-1006', qty: 1 } });
    const missing = await request.post(`${API}/orders`, { headers: auth, data: { shipping: { name: 'Sam' } } });
    expect(missing.status()).toBe(422);
    expect((await missing.json()).fields).toEqual(expect.arrayContaining(['email', 'zip']));
  });

  test('orders are listed after they are placed', async ({ request }) => {
    const headers = sessionHeaders();
    const { token } = await (await request.post(`${API}/auth/login`, { data: { username: 'standard_user', password: 'practice123' } })).json();
    const auth = { ...headers, Authorization: `Bearer ${token}` };
    await request.post(`${API}/cart/items`, { headers, data: { productId: 'p-1006', qty: 1 } });
    const placed = await (await request.post(`${API}/orders`, { headers: auth, data: { shipping: { name: 'Sam Standard', email: 'sam@example.com', address: '100 Main St', city: 'San Ramon', state: 'CA', zip: '94583' } } })).json();
    const list = await (await request.get(`${API}/orders`, { headers: auth })).json();
    expect(JSON.stringify(list)).toContain(placed.orderId);
  });

  test('reset empties the cart', async ({ request }) => {
    const headers = sessionHeaders();
    await request.post(`${API}/cart/items`, { headers, data: { productId: 'p-1006', qty: 2 } });
    expect((await request.post(`${API}/reset`, { headers })).status()).toBe(200);
    expect((await (await request.get(`${API}/cart`, { headers })).json()).count).toBe(0);
  });

  test('unknown route is 404 with a JSON error', async ({ request }) => {
    const r = await request.get(`${API}/does-not-exist`);
    expect(r.status()).toBe(404);
    expect(r.headers()['content-type']).toContain('application/json');
  });
});

/** Chaos mode adds latency and random 503s. Tests must retry 503 without hiding real failures. */
test.describe('Chaos mode', () => {
  /**
   * GET with retries on 503 only, honoring Retry-After. Any other status is returned at once,
   * so a real 4xx or 500 still fails the test.
   * @param request Playwright API request context.
   * @param url Path to fetch.
   * @param tries Maximum attempts.
   */
  async function getWithRetry(request: any, url: string, tries = 6) {
    for (let i = 1; ; i++) {
      const r = await request.get(url, { headers: { 'X-Chaos': '1' } });
      if (r.status() !== 503 || i === tries) return r;
      await new Promise((res) => setTimeout(res, Number(r.headers()['retry-after'] || 1) * 1000));
    }
  }

  test('503s are retried and the request succeeds', async ({ request }) => {
    test.setTimeout(90_000);
    const r = await getWithRetry(request, `${API}/products/p-1017`);
    expect(r.status()).toBe(200);
  });

  test('chaos adds latency', async ({ request }) => {
    test.setTimeout(60_000);
    const t0 = Date.now();
    await getWithRetry(request, `${API}/health`);
    expect(Date.now() - t0).toBeGreaterThan(700);
  });
});
