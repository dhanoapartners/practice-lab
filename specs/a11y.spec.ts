/**
 * @file Accessibility checks with axe-core (@axe-core/playwright).
 *
 * The Playground has a tile with four planted accessibility bugs. These tests prove axe finds
 * all four, and that the rest of each screen has no serious or critical violations.
 * Run: `npx playwright test specs/a11y.spec.ts`
 */
import { test, expect, Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { labUrl } from '../support/lab';

/**
 * Runs axe on the current page.
 * @param page The page to scan.
 * @param opts.include Only scan inside this CSS selector.
 * @param opts.exclude Skip everything inside these CSS selectors.
 * @returns Violations at the "serious" or "critical" impact level, as `rule-id: target` strings.
 */
async function seriousViolations(page: Page, opts: { include?: string; exclude?: string[] } = {}) {
  let axe = new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']);
  if (opts.include) axe = axe.include(opts.include);
  for (const e of opts.exclude ?? []) axe = axe.exclude(e);
  const { violations } = await axe.analyze();
  return violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .flatMap((v) => v.nodes.map((n) => `${v.id}: ${n.target.join(' ')}`));
}

test('axe finds all four planted bugs in the Playground', async ({ page }) => {
  await page.goto(labUrl('playground'));
  const { violations } = await new AxeBuilder({ page }).include('[data-testid="a11y-broken"]').analyze();
  expect(violations.map((v) => v.id).sort()).toEqual(['button-name', 'color-contrast', 'image-alt', 'label']);
});

/** Screens that should be clean. The planted-bugs tile is excluded from the Playground scan. */
const SCREENS: { view: string; ready: string; exclude?: string[] }[] = [
  { view: 'hub', ready: 'view-hub' },
  { view: 'shop', ready: 'product-card' },
  { view: 'playground', ready: 'view-playground', exclude: ['[data-testid="tile-a11y"]'] },
  { view: 'charts', ready: 'bar' },
  { view: 'bank', ready: 'account-card' },
  { view: 'help', ready: 'view-help' },
  { view: 'eval', ready: 'view-eval' },
  { view: 'agent', ready: 'view-agent' },
  { view: 'skills', ready: 'skill-card' },
  { view: 'coaching', ready: 'view-coaching' },
];

for (const s of SCREENS) {
  test(`${s.view}: no serious or critical violations`, async ({ page }) => {
    await page.goto(labUrl(s.view));
    await expect(page.getByTestId(s.ready).first()).toBeVisible();
    expect(await seriousViolations(page, { exclude: s.exclude })).toEqual([]);
  });
}

test('keyboard only: skip to the shop and add to cart without a mouse', async ({ page }) => {
  await page.goto(labUrl('hub'));
  await page.getByTestId('hub-open-shop').focus();
  await page.keyboard.press('Enter');
  await page.getByTestId('search-input').focus();
  await page.keyboard.type('speaker');
  await expect(page.getByTestId('search-suggestion')).toHaveCount(1);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await page.getByTestId('add-to-cart').focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('cart-count')).toHaveText('1');
});
