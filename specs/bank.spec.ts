import { test, expect, APIRequestContext } from '@playwright/test';
import { labUrl, sessionHeaders } from '../support/lab';

// Harbor Demo Bank: a fictional bank. Every customer, account, merchant and card is synthetic.
// Seed history (Jul–Sep 2026) never changes, so balances below are stable.
// Each test gets its own session, so transfers and payments never leak between tests.

const BANK = '/api/v1/bank';
const SEED = { checking: 7707.3, savings: 9488.57, cardOwed: 1325.94, cardAvailable: 3674.06 };
const today = () => new Date().toISOString().slice(0, 10);
const plusDays = (n: number) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
const key = () => crypto.randomUUID();

/** Standard amortization, rounded half-up to the cent. Computed independently of the bank. */
function expectedPayment(amount: number, aprPct: number, months: number) {
  const r = aprPct / 100 / 12;
  const raw = (amount * r) / (1 - Math.pow(1 + r, -months));
  return Math.round((raw + Number.EPSILON) * 100) / 100;
}

/** A small API client bound to one isolated session and, optionally, one planted defect. */
function bank(request: APIRequestContext, bug = 'none') {
  const headers = { ...sessionHeaders(), ...(bug !== 'none' ? { 'X-Bank-Bug': bug } : {}) };
  return {
    accounts: async () => (await (await request.get(`${BANK}/accounts`, { headers })).json()).items as any[],
    balance: async (id: string) => ((await (await request.get(`${BANK}/accounts`, { headers })).json()).items as any[]).find((a) => a.id === id),
    transfer: (data: object, idem?: string) => request.post(`${BANK}/transfers`, { headers: { ...headers, ...(idem ? { 'Idempotency-Key': idem } : {}) }, data }),
    transfers: async () => (await (await request.get(`${BANK}/transfers`, { headers })).json()),
    price: (data: object) => request.post(`${BANK}/pricing`, { headers, data }),
    pay: (data: object, idem?: string) => request.post(`${BANK}/payments`, { headers: { ...headers, ...(idem ? { 'Idempotency-Key': idem } : {}) }, data }),
    payments: async () => (await (await request.get(`${BANK}/payments`, { headers })).json()).items as any[],
    get: (path: string) => request.get(BANK + path, { headers }),
    post: (path: string, data: object) => request.post(BANK + path, { headers, data }),
    patch: (path: string, data: object) => request.patch(BANK + path, { headers, data }),
    del: (path: string) => request.delete(BANK + path, { headers }),
  };
}
const card = (number: string) => ({ number, expMonth: 12, expYear: new Date().getUTCFullYear() + 2, cvc: '123' });

