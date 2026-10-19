import { test, expect } from '@playwright/test';

// LLM-as-judge: test the judge itself before trusting its scores.
const API = '/api/v1/eval';

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
