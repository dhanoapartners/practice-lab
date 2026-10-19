/**
 * @file Playwright reporter that turns self-heals into healing-report.md and healing-report.json.
 * Registered in playwright.config.ts.
 */
import type { Reporter, TestCase, TestResult } from '@playwright/test/reporter';
import { writeFileSync } from 'node:fs';
import type { HealEvent } from './healer';

/**
 * Collects every self-heal from the run and writes healing-report.json and
 * healing-report.md: what broke, what the healer used instead, how confident
 * it was, and the test ID to update in support/locators.ts.
 */
export default class HealingReporter implements Reporter {
  private events: HealEvent[] = [];

  /** Collects `self-healed` attachments from each finished test. */
  onTestEnd(_test: TestCase, result: TestResult) {
    for (const a of result.attachments) {
      if (a.name === 'self-healed' && a.body) this.events.push(JSON.parse(a.body.toString()));
    }
  }

  /** Writes both report files once the run ends, if anything healed. */
  onEnd() {
    if (!this.events.length) return;
    const unique = new Map<string, HealEvent>();
    this.events.forEach((e) => unique.set(e.key + e.healedWith, e));
    const rows = [...unique.values()];
    writeFileSync('healing-report.json', JSON.stringify(rows, null, 2));
    const md = [
      '# Self-healing report', '',
      `${rows.length} locator(s) healed during this run. Review each one, then update support/locators.ts so the next run uses the primary locator again.`, '',
      '| Element | Broken locator | Healed with | Strategy | Confidence | Suggested test ID |',
      '|---|---|---|---|---|---|',
      ...rows.map((e) => `| ${e.key} | \`${e.broken}\` | \`${e.healedWith}\` | ${e.strategy} | ${Math.round(e.confidence * 100)}% | ${e.suggestedTestId ?? '(none)'} |`),
    ].join('\n');
    writeFileSync('healing-report.md', md + '\n');
    console.log(`\n⚕ ${rows.length} locator(s) self-healed. See healing-report.md`);
    rows.forEach((e) => console.log(`   ${e.key}: ${e.broken} → ${e.healedWith} [${e.strategy}, ${Math.round(e.confidence * 100)}%]`));
  }
}
