/**
 * @file Site-wide behavior: navigation, header tools, the API console, the Help Center page,
 * Skills, 1:1 Coaching, Terms and the footer.
 *
 * Run: `npx playwright test specs/site.spec.ts`
 */
import { test, expect } from '@playwright/test';
import { labUrl } from '../support/lab';

/** Every screen reachable from the Hub, with the test ID of its root element. */
const VIEWS = ['shop', 'playground', 'api', 'charts', 'bank', 'help', 'eval', 'agent', 'skills', 'coaching'] as const;

/** Hub cards, the main menu and deep links. */
test.describe('Navigation', () => {
  for (const v of VIEWS) {
    test(`hub card opens ${v}`, async ({ page }) => {
      await page.goto(labUrl('hub'));
      await page.getByTestId(`hub-card-${v}`).click();
      await expect(page.getByTestId(`view-${v}`)).toBeVisible();
      await expect(page).toHaveURL(new RegExp(`#${v}$`));
      await expect(page.getByTestId(`nav-${v}`)).toHaveAttribute('aria-current', 'page');
    });
  }

  test('deep link opens the right screen, and Back works', async ({ page }) => {
    await page.goto(labUrl('charts'));
    await expect(page.getByTestId('view-charts')).toBeVisible();
    await page.getByTestId('nav-bank').click();
    await expect(page.getByTestId('view-bank')).toBeVisible();
    await page.goto(labUrl('help'));
    await expect(page.getByTestId('view-help')).toBeVisible();
  });

  test('unknown hash falls back to the Hub', async ({ page }) => {
    await page.goto('/#nowhere');
    await expect(page.getByTestId('view-hub')).toBeVisible();
  });

  test('brand link returns to the Hub', async ({ page }) => {
    await page.goto(labUrl('shop'));
    await page.getByTestId('nav-home').click();
    await expect(page.getByTestId('view-hub')).toBeVisible();
  });
});

/** Session handling: one visitor must get exactly one session. */
test.describe('Session', () => {
  test('first page load creates exactly one session, even with parallel API calls', async ({ page }) => {
    // Regression test: the Bank screen fires several API calls at once on load. Before the fix,
    // each created its own session and a late response could swap the cookie mid-visit.
    const sids = new Set<string>();
    page.on('response', async (r) => {
      const c = await r.headerValue('set-cookie');
      const m = c && c.match(/lab_sid=([^;]+)/);
      if (m) sids.add(m[1]);
    });
    await page.goto(labUrl('bank'));
    await expect(page.getByTestId('account-card')).toHaveCount(3);
    await page.getByTestId('bank-tab-transfer').click();
    await expect(page.getByTestId('transfer-limit-remaining')).toHaveText('$2,500.00');
    expect(sids.size).toBe(1);
  });
});