// ---------------------------------------------------------------- API
test.describe('Bank API', () => {
  test('seed balances are stable', async ({ request }) => {
    const a = await bank(request).accounts();
    expect(a.map((x) => x.id)).toEqual(['CHK-1001', 'SAV-2001', 'CC-3001']);
    expect(a[0].balance).toBe(SEED.checking);
    expect(a[1].balance).toBe(SEED.savings);
    expect(a[2]).toMatchObject({ balance: SEED.cardOwed, creditLimit: 5000, available: SEED.cardAvailable });
  });

  test('running balance on the newest row equals the account balance', async ({ request }) => {
    const r = await (await bank(request).get('/transactions?accountId=CHK-1001&limit=1')).json();
    expect(r.total).toBe(39);
    expect(r.items[0].runningBalance).toBe(SEED.checking);
  });

  test('statement filters and totals', async ({ request }) => {
    const r = await (await bank(request).get('/transactions?accountId=CHK-1001&q=payroll')).json();
    expect(r.totals).toEqual({ debits: 0, credits: 14100, count: 6 });
    const bad = await bank(request).get('/transactions?from=2026-09-30&to=2026-09-01');
    expect(bad.status()).toBe(422);
  });

  test('transfer goes pending, then posts', async ({ request }) => {
    const b = bank(request);
    const r = await b.transfer({ fromAccountId: 'CHK-1001', toAccountId: 'SAV-2001', amount: '100.00' }, key());
    expect(r.status()).toBe(201);
    const tr = await r.json();
    expect(tr.status).toBe('pending');
    const chk = await b.balance('CHK-1001');
    expect(chk.balance).toBe(SEED.checking); // ledger unchanged while pending
    expect(chk.available).toBe(+(SEED.checking - 100).toFixed(2)); // available drops at once
    await expect.poll(async () => (await b.transfers()).items[0].status, { timeout: 15_000, intervals: [1000] }).toBe('posted');
    expect((await b.balance('CHK-1001')).balance).toBe(+(SEED.checking - 100).toFixed(2));
  });

  test('same Idempotency-Key books the transfer once', async ({ request }) => {
    const b = bank(request); const k = key();
    const body = { fromAccountId: 'CHK-1001', toAccountId: 'SAV-2001', amount: 50 };
    expect((await b.transfer(body, k)).status()).toBe(201);
    const replay = await b.transfer(body, k);
    expect(replay.status()).toBe(200);
    expect((await replay.json()).replayed).toBe(true);
    expect((await b.transfers()).items).toHaveLength(1);
    const conflict = await b.transfer({ ...body, amount: 51 }, k);
    expect(conflict.status()).toBe(409);
  });

  test('money validation', async ({ request }) => {
    const b = bank(request);
    const cases: [object, number, string][] = [
      [{ fromAccountId: 'CHK-1001', toAccountId: 'SAV-2001', amount: '10.005' }, 422, 'at most 2 decimal'],
      [{ fromAccountId: 'CHK-1001', toAccountId: 'SAV-2001', amount: 0 }, 422, 'greater than 0'],
      [{ fromAccountId: 'CHK-1001', toAccountId: 'CHK-1001', amount: 5 }, 422, 'must be different'],
      [{ fromAccountId: 'CC-3001', toAccountId: 'CHK-1001', amount: 5 }, 422, 'credit card'],
      [{ fromAccountId: 'SAV-2001', toAccountId: 'CHK-1001', amount: 20000 }, 422, 'Insufficient funds'],
      [{ fromAccountId: 'CHK-1001', toAccountId: 'CC-3001', amount: 2000 }, 422, 'more than the card balance'],
      [{ fromAccountId: 'CHK-1001', toAccountId: 'SAV-2001', amount: 5, date: '2020-01-01' }, 422, 'past'],
    ];
    for (const [data, status, msg] of cases) {
      const r = await b.transfer(data);
      expect(r.status(), JSON.stringify(data)).toBe(status);
      expect((await r.json()).error).toContain(msg);
    }
  });

  test('daily limit boundary: 2500.00 passes, 0.01 more fails', async ({ request }) => {
    const b = bank(request);
    expect((await b.transfer({ fromAccountId: 'CHK-1001', toAccountId: 'SAV-2001', amount: 2500 })).status()).toBe(201);
    const over = await b.transfer({ fromAccountId: 'CHK-1001', toAccountId: 'SAV-2001', amount: 0.01 });
    expect(over.status()).toBe(422);
    expect((await over.json()).code).toBe('daily_limit');
    expect((await b.transfers()).remainingToday).toBe(0);
  });

  test('scheduled transfer can be cancelled, posted cannot', async ({ request }) => {
    const b = bank(request);
    const s = await (await b.transfer({ fromAccountId: 'CHK-1001', toAccountId: 'SAV-2001', amount: 25, date: plusDays(7) })).json();
    expect(s.status).toBe('scheduled');
    expect((await b.balance('CHK-1001')).available).toBe(SEED.checking); // scheduled money is not held yet
    expect((await (await b.del(`/transfers/${s.id}`)).json()).status).toBe('cancelled');
    const posted = await (await b.transfer({ fromAccountId: 'CHK-1001', toAccountId: 'SAV-2001', amount: 5 })).json();
    expect((await b.del(`/transfers/${posted.id}`)).status()).toBe(409);
  });

  test('pricing matches the rate sheet and the amortization formula', async ({ request }) => {
    const b = bank(request);
    const cases = [
      { in: { product: 'auto', amount: 25000, termMonths: 60, creditScore: 742, collateralValue: 40000 }, apr: 6.99, decision: 'approved' },
      { in: { product: 'auto', amount: 20000, termMonths: 60, creditScore: 780, collateralValue: 40000 }, apr: 6.24, decision: 'approved' }, // 6.99 - 0.50 - 0.25
      { in: { product: 'personal', amount: 8000, termMonths: 36, creditScore: 680 }, apr: 9.99, decision: 'approved' }, // 6.49 + 2 + 1.25 + 0.25
      { in: { product: 'auto', amount: 25000, termMonths: 60, creditScore: 600, collateralValue: 40000 }, apr: null, decision: 'declined' },
      { in: { product: 'auto', amount: 30000, termMonths: 84, creditScore: 720, collateralValue: 25000 }, apr: null, decision: 'declined' }, // LTV 120%
    ];
    for (const c of cases) {
      const q = await (await b.price(c.in)).json();
      expect(q.decision, JSON.stringify(c.in)).toBe(c.decision);
      expect(q.apr).toBe(c.apr);
      if (c.apr !== null) {
        expect(q.monthlyPayment).toBe(expectedPayment(c.in.amount, c.apr, c.in.termMonths));
        expect(q.breakdown.reduce((s: number, x: any) => s + x.adjustment, 0)).toBeCloseTo(q.apr, 6);
      }
    }
    const badTerm = await b.price({ product: 'personal', amount: 8000, termMonths: 84, creditScore: 700 });
    expect(badTerm.status()).toBe(422);
  });

  test('high debt-to-income is referred, not approved', async ({ request }) => {
    const q = await (await bank(request).price({ product: 'personal', amount: 40000, termMonths: 36, creditScore: 720, monthlyIncome: 4000, monthlyDebts: 900 })).json();
    expect(q.decision).toBe('referred');
    expect(q.reasons.join(' ')).toContain('Debt-to-income');
  });

  test('loan application: draft, then submit', async ({ request }) => {
    const b = bank(request);
    const draft = await b.post('/loans', { applicant: { firstName: 'Jordan', lastName: 'Rivera' } });
    expect(draft.status()).toBe(201);
    const { id } = await draft.json();
    const underage = await b.patch(`/loans/${id}`, { applicant: { dob: '2015-06-01' } });
    expect(underage.status()).toBe(422);
    expect((await underage.json()).errors[0].field).toBe('applicant.dob');
    const submitted = await b.patch(`/loans/${id}`, {
      submit: true, consent: true,
      applicant: { email: 'jordan@example.com', dob: '1990-04-12' },
      employment: { status: 'employed', employer: 'Acme Analytics', monthlyIncome: 6000, monthlyDebts: 400 },
      loan: { product: 'auto', amount: 25000, termMonths: 60, creditScore: 742 },
      collateral: { year: 2022, make: 'Subaru', value: 40000 },
    });
    expect(submitted.status()).toBe(200);
    expect(await submitted.json()).toMatchObject({ id, status: 'approved', pricing: { apr: 6.99, monthlyPayment: 494.91 } });
    expect((await b.patch(`/loans/${id}`, { applicant: { firstName: 'Changed' } })).status()).toBe(409); // submitted is locked
  });

  test('payments sandbox outcomes', async ({ request }) => {
    const b = bank(request);
    const outcomes: [string, number, string, string | null][] = [
      ['4242424242424242', 201, 'succeeded', null],
      ['4000000000000002', 402, 'failed', 'card_declined'],
      ['4000000000009995', 402, 'failed', 'insufficient_funds'],
      ['4100000000000019', 402, 'blocked', 'fraudulent'],
      ['4000000000003220', 201, 'requires_action', null],
    ];
    for (const [num, code, status, decline] of outcomes) {
      const r = await b.pay({ amount: '19.99', card: card(num) }, key());
      expect(r.status(), num).toBe(code);
      expect(await r.json()).toMatchObject({ status, declineCode: decline });
    }
    const invalid = await b.pay({ amount: 5, card: card('4242424242424241') });
    expect((await invalid.json()).code).toBe('invalid_number');
  });

  test('refunds cannot exceed what was charged', async ({ request }) => {
    const b = bank(request);
    const p = await (await b.pay({ amount: '40.00', card: card('4242424242424242') }, key())).json();
    expect((await (await b.post(`/payments/${p.id}/refunds`, { amount: '15.00' })).json()).status).toBe('partially_refunded');
    const tooMuch = await b.post(`/payments/${p.id}/refunds`, { amount: '25.01' });
    expect(tooMuch.status()).toBe(422);
    expect((await (await b.post(`/payments/${p.id}/refunds`, { amount: '25.00' })).json())).toMatchObject({ status: 'refunded', refunded: 40 });
  });

  test('webhook events: sort by seq, not by arrival', async ({ request }) => {
    const b = bank(request);
    const p = await (await b.pay({ amount: '12.00', card: card('4242424242424242') }, key())).json();
    await b.post(`/payments/${p.id}/refunds`, {});
    const arrived = (await (await b.get(`/payments/${p.id}/events?order=delivery`)).json()).items;
    expect(arrived[0].type).not.toBe('payment.created'); // out of order on purpose
    const ordered = arrived.slice().sort((x: any, y: any) => x.seq - y.seq).map((e: any) => e.type);
    expect(ordered).toEqual(['payment.created', 'payment.succeeded', 'payment.refunded']);
  });
});

