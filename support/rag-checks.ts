// Checks for RAG answers from POST /api/v1/help/ask.
// In a real project, swap groundedness() for an LLM-as-judge call; the shape
// of the result stays the same.

export type Citation = { n: number; docId: string; deprecated: boolean; text: string; score: number };
export type RagAnswer = { answer: string; citations: Citation[]; generator: string; bug: string };

const STOP = new Set(['the', 'and', 'for', 'are', 'you', 'your', 'with', 'can', 'not', 'our', 'all', 'any', 'its', 'this', 'that', 'from', 'within', 'after', 'also', 'every']);
const words = (s: string) => (s.toLowerCase().match(/[a-z0-9$]+/g) || []).filter((w) => w.length > 2 && !STOP.has(w));
export const REFUSAL = "I don't know based on the help center.";

/** Share of answer sentences whose words mostly appear in the cited passages. */
export function groundedness(a: RagAnswer) {
  const source = new Set(words(a.citations.map((c) => c.text).join(' ')));
  const sentences = a.answer.replace(/\[\d+\]/g, '').split(/(?<=[.!?])\s+/).filter((s) => words(s).length);
  const unsupported = sentences.filter((s) => { const w = words(s); return w.filter((x) => source.has(x)).length / w.length < 0.6; });
  return { score: sentences.length ? 1 - unsupported.length / sentences.length : 1, unsupported };
}

/** Returns the list of problems found; an empty list means the answer passes. */
export function ragIssues(a: RagAnswer): string[] {
  const issues: string[] = [];
  const refused = a.answer.trim() === REFUSAL;
  if (a.citations.some((c) => c.deprecated)) issues.push('stale-source: cites a retired document');
  if (!a.citations.length && !refused) issues.push('no-sources: answered without retrieving anything');
  if (a.citations.length && !refused && !/\[\d+\]/.test(a.answer)) issues.push('no-citations: answer has no [n] markers');
  const g = groundedness(a);
  if (a.citations.length && g.score < 1) issues.push(`unsupported-claim: ${g.unsupported.join(' | ')}`);
  return issues;
}
