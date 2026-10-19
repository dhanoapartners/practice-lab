import { test, expect } from '@playwright/test';
import { sessionHeaders } from '../support/lab';

const API = '/api/v1';

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
