/**
 * @file Training sample: sort failed tests into categories with simple rules.
 *
 *   npx tsx triage-basic/triage.ts [reports/results.json]
 *
 * Reads Playwright's JSON report and puts every failed test in one bucket, using only the error text
 * and the retry history:
 *
 *   failed, then passed on retry          → Flaky
 *   error mentions 502 / 503 / 504         → Environment
 *   a locator never found its element      → Test issue
 *   an assertion got a different value     → Product bug (check it)
 *   anything else                          → Needs a person
 *
 * This is a teaching version. Run it on release night (`npm run demo:triage`) and compare its answers with
 * the table in specs/triage/release-night.spec.ts: one failure lands in the wrong bucket, because error text
 * alone can't tell a missing element from a page whose backend is down. Fixing that needs more evidence
 * (what the page's API calls returned), which is where production triage tools start.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

type Bucket = 'Flaky' | 'Environment' | 'Test issue' | 'Product bug (check it)' | 'Needs a person';

interface Result { status: string; error?: { message?: string } }
interface Spec { title: string; file: string; line: number; tests: Array<{ status: string; results: Result[] }> }
interface Suite { title: string; specs?: Spec[]; suites?: Suite[] }

const stripAnsi = (s: string) => s.replace(/\u001b\[[0-9;]*m/g, '');

/** The rules, in order. The first one that matches wins. */
function sort(status: string, error: string): Bucket {
  if (status === 'flaky') return 'Flaky';
  if (/\b50[234]\b/.test(error)) return 'Environment';
  if (/waiting for (getBy|locator)|element\(s\) not found/.test(error)) return 'Test issue';
  if (/Expected:[\s\S]*Received:/.test(error)) return 'Product bug (check it)';
  return 'Needs a person';
}

const reportPath = process.argv[2] ?? 'reports/results.json';
if (!existsSync(reportPath)) {
  console.error(`No report at ${reportPath}. Run the tests first.`);
  process.exit(0);
}

const rows: Array<{ bucket: Bucket; title: string; reason: string }> = [];
function walk(suite: Suite, path: string[]) {
  const here = suite.title ? [...path, suite.title] : path;
  for (const spec of suite.specs ?? []) {
    for (const t of spec.tests) {
      if (t.status !== 'unexpected' && t.status !== 'flaky') continue;
      const failed = t.results.find((r) => r.status !== 'passed') ?? t.results[0];
      const error = stripAnsi(failed.error?.message ?? '');
      rows.push({
        bucket: sort(t.status, error),
        title: [...here.slice(1), spec.title].join(' › '),
        reason: error.split('\n').find((l) => l.trim())?.trim() ?? '(no error text)',
      });
    }
  }
  for (const child of suite.suites ?? []) walk(child, here);
}
for (const s of (JSON.parse(readFileSync(reportPath, 'utf8')) as { suites: Suite[] }).suites) walk(s, []);

const order: Bucket[] = ['Product bug (check it)', 'Test issue', 'Environment', 'Flaky', 'Needs a person'];
rows.sort((a, b) => order.indexOf(a.bucket) - order.indexOf(b.bucket));

console.log(`\nFailure triage (basic rules): ${rows.length} failed test(s)\n`);
for (const r of rows) console.log(`${r.bucket.padEnd(24)} ${r.title}\n${' '.repeat(25)}↳ ${r.reason}`);

mkdirSync('reports', { recursive: true });
writeFileSync(
  'reports/triage-basic.md',
  ['# Failure triage (basic rules)', '', '| Bucket | Test | First error line |', '|---|---|---|',
    ...rows.map((r) => `| ${r.bucket} | ${r.title} | ${r.reason.replace(/\|/g, '\\|')} |`)].join('\n') + '\n',
);
console.log('\nWritten to reports/triage-basic.md\n');
