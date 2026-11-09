/**
 * @file Training sample: testing a RAG help bot.
 *
 * Assert on properties of the answer (which document was used, whether it is cited, whether it refuses),
 * never on exact wording. Then prove each check works by planting the defect it exists to catch.
 * Run: `npx playwright test specs/rag.spec.ts`
 */
import { test, expect, type APIRequestContext } from '@playwright/test';

type Citation = { n: number; docId: string; deprecated: boolean; text: string };
type RagAnswer = { answer: string; citations: Citation[] };

const REFUSAL = "I don't know based on the help center.";

/** Asks the Help Center a question through the API (extractive mode: answers are copied from sources). */
async function ask(request: APIRequestContext, question: string, bug?: string): Promise<RagAnswer> {
  const r = await request.post('/api/v1/help/ask', { data: { question, mode: 'extractive', ...(bug ? { bug } : {}) } });
  expect(r.status()).toBe(200);
  return r.json();
}

/**
 * Simple grounding check for extractive answers: every sentence must appear word for word in a cited passage.
 * It only works because extractive answers copy their sources. Generated (LLM) answers paraphrase,
 * so they need a smarter check, such as an LLM-as-judge (see eval.spec.ts).
 */
function sentencesNotInSources(a: RagAnswer): string[] {
  const sources = a.citations.map((c) => c.text).join(' ');
  return a.answer
    .replace(/\[\d+\]/g, '')
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s && !sources.includes(s));
}

test.describe('RAG help center: correct behavior', () => {
  test('retrieves the right document and cites it', async ({ request }) => {
    const a = await ask(request, 'How long is the warranty on electronics?');
    expect(a.citations[0].docId).toBe('warranty');
    expect(a.answer).toMatch(/\[\d+\]/);
    expect(sentencesNotInSources(a)).toEqual([]);
  });

  test('never uses the retired returns policy', async ({ request }) => {
    const a = await ask(request, 'How many days do I have to return an item?');
    expect(a.citations.some((c) => c.deprecated)).toBe(false);
    expect(a.answer).toContain('30 days');
  });

  test('refuses questions the documents cannot answer', async ({ request }) => {
    const a = await ask(request, 'What is the capital of France?');
    expect(a.answer).toBe(REFUSAL);
    expect(a.citations).toHaveLength(0);
  });
});

// A check you have never seen fail is a check you can't trust. Each planted defect must be caught.
test.describe('RAG help center: planted defects are caught', () => {
  test('stale docs: cites the retired policy', async ({ request }) => {
    const a = await ask(request, 'How many days do I have to return an item?', 'stale');
    expect(a.citations.some((c) => c.deprecated)).toBe(true);
  });

  test('no retrieval: answers with no sources', async ({ request }) => {
    const a = await ask(request, 'How many days do I have to return an item?', 'no_retrieval');
    expect(a.citations).toHaveLength(0);
    expect(a.answer).not.toBe(REFUSAL);
  });

  test('hallucination: a sentence that no source supports', async ({ request }) => {
    const a = await ask(request, 'How long is the warranty on electronics?', 'hallucinate');
    expect(sentencesNotInSources(a)).toEqual(['Every order also includes a free lifetime warranty.']);
  });
});