// ---------------------------------------------------------------- planted defects
// Each check must pass on the correct bank and fail when its defect is planted.
// If a check ever passes with its defect on, the check is too weak.
test.describe('Planted bank defects are caught', () => {
  const checks: Record<string, (r: APIRequestContext, bug: string) => Promise<boolean>> = {
    async double_post(r, bug) {
      const b = bank(r, bug); const k = key(); const body = { fromAccountId: 'CHK-1001', toAccountId: 'SAV-2001', amount: 75 };
      await b.transfer(body, k); await b.transfer(body, k); // a retry after a timeout
      return (await b.transfers()).items.length === 1;
    },
    async limit_off_by_one(r, bug) {
      const res = await bank(r, bug).transfer({ fromAccountId: 'CHK-1001', toAccountId: 'SAV-2001', amount: 2500.01 });
      return res.status() === 422;
    },
    async rounding(r, bug) {
      // 20,000 over 60 months at 6.74%: the raw payment is 393.575…, so half-up gives 393.58 and truncation gives 393.57
      const q = await (await bank(r, bug).price({ product: 'auto', amount: 20000, termMonths: 60, creditScore: 742, collateralValue: 40000 })).json();
      return q.monthlyPayment === expectedPayment(20000, q.apr, 60);
    },
    async stale_balance(r, bug) {
      const b = bank(r, bug);
      const before = (await b.balance('CHK-1001')).available;
      await b.transfer({ fromAccountId: 'CHK-1001', toAccountId: 'SAV-2001', amount: 100 });
      const after = (await b.balance('CHK-1001')).available;
      return after === +(before - 100).toFixed(2);
    },
  };
  for (const [bug, check] of Object.entries(checks)) {
    test(`${bug}: check passes on the correct bank`, async ({ request }) => { expect(await check(request, 'none')).toBe(true); });
    test(`${bug}: check catches the defect`, async ({ request }) => { expect(await check(request, bug)).toBe(false); });
  }
});

