/**
 * @file Checks for RAG answers from POST /api/v1/help/ask.
 *
 * In a real project, swap groundedness() for an LLM-as-judge call; the shape of the result stays the same.
 */

/** One retrieved passage cited by an answer. `deprecated` marks the retired 2024 policy. */
export type Citation = { n: number; docId: string; deprecated: boolean; text: string; score: number };
/** The Help Center's response: answer text, its citations, and which generator and defect produced it. */
export type RagAnswer = { answer: string; citations: Citation[]; generator: string; bug: string };

/** Common words ignored when comparing an answer with its sources. */
const STOP = new Set(['the', 'and', 'for', 'are', 'you', 'your', 'with', 'can', 'not', 'our', 'all', 'any', 'its', 'this', 'that', 'from', 'within', 'after', 'also', 'every']);
/** Meaningful words in a string (lowercase, 3+ letters, no stop words). */
const words = (s: string) => (s.toLowerCase().match(/[a-z0-9$]+/g) || []).filter((w) => w.length > 2 && !STOP.has(w));
/** The exact text the Help Center returns when the documents can't answer. */
export const REFUSAL = "I don't know based on the help center.";

/**
 * Share of answer sentences whose words mostly (60%+) appear in the cited passages.
 * @param a The answer to check.
 * @returns `score` from 0 to 1 and the list of unsupported sentences.
 */
export function groundedness(a: RagAnswer) {
  const source = new Set(words(a.citations.map((c) => c.text).join(' ')));
  const sentences = a.answer.replace(/\[\d+\]/g, '').split(/(?<=[.!?])\s+/).filter((s) => words(s).length);
  const unsupported = sentences.filter((s) => { const w = words(s); return w.filter((x) => source.has(x)).length / w.length < 0.6; });
  return { score: sentences.length ? 1 - unsupported.length / sentences.length : 1, unsupported };
}

/**
 * Runs every RAG check on an answer.
 * @param a The answer to check.
 * @returns Problems found, each prefixed with its type (stale-source, no-sources, no-citations,
 *   unsupported-claim). An empty list means the answer passes.
 */
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
