/**
 * @file Reading values out of SVG charts, and working with common SVG elements.
 *
 * Compares chart values with the API, reads data-*, aria-label and <text>, hovers tooltips,
 * toggles legend series and exercises the 24-element SVG gallery.
 * Run: `npx playwright test specs/svg.spec.ts`
 */
import { test, expect } from '@playwright/test';
import { labUrl } from '../support/lab';

/** Bar, line and donut charts on the Charts page. */
test.describe('SVG charts', () => {
  test('bar values on screen match the API', async ({ page, request }) => {
    const api = await (await request.get('/api/v1/charts/sales', { params: { year: '2026' } })).json();
    await page.goto(labUrl('charts'));
    const bars = page.getByTestId('bar');
    await expect(bars).toHaveCount(api.months.length);
    for (let i = 0; i < api.months.length; i++) {
      const m = api.months[i];
      await expect(bars.nth(i)).toHaveAttribute('data-value', String(m.revenue));
      await expect(bars.nth(i).getByTestId('bar-value')).toHaveText('$' + m.revenue.toLocaleString('en-US'));
      await expect(bars.nth(i)).toHaveAttribute('aria-label', `${m.month} 2026: $${m.revenue.toLocaleString('en-US')}`);
    }
  });

  test('read every value at once with evaluateAll', async ({ page }) => {
    await page.goto(labUrl('charts'));
    await expect(page.getByTestId('bar')).toHaveCount(6);
    const values = await page.getByTestId('bar').evaluateAll((els) => els.map((e) => Number(e.getAttribute('data-value'))));
    expect(Math.max(...values)).toBe(21300); // May is the best month
  });

  test('taller bar means a bigger value', async ({ page }) => {
    await page.goto(labUrl('charts'));
    const jan = await page.getByTestId('bar').nth(0).locator('rect').boundingBox();
    const may = await page.getByTestId('bar').nth(4).locator('rect').boundingBox();
    expect(may!.height).toBeGreaterThan(jan!.height);
  });

  test('hovering a bar shows its tooltip', async ({ page }) => {
    await page.goto(labUrl('charts'));
    await page.getByTestId('bar').filter({ has: page.getByText('Apr', { exact: true }) }).hover();
    await expect(page.getByTestId('hover-tooltip')).toHaveText('Apr 2026: $18,900 revenue, 394 orders');
  });

  test('legend toggles a line series', async ({ page }) => {
    await page.goto(labUrl('charts'));
    const returns = page.locator('[data-testid="series"][data-series="returns"]');
    await expect(returns).toBeVisible();
    await page.getByTestId('legend-returns').click();
    await expect(page.getByTestId('legend-returns')).toHaveAttribute('aria-pressed', 'false');
    await expect(returns).toBeHidden();
  });

  test('clicking a donut slice updates the center text', async ({ page }) => {
    await page.goto(labUrl('charts'));
    await page.getByRole('button', { name: 'Kitchen 17%' }).click();
    await expect(page.getByTestId('donut-center-value')).toHaveText('17%');
    await expect(page.getByTestId('donut-center-label')).toHaveText('Kitchen');
  });

  test('changing the year reloads the data', async ({ page }) => {
    await page.goto(labUrl('charts'));
    const loaded = page.waitForResponse((r) => r.url().includes('/api/v1/charts/sales') && r.url().includes('year=2025'));
    await page.getByTestId('chart-year').selectOption('2025');
    await loaded;
    await expect(page.getByTestId('bar').first().getByTestId('bar-value')).toHaveText('$9,800');
  });

  test('chart and data table agree', async ({ page }) => {
    await page.goto(labUrl('charts'));
    await page.getByTestId('chart-show-table').check();
    const rows = page.getByTestId('chart-table-row');
    await expect(rows).toHaveCount(6);
    await expect(rows.nth(2).getByRole('cell').nth(1)).toHaveText((await page.getByTestId('bar-value').nth(2).textContent())!); // SVG text has no innerText
  });
});

/** One example per common SVG element. */
test.describe('SVG element gallery', () => {
  test.beforeEach(async ({ page }) => { await page.goto(labUrl('charts')); });

  test('text and tspan', async ({ page }) => {
    await expect(page.getByTestId('svg-text')).toHaveText('Total $42');
    await expect(page.getByTestId('svg-tspan')).toHaveText('$42');
  });

  test('shape attributes', async ({ page }) => {
    await expect(page.getByTestId('svg-rect')).toHaveAttribute('width', '80');
    await expect(page.getByTestId('svg-circle')).toHaveAttribute('r', '28');
    await expect(page.getByTestId('svg-path')).toHaveAttribute('d', /^M10,60 C/);
    await expect(page.getByTestId('svg-polyline')).toHaveAttribute('points', /110,30$/);
  });

  test('gradient fill points at its definition', async ({ page }) => {
    const fill = await page.getByTestId('svg-lineargradient').getAttribute('fill');
    expect(fill).toBe('url(#gLG)');
    await expect(page.locator('linearGradient#gLG stop')).toHaveCount(2);
  });

  test('HTML input inside foreignObject', async ({ page }) => {
    await page.getByTestId('svg-foreignobject-input').fill('inside svg');
    await expect(page.getByTestId('svg-foreignobject-input')).toHaveValue('inside svg');
  });

  test('accessible SVG: role img with a name', async ({ page }) => {
    await expect(page.getByRole('img', { name: 'Warning icon' })).toBeVisible();
  });

  test('icon button found by its aria-label', async ({ page }) => {
    await page.getByRole('button', { name: 'Delete item' }).click();
    await expect(page.getByTestId('svg-icon-button-out')).toHaveText('Delete clicked');
  });

  test('link inside SVG opens a new tab', async ({ page, context }) => {
    const [tab] = await Promise.all([context.waitForEvent('page'), page.getByTestId('svg-a').click()]);
    await expect(tab).toHaveURL(/\/terms(\.html)?$/); // Cloudflare serves /terms.html as /terms
  });
});
