/**
 * @file Training sample: LLM-as-judge, and why you test the judge before trusting it.
 *
 * Covers judging one answer, a golden set run, and calibration against human labels.
 * Run: `npx playwright test specs/eval.spec.ts`
 */
import { test, expect } from '@playwright/test';

const API = '/api/v1/eval';

test('the judge fails an answer with an unsupported claim', async ({ request }) => {
  const j = await (await request.post(`${API}/judge`, { data: {
    question: 'How much is express shipping?',
    answer: 'Express shipping costs $14.95 and arrives in 2 business days. Every order also includes a free lifetime warranty.',
    context: ['Express shipping costs $14.95 and arrives in 2 business days.'],
  } })).json();
  expect(j.verdict).toBe('fail');
  expect(j.reasons.join(' ')).toContain('lifetime warranty');
});

test.describe('golden set', () => {
  test('a healthy help center scores well', async ({ request }) => {
    const s = (await (await request.post(`${API}/run`, { data: {} })).json()).summary;
    expect(s.passRate).toBeGreaterThanOrEqual(90);
  });

  test('a hallucinating help center scores lower', async ({ request }) => {
    const s = (await (await request.post(`${API}/run`, { data: { ragBug: 'hallucinate' } })).json()).summary;
    expect(s.passRate).toBeLessThan(90);
  });
});

// Calibration: compare the judge's verdicts with labels written by people.
test.describe('calibrating the judge', () => {
  test('a healthy judge agrees with the human labels', async ({ request }) => {
    const c = await (await request.post(`${API}/calibrate`, { data: {} })).json();
    expect(c.agreement).toBe(100);
  });

  test('a lenient judge disagrees with them', async ({ request }) => {
    const c = await (await request.post(`${API}/calibrate`, { data: { judgeBug: 'lenient' } })).json();
    expect(c.agreement).toBeLessThan(100);
  });

  // Exercise: the lab also plants `length_bias` and `ignore_context`. Add tests proving calibration exposes them.
});

test('Eval Lab page shows a failing verdict for the sample answer', async ({ page }) => {
  await page.goto('/?ui=v1#eval');
  await page.getByTestId('eval-judge').click();
  await expect(page.getByTestId('eval-result').getByTestId('verdict')).toHaveText('Fail');
});