// ---------------------------------------------------------------- UI
test.describe('Bank UI', () => {
  test.beforeEach(async ({ page }) => { await page.goto(labUrl('bank')); });

  test('accounts show the seed balances', async ({ page }) => {
    const checking = page.getByTestId('account-card').filter({ has: page.getByText('Everyday Checking') });
    await expect(checking.getByTestId('account-balance')).toHaveText('$7,707.30');
    const cardTile = page.locator('[data-testid="account-card"][data-account="CC-3001"]');
    await expect(cardTile.getByTestId('account-available')).toHaveAttribute('data-value', String(SEED.cardAvailable));
    await expect(page.getByTestId('bank-fictional-note')).toContainText('not a real bank');
  });

  test('transfer: review, double-click confirm, booked once, then posts', async ({ page }) => {
    await page.getByTestId('bank-tab-transfer').click();
    await page.getByTestId('transfer-amount').fill('120.50');
    await page.getByTestId('transfer-memo').fill('Rainy day fund');
    await page.getByTestId('transfer-review-button').click();
    await expect(page.getByTestId('review-amount')).toHaveText('Amount: 120.50');
    await expect(page.getByTestId('review-idempotency-key')).toContainText('Idempotency-Key:');
    await page.getByTestId('transfer-confirm').dblclick(); // impatient user
    await expect(page.getByTestId('transfer-success')).toBeVisible();
    await expect(page.getByTestId('transfer-row')).toHaveCount(1);
    await expect(page.getByTestId('transfer-limit-remaining')).toHaveText('$2,379.50');
    await expect(page.getByTestId('transfer-row').getByTestId('status-pill')).toHaveText('posted', { timeout: 15_000 });
  });

  test('transfer: field errors point at the field', async ({ page }) => {
    await page.getByTestId('bank-tab-transfer').click();
    await page.getByTestId('transfer-amount').fill('10.005');
    await page.getByTestId('transfer-review-button').click();
    await page.getByTestId('transfer-confirm').click();
    await expect(page.getByTestId('transfer-error')).toHaveText('Amount can have at most 2 decimal places.');
    await expect(page.getByTestId('transfer-amount')).toHaveAttribute('aria-invalid', 'true');
    await page.getByTestId('transfer-amount').fill('2500.01');
    await page.getByTestId('transfer-review-button').click();
    await page.getByTestId('transfer-confirm').click();
    await expect(page.getByTestId('transfer-error')).toContainText('daily limit');
  });

  test('scheduled transfer can be cancelled', async ({ page }) => {
    await page.getByTestId('bank-tab-transfer').click();
    await page.getByTestId('transfer-amount').fill('40');
    await page.getByTestId('transfer-date').fill(plusDays(10));
    await page.getByTestId('transfer-review-button').click();
    await expect(page.getByTestId('review-date')).toHaveText(`Scheduled for ${plusDays(10)}`);
    await page.getByTestId('transfer-confirm').click();
    const row = page.getByTestId('transfer-row').first();
    await expect(row.getByTestId('status-pill')).toHaveText('scheduled');
    await row.getByTestId('transfer-cancel').click();
    await expect(row.getByTestId('status-pill')).toHaveText('cancelled');
  });

  test('statement: search, running balance, paging and CSV', async ({ page }) => {
    await page.getByTestId('bank-tab-statements').click();
    await expect(page.getByTestId('stmt-page-info')).toHaveText('Page 1 of 4');
    await expect(page.getByTestId('stmt-row').first().getByTestId('stmt-running')).toHaveText('$7,707.30');
    await page.getByTestId('stmt-search').fill('payroll');
    await expect(page.getByTestId('stmt-row')).toHaveCount(6);
    await expect(page.getByTestId('stmt-total-credits')).toHaveText('$14,100.00');
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByTestId('stmt-download-csv').click()]);
    expect(download.suggestedFilename()).toBe('harbor-CHK-1001-statement.csv');
    const csv = await (await import('fs')).promises.readFile((await download.path())!, 'utf8');
    expect(csv.trim().split('\n')).toHaveLength(7); // header + 6 payroll rows
  });

  test('statement: rows are sorted by amount', async ({ page }) => {
    await page.getByTestId('bank-tab-statements').click();
    await page.getByTestId('stmt-sort').selectOption('amount_desc');
    await expect(page.getByTestId('stmt-row').first()).toHaveAttribute('data-amount', '2350');
    const amounts = await page.getByTestId('stmt-row').evaluateAll((rows) => rows.map((r) => Number(r.getAttribute('data-amount'))));
    expect(amounts).toEqual([...amounts].sort((a, b) => b - a));
  });

  test('loan application: happy path to approval', async ({ page }) => {
    await page.getByTestId('bank-tab-loan').click();
    await page.getByTestId('loan-first-name').fill('Jordan');
    await page.getByTestId('loan-last-name').fill('Rivera');
    await page.getByTestId('loan-email').fill('jordan@example.com');
    await page.getByTestId('loan-dob').fill('1990-04-12');
    await page.getByTestId('loan-next').click();
    await page.getByTestId('loan-employer').fill('Acme Analytics');
    await page.getByTestId('loan-income').fill('6000');
    await page.getByTestId('loan-debts').fill('400');
    await page.getByTestId('loan-next').click();
    await page.getByTestId('loan-amount').fill('25000');
    await page.getByTestId('loan-term').selectOption('60');
    await page.getByTestId('loan-credit-score').fill('742');
    await page.getByTestId('loan-vehicle-year').fill('2022');
    await page.getByTestId('loan-vehicle-make').fill('Subaru');
    await page.getByTestId('loan-vehicle-value').fill('40000');
    await page.getByTestId('loan-next').click();
    await expect(page.getByTestId('review-loan')).toContainText('$25,000.00 over 60 months');
    await page.getByTestId('loan-submit').click();
    await expect(page.getByTestId('loan-error')).toHaveText('Fix the highlighted fields.'); // consent missing
    await page.getByTestId('loan-consent').check();
    await page.getByTestId('loan-submit').click();
    await expect(page.getByTestId('loan-decision')).toHaveAttribute('data-decision', 'approved');
    await expect(page.getByTestId('loan-apr')).toHaveText('6.99%');
    await expect(page.getByTestId('loan-payment')).toHaveText('$494.91');
    await expect(page.getByTestId('loan-id')).toHaveText(/^HDB-L-\d{5}$/);
  });

  test('loan application: age rule and conditional vehicle section', async ({ page }) => {
    await page.getByTestId('bank-tab-loan').click();
    await page.getByTestId('loan-first-name').fill('Sam');
    await page.getByTestId('loan-last-name').fill('Lee');
    await page.getByTestId('loan-email').fill('sam@example.com');
    await page.getByTestId('loan-dob').fill(plusDays(-365 * 17));
    await page.getByTestId('loan-next').click();
    await expect(page.getByTestId('loan-dob')).toHaveAttribute('aria-invalid', 'true');
    await page.getByTestId('loan-dob').fill('1995-01-01');
    await page.getByTestId('loan-save-draft').click();
    await expect(page.getByTestId('loan-draft-info')).toHaveText(/^Draft HDB-L-\d{5} saved\.$/);
    await page.getByTestId('loan-next').click();
    await page.getByTestId('loan-employment-status').selectOption('retired');
    await expect(page.getByTestId('loan-employer')).toBeHidden();
    await page.getByTestId('loan-income').fill('3000');
    await page.getByTestId('loan-next').click();
    await expect(page.getByTestId('loan-collateral')).toBeVisible();
    await page.getByTestId('loan-product-personal').check();
    await expect(page.getByTestId('loan-collateral')).toHaveCount(0);
    await expect(page.getByTestId('loan-term').locator('option')).toHaveText(['36 months', '60 months']);
  });

  test('rate calculator updates live and shows its working', async ({ page }) => {
    await page.getByTestId('bank-tab-rates').click();
    await expect(page.getByTestId('rate-apr')).toHaveText('6.99%');
    await page.getByTestId('rate-credit-score').fill('780');
    await expect(page.getByTestId('rate-apr')).toHaveText('6.49%');
    await expect(page.getByTestId('rate-breakdown-row')).toHaveCount(3);
    await page.getByTestId('rate-credit-score').fill('610');
    await expect(page.getByTestId('rate-quote').getByTestId('status-pill')).toHaveText('declined');
    await expect(page.getByTestId('rate-apr')).toHaveCount(0);
    await expect(page.getByTestId('rate-table-score')).toContainText('Decline');
  });

  test('payments: success, decline and one-time code', async ({ page }) => {
    await page.getByTestId('bank-tab-payments').click();
    const useCard = (outcome: string) => page.locator(`[data-testid="test-card-row"][data-outcome="${outcome}"]`).getByTestId('test-card-use').click();
    await useCard('succeeded');
    await expect(page.getByTestId('pay-card-number')).toHaveValue('4242 4242 4242 4242');
    await page.getByTestId('pay-submit').click();
    await expect(page.getByTestId('pay-result').getByTestId('status-pill')).toHaveText('succeeded');
    await useCard('card_declined');
    await page.getByTestId('pay-submit').click();
    await expect(page.getByTestId('pay-decline-code')).toHaveText('card_declined');
    await useCard('requires_action');
    await page.getByTestId('pay-submit').click();
    await page.getByTestId('otp-modal').getByTestId('otp-input').fill('123456');
    await page.getByTestId('otp-submit').click();
    await expect(page.getByTestId('pay-result').getByTestId('status-pill')).toHaveText('succeeded');
    await expect(page.getByTestId('pay-row')).toHaveCount(3);
  });

  test('payments: async settle, partial refund and event order', async ({ page }) => {
    await page.getByTestId('bank-tab-payments').click();
    await page.locator('[data-testid="test-card-row"][data-outcome="processing"]').getByTestId('test-card-use').click();
    await page.getByTestId('pay-amount').fill('30.00');
    await page.getByTestId('pay-submit').click();
    const row = page.getByTestId('pay-row').first();
    await expect(row.getByTestId('status-pill')).toHaveText('succeeded', { timeout: 12_000 });
    await row.getByTestId('pay-refund').click();
    await page.getByTestId('refund-amount').fill('10');
    await page.getByTestId('refund-submit').click();
    await expect(row.getByTestId('status-pill')).toHaveText('partially refunded');
    await expect(row.getByTestId('pay-row-refunded')).toHaveText('$10.00');
    await row.getByTestId('pay-events').click();
    await page.getByTestId('pay-events-delivery-order').check();
    await expect(page.getByTestId('event-row').first()).toHaveAttribute('data-seq', '4'); // wait for the re-render
    const seqs = await page.getByTestId('event-row').evaluateAll((els) => els.map((e) => Number(e.getAttribute('data-seq'))));
    expect(seqs).toEqual([4, 3, 2, 1]);
  });

  test('UI catches a planted double post', async ({ page }) => {
    await page.getByTestId('bank-bug').selectOption('double_post');
    await expect(page.getByTestId('bank-bug-active')).toHaveText('Defect: double_post');
    await page.getByTestId('bank-tab-transfer').click();
    await page.getByTestId('transfer-amount').fill('60');
    await page.getByTestId('transfer-review-button').click();
    await page.getByTestId('transfer-confirm').click();
    await expect(page.getByTestId('transfer-success')).toBeVisible();
    await expect(page.getByTestId('transfer-row')).toHaveCount(2); // one click, two bookings: the bug
  });
});