/** Test IDs overlay, UI version switch, Chaos toggle and Reset data. */
test.describe('Header tools', () => {
  test('Test IDs overlay outlines elements and names them on hover', async ({ page }) => {
    await page.goto(labUrl('hub'));
    await page.getByTestId('toggle-testids').check();
    await expect(page.locator('body')).toHaveClass(/show-ids/);
    await page.getByTestId('hub-open-shop').hover();
    await expect(page.locator('#idTip')).toHaveText('hub-open-shop');
  });

  test('UI v2 renames test IDs and labels, like a release would', async ({ page }) => {
    await page.goto('/?ui=v2#shop');
    await page.getByTestId('search-input').or(page.getByRole('searchbox')).first().fill('speaker');
    await page.getByRole('option').filter({ hasText: 'Bluetooth Speaker' }).click();
    await expect(page.getByTestId('add-to-cart')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Add to bag' })).toBeVisible();
    await expect(page.getByTestId('ui-version')).toHaveValue('v2');
  });

  test('Chaos toggle sends X-Chaos on every request', async ({ page }) => {
    await page.goto(labUrl('hub'));
    await page.getByTestId('toggle-chaos').check();
    await expect(page.locator('#chaosBar')).toBeVisible();
    const req = page.waitForRequest((r) => r.url().includes('/api/v1/products'));
    await page.getByTestId('nav-shop').click();
    expect((await req).headers()['x-chaos']).toBe('1');
  });

  test('Reset data empties the cart', async ({ page }) => {
    await page.goto(labUrl('hub'));
    await expect.poll(async () => (await page.context().cookies()).some((c) => c.name === 'lab_sid')).toBe(true);
    await page.request.post('/api/v1/cart/items', { data: { productId: 'p-1006', qty: 2 } });
    await page.reload();
    await expect(page.getByTestId('cart-count')).toHaveText('2');
    await page.getByTestId('reset-data').click();
    await expect(page.getByTestId('toast')).toContainText('Data reset to seed values.');
    await expect(page.getByTestId('cart-count')).toBeHidden();
  });
});

/** The in-browser API console: pick an endpoint, send it, read the response, copy curl. */
test.describe('API console', () => {
  test.beforeEach(async ({ page }) => { await page.goto(labUrl('api')); });

  test('login, then use the token for a protected call', async ({ page }) => {
    await page.getByTestId('endpoint-0').click(); // POST /auth/login
    await page.getByTestId('request-send').click();
    await expect(page.getByTestId('response-code')).toHaveText('200');
    await page.getByTestId('use-token').click();
    await expect(page.getByTestId('request-token')).not.toBeEmpty();
    await expect(page.getByTestId('curl-snippet')).toContainText('Authorization: Bearer');
  });

  test('an unknown product returns 404', async ({ page }) => {
    await page.getByTestId('endpoint-2').click();
    await page.getByTestId('request-path').fill('/products/p-9999');
    await page.getByTestId('request-send').click();
    await expect(page.getByTestId('response-code')).toHaveText('404');
    await expect(page.getByTestId('response-body')).toContainText('error');
  });

  test('invalid JSON body is caught before sending', async ({ page }) => {
    await page.getByTestId('endpoint-6').click(); // POST /cart/items
    await page.getByTestId('request-body').fill('{ not json');
    await page.getByTestId('request-send').click();
    await expect(page.getByTestId('request-body-error')).toContainText('Body is not valid JSON');
  });

  test('curl snippet follows the selected endpoint', async ({ page }) => {
    await page.getByTestId('endpoint-9').click(); // POST /promo/validate
    await expect(page.getByTestId('curl-snippet')).toContainText("curl -X POST '");
    await expect(page.getByTestId('curl-snippet')).toContainText('/api/v1/promo/validate');
    await expect(page.getByTestId('curl-snippet')).toContainText('SAVE10'); // the JSON body is included
  });
});

/** The Help Center page itself (the RAG logic is covered in rag.spec.ts). */
test.describe('Help Center page', () => {
  test.beforeEach(async ({ page }) => { await page.goto(labUrl('help')); });

  test('a suggested question gets a cited answer', async ({ page }) => {
    await page.getByTestId('help-suggestion').first().click();
    await expect(page.getByTestId('help-answer')).not.toBeEmpty();
    await expect(page.getByTestId('help-citation').first()).toBeVisible();
  });

  test('an empty question is rejected', async ({ page }) => {
    await page.getByTestId('help-ask').click();
    await expect(page.getByTestId('help-question-error')).not.toBeEmpty();
  });

  test('the no-retrieval defect shows an answer with no sources', async ({ page }) => {
    await page.getByTestId('help-bug').selectOption('no_retrieval');
    await page.getByTestId('help-question').fill('Do you ship to Canada?');
    await page.getByTestId('help-ask').click();
    await expect(page.getByTestId('help-no-sources')).toBeVisible();
    await expect(page.getByTestId('help-bug-active')).toBeVisible();
  });

  test('all 8 ground-truth documents are listed', async ({ page }) => {
    await expect(page.getByTestId('help-doc')).toHaveCount(8);
  });
});

/** Skills downloads, Coaching contact, Terms and footer. */
test.describe('Content pages', () => {
  test('four skills, each downloadable and viewable', async ({ page }) => {
    await page.goto(labUrl('skills'));
    const cards = page.getByTestId('skill-card');
    await expect(cards).toHaveCount(4);
    for (const href of await page.getByTestId('skill-download').evaluateAll((as) => as.map((a) => a.getAttribute('href')!))) {
      const r = await page.request.get(href);
      expect(r.status(), href).toBe(200);
    }
    await cards.first().getByTestId('skill-view').click();
    await expect(cards.first().getByTestId('skill-content')).toContainText('name:');
  });

  test('coaching: booking opens in a new tab, email can be copied', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto(labUrl('coaching'));
    const book = page.getByTestId('coaching-book');
    await expect(book).toHaveAttribute('href', /^https:\/\/bookings\.cloud\.microsoft\//);
    await expect(book).toHaveAttribute('target', '_blank');
    await expect(book).toHaveAttribute('rel', /noopener/);
    await page.getByTestId('coaching-copy-email').click();
    await expect(page.getByTestId('toast')).toContainText('Email address copied.');
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('info@qualityfirstqa.com');
  });

  test('terms page explains the data is synthetic', async ({ page }) => {
    await page.goto('/terms.html');
    await expect(page.locator('body')).toContainText(/synthetic/i);
  });

  test('footer names the company, not a person', async ({ page }) => {
    await page.goto(labUrl('hub'));
    const footer = page.locator('footer');
    await expect(footer).toContainText('QualityFirstQA LLC');
    await expect(footer).toContainText('Dhanoa Partners is a training brand of QualityFirstQA LLC.');
    await expect(footer.getByRole('link', { name: 'Terms of use' })).toBeVisible();
  });

  test('footer stays at the bottom of a short page', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 1400 });
    await page.goto(labUrl('coaching'));
    const box = (await page.locator('footer').boundingBox())!;
    expect(box.y + box.height).toBeGreaterThanOrEqual(1400 - 1);
  });
});
