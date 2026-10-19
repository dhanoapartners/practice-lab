import { test as base, expect, type Locator, type Page, type TestInfo } from '@playwright/test';

/**
 * A self-healing locator.
 *
 * Every target has a primary locator (its data-testid) plus a fingerprint:
 * role, accessible name, visible text and a stable CSS attribute. When the
 * primary locator finds nothing, the healer tries the fingerprint in order of
 * reliability, and as a last resort scores every element with a test ID by
 * similarity. Each heal is recorded on the test so the healing reporter can
 * list it and suggest the locator fix. Heals never pass silently.
 */
export type Target = {
  key: string;
  testId: string;
  role?: Parameters<Page['getByRole']>[0];
  roleOptions?: Omit<NonNullable<Parameters<Page['getByRole']>[1]>, 'name'>;
  name?: string | RegExp;
  text?: string;
  css?: string;
};

export type HealEvent = {
  key: string;
  broken: string;
  healedWith: string;
  strategy: 'role' | 'text' | 'css' | 'similarity';
  confidence: number;
  suggestedTestId?: string;
  test: string;
  url: string;
};

const PRIMARY_WAIT = 2000;
const FALLBACK_WAIT = 1500;
const MIN_SIMILARITY = 0.45;

const words = (s = '') => s.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
function jaccard(a: string[], b: string[]) {
  if (!a.length || !b.length) return 0;
  const A = new Set(a), B = new Set(b);
  const inter = [...A].filter((x) => B.has(x)).length;
  return inter / new Set([...A, ...B]).size;
}

async function present(loc: Locator, timeout: number, state: 'attached' | 'visible' = 'attached') {
  try { await loc.first().waitFor({ state, timeout }); return true; } catch { return false; }
}
// Fallbacks only accept visible matches. Without this, getByRole('option')
// can "heal" onto a hidden <option> in an unrelated <select>.
const visibleOnly = (loc: Locator) => loc.locator('visible=true');

export async function healLocator(page: Page, t: Target, info: TestInfo): Promise<Locator> {
  const primary = page.getByTestId(t.testId);
  if (await present(primary, PRIMARY_WAIT)) return primary;

  const record = async (loc: Locator, strategy: HealEvent['strategy'], healedWith: string, confidence: number) => {
    const suggestedTestId = (await loc.first().getAttribute('data-testid').catch(() => null)) ?? undefined;
    const evt: HealEvent = { key: t.key, broken: `getByTestId('${t.testId}')`, healedWith, strategy, confidence, suggestedTestId, test: info.titlePath.slice(1).join(' › '), url: page.url() };
    info.annotations.push({ type: 'self-healed', description: JSON.stringify(evt) });
    info.attachments.push({ name: 'self-healed', contentType: 'application/json', body: Buffer.from(JSON.stringify(evt)) });
    console.log(`  ⚕ healed ${t.key}: ${evt.broken} → ${healedWith} (${strategy}, ${Math.round(confidence * 100)}%)`);
    return loc;
  };

  if (t.role) {
    const loc = visibleOnly(page.getByRole(t.role, { ...(t.roleOptions || {}), ...(t.name ? { name: t.name } : {}) }));
    if (await present(loc, FALLBACK_WAIT, 'visible')) return record(loc, 'role', `getByRole('${t.role}'${t.name ? `, { name: ${JSON.stringify(String(t.name))} }` : ''})`, 0.9);
  }
  if (t.text) {
    const loc = visibleOnly(page.getByText(t.text, { exact: true }));
    if (await present(loc, FALLBACK_WAIT, 'visible')) return record(loc, 'text', `getByText('${t.text}')`, 0.8);
  }
  if (t.css) {
    const loc = page.locator(t.css);
    if (await present(loc, FALLBACK_WAIT, 'visible')) return record(loc, 'css', `locator('${t.css}')`, 0.75);
  }

  // Last resort: score every element that has a test ID.
  const candidates = await page.$$eval('[data-testid]', (els) => els.map((e) => ({
    testId: e.getAttribute('data-testid') || '',
    tag: e.tagName.toLowerCase(),
    text: ((e as HTMLElement).innerText || (e as HTMLInputElement).placeholder || '').trim().slice(0, 80),
  })));
  const wantId = words(t.testId), wantText = words(t.text || (typeof t.name === 'string' ? t.name : ''));
  const ranked = candidates
    .map((c) => ({ c, score: 0.55 * jaccard(wantId, words(c.testId)) + 0.45 * (wantText.length ? jaccard(wantText, words(c.text)) : jaccard(wantId, words(c.testId))) }))
    .sort((a, b) => b.score - a.score);
  const best = ranked[0];
  if (best && best.score >= MIN_SIMILARITY) {
    return record(page.getByTestId(best.c.testId), 'similarity', `getByTestId('${best.c.testId}')`, Math.round(best.score * 100) / 100);
  }
  throw new Error(`Self-healing failed for "${t.key}": getByTestId('${t.testId}') is gone and no fallback matched. ` +
    `Closest candidate: ${best ? `${best.c.testId} (${Math.round(best.score * 100)}%)` : 'none'}.`);
}

/** Use `test` from this file to get the `heal` fixture. */
export const test = base.extend<{ heal: (t: Target) => Promise<Locator> }>({
  heal: async ({ page }, use, testInfo) => {
    await use((t) => healLocator(page, t, testInfo));
  },
});
export { expect };
