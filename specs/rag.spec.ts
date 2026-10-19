import { test, expect } from '@playwright/test';
import { ragIssues, REFUSAL, type RagAnswer } from '../support/rag-checks';

const ask = async (request: any, question: string, extra: Record<string, unknown> = {}): Promise<RagAnswer> => {
  const r = await request.post('/api/v1/help/ask', { data: { question, mode: 'extractive', ...extra } });
  expect(r.status()).toBe(200);
  return r.json();
};

test.describe('RAG help center: correct behavior', () => {
  test('retrieves the right document and cites it', async ({ request }) => {
    const a = await ask(request, 'How long is the warranty on electronics?');
    expect(a.citations[0].docId).toBe('warranty');
    expect(a.answer).toContain('1-year');
    expect(ragIssues(a)).toEqual([]);
  });

  test('never uses the retired returns policy', async ({ request }) => {
    const a = await ask(request, 'How many days do I have to return an item?');
    expect(a.citations.map((c) => c.docId)).toContain('returns');
    expect(a.citations.map((c) => c.docId)).not.toContain('returns-2024');
    expect(a.answer).toContain('30 days');
  });

  test('refuses questions the documents cannot answer', async ({ request }) => {
    const a = await ask(request, 'What is the capital of France?');
    expect(a.answer).toBe(REFUSAL);
    expect(a.citations).toHaveLength(0);
  });
});

// Each planted defect must be caught by ragIssues(). If a detector misses its
// defect, the test fails, which is how you prove your checks actually work.
test.describe('RAG help center: planted defects are caught', () => {
  const cases = [
    { bug: 'stale', q: 'How many days do I have to return an item?', expect: 'stale-source' },
    { bug: 'no_retrieval', q: 'How many days do I have to return an item?', expect: 'no-sources' },
    { bug: 'hallucinate', q: 'How long is the warranty on electronics?', expect: 'unsupported-claim' },
  ];
  for (const c of cases) {
    test(`detects ${c.bug}`, async ({ request }) => {
      const a = await ask(request, c.q, { bug: c.bug });
      expect(ragIssues(a).join('\n')).toContain(c.expect);
    });
  }
});

// Generated answers vary run to run, so assert on properties, not exact text.
test.describe('RAG help center: LLM mode', () => {
  test.skip(!process.env.LAB_LLM, 'Set LAB_LLM=1 against a deployment with Workers AI');
  test('LLM answer is grounded in its sources', async ({ request }) => {
    const a = await ask(request, 'Is express shipping available for the tent?', { mode: 'llm' });
    expect(a.generator).toBe('llm');
    expect(a.citations[0].docId).toBe('shipping');
    expect(ragIssues(a)).toEqual([]);
  });
});
