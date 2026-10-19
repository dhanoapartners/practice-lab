/**
 * @file LLM-as-judge: test the judge itself before trusting its scores.
 *
 * Judges single answers, runs the 10-question golden set, and calibrates the judge against
 * human labels so that planted judge defects (lenient, length bias, ignores context) are caught.
 * Run: `npx playwright test specs/eval.spec.ts`
 */
import { test, expect } from '@playwright/test';

/** Base path of the Eval Lab API. */
const API = '/api/v1/eval';

/** The judge scores groundedness, relevance and completeness, and the golden set reflects Help Center quality. */
test.describe('Eval Lab: judging answers', () => {
  test('flags an unsupported claim in an otherwise correct answer', async ({ request }) => {
    const r = await request.post(`${API}/judge`, { data: {
      question: 'How much is express shipping?',
      answer: 'Express shipping costs $14.95 and arrives in 2 business days. Every order also includes a free lifetime warranty.',
      context: ['Express shipping costs $14.95 and arrives in 2 business days.'],
      reference: 'Express shipping costs $14.95 and arrives in 2 business days.',
    } });
    const j = await r.json();
    expect(j.verdict).toBe('fail');
    expect(j.scores.groundedness).toBeLessThan(4);
    expect(j.reasons.join(' ')).toContain('lifetime warranty');
  });

  test('golden set passes with a healthy Help Center', async ({ request }) => {
    const s = (await (await request.post(`${API}/run`, { data: {} })).json()).summary;
    expect(s.passRate).toBeGreaterThanOrEqual(90);
    expect(s.citationAccuracy).toBe(100);
  });

  test('golden set catches a hallucinating Help Center', async ({ request }) => {
    const s = (await (await request.post(`${API}/run`, { data: { ragBug: 'hallucinate' } })).json()).summary;
    expect(s.passRate).toBeLessThan(90);
  });
});

// Calibration: a judge must agree with human labels. Each planted judge
// defect must lower agreement, or the calibration set is too weak.
/** A healthy judge agrees with every human label; each planted judge defect must lower agreement. */
test.describe('Eval Lab: calibrating the judge', () => {
  test('a healthy judge agrees with every human label', async ({ request }) => {
    const c = await (await request.post(`${API}/calibrate`, { data: {} })).json();
    expect(c.agreement).toBe(100);
  });

  for (const bug of ['lenient', 'length_bias', 'ignore_context']) {
    test(`calibration exposes a ${bug} judge`, async ({ request }) => {
      const c = await (await request.post(`${API}/calibrate`, { data: { judgeBug: bug } })).json();
      expect(c.agreement).toBeLessThan(100);
      expect(c.falsePasses).toBeGreaterThan(0);
    });
  }
});

test('Eval Lab page shows a failing verdict for the sample answer', async ({ page }) => {
  await page.goto('/?ui=v1#eval');
  await page.getByTestId('eval-judge').click();
  await expect(page.getByTestId('eval-result').getByTestId('verdict')).toHaveText('Fail');
  await expect(page.getByTestId('score-groundedness-value')).toHaveText(/[1-3]/);
});

test('Eval Lab page: golden set run shows a pass rate and one row per question', async ({ page }) => {
  await page.goto('/?ui=v1#eval');
  await page.getByTestId('eval-tab-run').click();
  await page.getByTestId('eval-run').click();
  await expect(page.getByTestId('eval-row')).toHaveCount(10);
  await expect(page.getByTestId('eval-pass-rate')).toContainText('%');
});

test('Eval Lab page: a lenient judge loses agreement with humans', async ({ page }) => {
  await page.goto('/?ui=v1#eval');
  await page.getByTestId('eval-tab-calibrate').click();
  await page.getByTestId('eval-calibrate').click();
  await expect(page.getByTestId('eval-agreement')).toContainText('100% agreement with humans');
  await page.getByTestId('eval-judge-bug').selectOption('lenient');
  await page.getByTestId('eval-calibrate').click();
  await expect(page.getByTestId('eval-agreement')).not.toContainText('100%');
  await expect(page.getByTestId('eval-false-passes')).not.toHaveText(/^0\b/);
});
