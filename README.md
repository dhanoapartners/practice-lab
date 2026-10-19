# Practice Lab: Playwright test suite

Practice tests for **[Practice Lab](https://www.dhanoapartners.com)**, a demo store, UI playground, REST API and RAG help center built for automation training.

This suite shows nine things most tutorials skip:

| Folder / file | What it demonstrates |
|---|---|
| `support/healer.ts`, `support/healing-reporter.ts` | **Self-healing locators.** When a release renames a test ID, the healer finds the element by role, text, CSS or similarity, keeps the test green and writes a report of what to fix. |
| `specs/rag.spec.ts`, `support/rag-checks.ts` | **Testing a RAG chatbot.** Retrieval, citations, refusals, and detectors for stale sources, missing retrieval and hallucinated claims. |
| `specs/network.spec.ts` | **Network control.** Mocking responses, forcing errors, waiting on API calls and replaying traffic from a HAR file. |
| `specs/api.spec.ts` | **API testing** with isolated sessions, auth tokens and validation errors. |
| `specs/locators.spec.ts` | **15 chained-locator patterns**: scoping, `filter({ hasText / has / hasNot })`, `first/last/nth`, `or()`, `and()`, iframes, shadow DOM, walking up to a parent, visible-only matches, and chaining into SVG. |
| `specs/svg.spec.ts` | **Reading SVG charts**: compare chart values with the API, read `data-*`, `aria-label` and `<text>`, hover tooltips, legend toggles, and the SVG element gallery. |
| `specs/eval.spec.ts` | **LLM-as-judge.** Judging single answers, running a golden set, and calibrating the judge against human labels so planted judge defects are caught. |
| `specs/agent.spec.ts` | **Testing AI agents.** Tool sequence, claimed vs actual actions, asking for missing input, prompt-injection resistance and step limits. |
| `specs/bank.spec.ts` | **Testing a bank (Harbor Demo Bank).** Balances and running balance, pending-to-posted transfers, idempotency keys, daily-limit boundaries, a loan application wizard, a rate engine checked against the amortization formula, a payments sandbox (declines, one-time code, refunds, out-of-order webhooks) and four planted money bugs. |

All test data is synthetic. The lab never uses real customer or personal data, and neither should your tests: generate or mock data instead.

## Setup

Needs Node.js 20 or later.

```bash
npm install
npx playwright install chromium
npm test
```

Tests run against the live lab by default. To use a local copy of the site instead:

```bash
LAB_URL=http://localhost:8788 npm test
```

## Commands

| Command | What it shows |
|---|---|
| `npm test` | Every test on UI v1 |
| `npm run test:live` | The same suite with 2 workers. Use it against the live site so the API rate limit (100 requests per 10 seconds) doesn't block the run. |
| `npm run demo:broken` | Plain test-ID locators on UI v2: the test fails |
| `npm run demo:healed` | The same journey with the healer on UI v2: it passes and writes `healing-report.md` |
| `npm run har:record` | Records the catalog API to `fixtures/catalog.har`; the replay test uses it afterwards |
| `LAB_LLM=1 npm test` | Adds the LLM-mode RAG test (uses the live lab's Workers AI) |
| `npm run report` | Opens the HTML report |

UI v2 simulates a release: test IDs and button labels change (`add-to-cart` becomes `add-to-bag`, "Add to cart" becomes "Add to bag"). Switch it in the lab's header or with `?ui=v2`.

## Video 1: Self-healing locators (about 8 minutes)

1. **The problem.** Open the shop on v1. Turn on **Test IDs** and hover over the search box and Add to cart button to show their IDs.
2. **A passing test.** Show `specs/shop.plain.spec.ts` and run it: green.
3. **A release breaks it.** Switch the header to **UI v2**. Show that `add-to-cart` is now `add-to-bag`. Run `npm run demo:broken`: red.
4. **How the healer works.** Open `support/locators.ts`: each element has a primary test ID plus a fingerprint (role, name, text, CSS). Walk through `support/healer.ts`: role → text → CSS → similarity score. Point out `visibleOnly` and why it exists: without it, `getByRole('option')` healed onto a hidden `<option>` in the header.
5. **Healed run.** Run `npm run demo:healed` and read each heal line: strategy and confidence.
6. **The report.** Open `healing-report.md`. Each row gives the new test ID to put back in `locators.ts`. Healing keeps the pipeline green today; the report makes sure a person fixes the locator tomorrow.
7. **Close.** Review the lowest-confidence heal first (Add to cart, 50%).

## Video 2: Testing a RAG chatbot (about 10 minutes)

1. **What RAG is.** Open **Help Center** and ask "Do you ship to Canada?" Point out the cited sources and retrieval scores.
2. **Ground truth.** Expand the help documents at the bottom of the page. Every expected answer comes from them.
3. **Retrieval tests.** Show `specs/rag.spec.ts`: the right document comes first, the retired 2024 policy is never used, and an out-of-scope question gets a refusal.
4. **Plant the defects.** In **Training controls**, ask the same question with each defect:
   - **Stale docs:** cites the retired policy and says 60 days.
   - **No retrieval:** a confident answer with zero sources.
   - **Hallucination:** an extra sentence about a lifetime warranty; the grounding badge drops.
5. **Prove the checks work.** Show `support/rag-checks.ts` and the "planted defects are caught" tests. If a checker misses its defect, the test fails.
6. **LLM mode.** Switch to **LLM (Workers AI)**. Wording changes between runs, so assert on properties (right source, citations, grounded), never exact text. Production suites replace the word-overlap check with an LLM-as-judge.

## Video 3: Who judges the judge? (about 8 minutes)

1. Open **Eval Lab → Judge one answer** and judge the sample: it fails on groundedness because of the lifetime-warranty sentence.
2. **Run the golden set** with no defect (90% or more), then with the Help Center's hallucination defect: the pass rate drops.
3. **Calibrate the judge**: 100% agreement with the human labels. Plant **Lenient** and run it again: agreement falls and false passes appear.
4. Show `specs/eval.spec.ts`: every judge defect must lower agreement, or the calibration set is too weak.

## Video 4: Testing an AI agent (about 8 minutes)

1. Open **AI Agent** and click "Add two Bluetooth speakers to my cart". Walk through the trace: search, add, confirm.
2. Point at **Actually happened**, the real cart count. Never trust the reply alone.
3. Plant **Wrong tool**: the reply still says "Added 2", but the cart did not change.
4. Ask "Is the Bluetooth speaker any good?" A review hides instructions. With no defect the agent warns and ignores them; with **Prompt injection** it adds 3 rugs.
5. Plant **Loop** with a step limit of 4: the agent stops at 4 steps.
6. Show `specs/agent.spec.ts` and the **agent-trace-reviewer** skill.

## Video 5: Testing a bank (about 12 minutes)

Harbor Demo Bank is fictional: the customer (Jordan Rivera), accounts, merchants and cards are all synthetic.

1. **Accounts.** Open **Bank**. Point out balance vs available on checking, and balance owed vs available credit on the card.
2. **Statements.** Search "payroll": 6 rows, $14,100.00 in. The newest row's running balance equals the account balance. Download the CSV and count the lines.
3. **Transfers.** Move $120.50 to savings. Show the review step and the Idempotency-Key. Double-click Confirm: one transfer, not two. Watch it go from pending to posted.
4. **Boundaries.** Daily limit $2,500.00: exactly $2,500.00 passes, $0.01 more fails. Amounts with 3 decimals fail. Schedule a transfer for next week and cancel it.
5. **Loan application.** Walk the five steps. Show the age rule, the employer field that disappears for retirees, and the vehicle section that only appears for auto loans. Save a draft, then submit: approved at 6.99%, $494.91 a month.
6. **Rate calculator.** Change the credit score and watch the APR and breakdown change. Show the test computing the payment with its own amortization formula instead of trusting the screen.
7. **Payments sandbox.** Use the test-card table: success, decline, one-time code (123456), a card that settles a few seconds later, a partial refund, and webhook events that arrive out of order.
8. **Plant the defects.** In **Training controls**, plant each defect and run `specs/bank.spec.ts -g "Planted"`:
   - **Double post:** one click books two transfers.
   - **Limit off by one:** $2,500.01 is accepted.
   - **Rounding:** $20,000 over 60 months shows $393.57 instead of $393.58.
   - **Stale balance:** available balance does not drop after a transfer.
   Each check runs twice: it must pass on the correct bank and fail with its defect. A check that passes with the defect on is too weak.

## Exercises

- "Can I use SAVE10 and FREESHIP together?" The answer leaves out the one-code-per-order rule. Write a test that catches incomplete answers.
- Add a healer target for the promo code field and break it with UI v2.
- Write a checkout test that uses `slow_user` and proves your waits are right.
- Bank: write a test that proves savings allows only 6 withdrawals a month, then plant `limit_off_by_one` and decide whether your test should catch it.
- Bank: with `X-Bank-Bug: double_post`, find the duplicate charge in the payments list using only the UI.
- Turn on Chaos mode (`X-Chaos: 1`) and add retries to the API tests without hiding real failures.

## Test data

| Item | Value |
|---|---|
| Password for all users | `practice123` |
| Users | `standard_user`, `locked_user` (403), `slow_user` (+3 s), `error_user` (half of writes fail) |
| Promo codes | `SAVE10`, `FREESHIP` |
| Test cards | `4242 4242 4242 4242` succeeds, `4000 0000 0000 0002` is declined |
| Out of stock | `p-1004`, `p-1011`, `p-1018` |
| Isolated API cart | send any `X-Session-Id` header |
| Bank customer | Jordan Rivera, C-000417 (fictional). Seed: checking $7,707.30, savings $9,488.57, card owes $1,325.94 |
| Bank test cards | `4242…4242` succeeds, `4000…0002` declined, `4000…9995` insufficient funds, `4000…3220` needs code `123456`, `4000…1976` settles later, `4100…0019` blocked |
| Bank defects | header `X-Bank-Bug`: `double_post`, `limit_off_by_one`, `rounding`, `stale_balance` |

Keep load tests against the live lab small. Run heavy k6 tests against a local copy.

© 2026 QualityFirstQA LLC. Dhanoa Partners is a training brand of QualityFirstQA LLC. Created by Avneet Dhanoa. For personal learning; see LICENSE.
