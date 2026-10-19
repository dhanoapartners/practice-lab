/**
 * @file Mouse hover: CSS hover menus, tooltips, and the site-wide hover text (`data-tip`).
 *
 * Also checks keyboard access, since anything that opens on hover must open on focus too.
 * Run: `npx playwright test specs/hover.spec.ts`
 */
import { test, expect } from '@playwright/test';
import { labUrl } from '../support/lab';

/** The Playground's "Hover & tooltips" tile. */
test.describe('Playground: hover menu and tooltip', () => {
  test.beforeEach(async ({ page }) => { await page.goto(labUrl('playground')); });

  test('menu opens on hover and an item can be clicked', async ({ page }) => {
    const tile = page.getByTestId('tile-hover');
    await expect(tile.getByTestId('hover-menu')).toBeHidden();
    await tile.getByTestId('hover-trigger').hover();
    await expect(tile.getByTestId('hover-menu')).toBeVisible();
    await tile.getByTestId('hover-orders').click(); // Playwright moves the mouse, so the menu stays open
    await expect(tile.getByTestId('out-hover')).toHaveText('Menu: Orders');
  });

  test('menu closes when the mouse leaves', async ({ page }) => {
    const tile = page.getByTestId('tile-hover');
    await tile.getByTestId('hover-trigger').hover();
    await expect(tile.getByTestId('hover-menu')).toBeVisible();
    await page.mouse.move(0, 0);
    await expect(tile.getByTestId('hover-menu')).toBeHidden();
  });

  test('menu also opens from the keyboard', async ({ page }) => {
    const tile = page.getByTestId('tile-hover');
    await tile.getByTestId('hover-trigger').focus(); // :focus-within, so keyboard users are not locked out
    await expect(tile.getByTestId('hover-menu')).toBeVisible();
  });

  test('tooltip appears on hover and is linked to its button', async ({ page }) => {
    const tile = page.getByTestId('tile-hover');
    await expect(tile.getByTestId('tooltip')).toBeHidden();
    await tile.getByTestId('tooltip-trigger').hover();
    await expect(tile.getByRole('tooltip')).toBeVisible();
    await expect(tile.getByRole('tooltip')).toHaveText('Tooltips appear on hover and focus.');
    await expect(tile.getByTestId('tooltip-trigger')).toHaveAccessibleDescription('Tooltips appear on hover and focus.');
  });

  test('tooltip appears on keyboard focus too', async ({ page }) => {
    await page.getByTestId('tooltip-trigger').focus();
    await expect(page.getByTestId('tooltip')).toBeVisible();
  });
});

/** The shared hover-text tooltip (test ID `hover-tooltip`) used across the site. */
test.describe('Hover text (data-tip)', () => {
  test.beforeEach(async ({ page }) => { await page.goto(labUrl('hub')); });

  test('header button shows hover text after a short delay', async ({ page }) => {
    const tip = page.getByTestId('hover-tooltip');
    await page.getByTestId('reset-data').hover();
    await expect(tip).toBeVisible(); // appears after about 350 ms; the assertion retries until then
    await expect(tip).toHaveText('Clears your cart and orders. Products never change.');
    await expect(page.getByTestId('reset-data')).toHaveAttribute('aria-describedby', 'hoverTip');
  });

  test('hover text hides when the mouse leaves or Escape is pressed', async ({ page }) => {
    const tip = page.getByTestId('hover-tooltip');
    await page.getByTestId('reset-data').hover();
    await expect(tip).toBeVisible();
    await page.mouse.move(0, 400);
    await expect(tip).toBeHidden();
    await page.getByTestId('header-cart').hover();
    await expect(tip).toHaveText('View your cart');
    await page.keyboard.press('Escape');
    await expect(tip).toBeHidden();
  });

  test('moving between elements swaps the text', async ({ page }) => {
    const tip = page.getByTestId('hover-tooltip');
    await page.getByTestId('toggle-chaos').hover();
    await expect(tip).toContainText('fails about 1 in 8');
    await page.getByTestId('reset-data').hover();
    await expect(tip).toHaveText('Clears your cart and orders. Products never change.');
  });

  test('bank: Available balance explains itself on hover', async ({ page }) => {
    await page.goto(labUrl('bank'));
    await page.locator('[data-testid="account-card"][data-account="CHK-1001"]').getByTestId('account-available').hover();
    await expect(page.getByTestId('hover-tooltip')).toHaveText('Balance minus pending debits plus pending credits');
  });
});
