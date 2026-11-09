/**
 * @file Training sample: a minimal self-healing locator.
 *
 * Tries the element's test ID first. If a release renamed it, falls back to its role and accessible
 * name, then to its exact visible text. Every fallback is logged and added to the test's annotations,
 * so a heal never passes silently.
 *
 * It's deliberately small (about 40 lines) so you can read all of it in one sitting.
 *
 * @example
 * const addToCart = await findWithFallback(page, { testId: 'add-to-cart', role: 'button', name: 'Add to cart' });
 * await addToCart.click();
 */
import { test, type Locator, type Page } from '@playwright/test';

/** How to find one element: its test ID plus the backups to try if the ID changes. */
export type Fallbacks = {
  testId: string;
  role?: Parameters<Page['getByRole']>[0];
  name?: string | RegExp;
  text?: string;
};

/** True if the locator becomes visible within `timeout` ms. Never throws. */
async function visible(loc: Locator, timeout: number) {
  try { await loc.first().waitFor({ state: 'visible', timeout }); return true; } catch { return false; }
}

/**
 * Finds an element by test ID, falling back to role + name, then exact text.
 * Fallbacks only match visible elements: otherwise `getByRole('option')` could match a hidden
 * `<option>` in some other `<select>` on the page.
 * @throws If nothing matches, with the test ID that disappeared.
 */
export async function findWithFallback(page: Page, f: Fallbacks): Promise<Locator> {
  const primary = page.getByTestId(f.testId);
  if (await visible(primary, 2_000)) return primary;

  const tries: Array<[string, Locator]> = [];
  const show = (n: string | RegExp) => (typeof n === 'string' ? `'${n}'` : String(n));
  if (f.role) tries.push([`getByRole('${f.role}'${f.name ? `, { name: ${show(f.name)} }` : ''})`, page.getByRole(f.role, f.name ? { name: f.name } : {})]);
  if (f.text) tries.push([`getByText('${f.text}')`, page.getByText(f.text, { exact: true })]);

  for (const [description, loc] of tries) {
    const onlyVisible = loc.locator('visible=true');
    if (await visible(onlyVisible, 1_500)) {
      const note = `getByTestId('${f.testId}') not found; used ${description}. Update the test ID.`;
      console.warn(`  ⚠ fallback: ${note}`);
      test.info().annotations.push({ type: 'fallback-locator', description: note });
      return onlyVisible;
    }
  }
  throw new Error(`getByTestId('${f.testId}') is gone and no fallback matched.`);
}
