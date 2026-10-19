# Practice Lab: Playwright test suite

[![Playwright](https://github.com/dhanoapartners/practice-lab/actions/workflows/playwright.yml/badge.svg)](https://github.com/dhanoapartners/practice-lab/actions/workflows/playwright.yml)

A complete Playwright + TypeScript suite for **[Practice Lab](https://www.dhanoapartners.com)**, a training site with a demo store, a UI playground, a REST API, SVG charts, a RAG help center, an LLM-as-judge lab, an AI agent and a fictional bank. Every screen and API on the site has tests here: **255 tests** in 16 spec files, documented with JSDoc and run nightly in GitHub Actions.

All test data is synthetic. The lab never uses real customer or personal data, and neither should your tests: generate or mock data instead.

## What is covered

| Spec | Tests | What it covers |
|---|---:|---|
| `specs/shop.spec.ts` | 24 | Search suggestions (keyboard, highlight, no results), category and color multi-selects, price slider, rating and stock filters, sorting, paging, and the product page (variants, sizes, quantity rules, store pickup, tabs, paged reviews, wishlist). |
| `specs/checkout.spec.ts` | 21 | Cart lines, merge, remove-with-confirm, totals checked against an independent pricing model, SAVE10 and FREESHIP, all four checkout steps with every validation message, sign-in, and the `locked_user`, `slow_user` and `error_user` behaviors. |
| `specs/playground.spec.ts` | 41 | Every Playground tile: click types, delayed buttons, modals, inputs, native, multi and custom dropdowns, checkboxes, pickers, dynamic loading, progress, changing elements, drag and drop, keys, infinite scroll, accordion, upload, downloads, new tab, popup, iframe, shadow DOM, visual change and the sortable table. |
| `specs/hover.spec.ts` | 9 | Hover menus, tooltips, the site-wide hover text, and keyboard access to all of them. |
| `specs/site.spec.ts` | 30 | Navigation and deep links, the Test IDs overlay, UI v2 switch, Chaos toggle, Reset data, the in-browser API console, the Help Center page, Skills downloads, Coaching, Terms and the footer. |
| `specs/a11y.spec.ts` | 12 | axe-core scans of every screen, proof that axe finds the four planted bugs, and a keyboard-only purchase. |
| `specs/api.spec.ts` | 23 | Products (filters, sort, paging, lookups), reviews, store availability, auth, cart writes, promo codes, order rules, reset, 404 shapes, and chaos mode with a retry that only retries 503. |
| `specs/network.spec.ts` | 4 | Mocking responses, forcing errors, waiting on API calls and replaying traffic from a HAR file. |
| `specs/locators.spec.ts` | 15 | Chained-locator patterns: scoping, `filter({ hasText / has / hasNot })`, `first/last/nth`, `or()`, `and()`, iframes, shadow DOM, parents, visible-only, SVG. |
| `specs/svg.spec.ts` | 15 | Chart values vs the API, `data-*`, `aria-label` and `<text>`, tooltips, legend toggles and the SVG element gallery. |
| `specs/bank.spec.ts` | 34 | Harbor Demo Bank: balances, running balance, pending-to-posted transfers, idempotency keys, limits, loan wizard, rate engine vs the amortization formula, payments sandbox, webhooks, and four planted money bugs. |
| `specs/rag.spec.ts` | 7 | RAG help bot: retrieval, citations, refusals, and detectors for stale sources, missing retrieval and hallucinated claims. |
| `specs/eval.spec.ts` | 10 | LLM-as-judge: judging answers, the golden set, and calibrating the judge against human labels. |
| `specs/agent.spec.ts` | 7 | AI agent: tool sequence, claimed vs actual actions, prompt-injection resistance and step limits. |
| `specs/shop.plain.spec.ts`, `specs/shop.healing.spec.ts` | 3 | The self-healing locator demo: the same journey with plain locators (breaks on UI v2) and with the healer (passes and writes a report). |

Helpers live in `support/`:

| File | Purpose |
|---|---|
| `healer.ts`, `healing-reporter.ts`, `locators.ts` | Self-healing locators: role → text → CSS → similarity fallbacks, and a report of every heal. |
| `pricing.ts` | An independent copy of the store's pricing rules, so totals are computed by the test, not copied from the page. |
| `rag-checks.ts` | Groundedness and citation checks for RAG answers. |
| `lab.ts` | `labUrl()` for screens and `sessionHeaders()` for isolated API sessions. |

## How the tests are written

- **Stable locators.** Test IDs first, then roles and labels. No XPath, no CSS chains tied to layout.
- **No sleeps.** Every wait is an assertion that retries (`toHaveText`, `toBeEnabled`, `expect.poll`).
- **Isolated data.** Each test gets its own session (cookie or `X-Session-Id`), so the suite runs fully in parallel.
- **Independent oracles.** Money, loan payments and sort orders are computed by the test, then compared with the site.
- **Every checker is tested.** Planted defects (RAG, judge, agent, bank) must be caught, and the same check must pass on the healthy system.
- **JSDoc everywhere.** Each spec starts with a `@file` block saying what it covers and how to run it; helpers document their parameters and return values.

## Setup

Needs Node.js 20 or later.

```bash
npm install
npx playwright install chromium
npm test
```

Tests run against the live lab by default, with 2 workers so the site's rate limit (100 API requests per 10 seconds per IP) doesn't block the run. To use a local copy of the site with full parallelism:

```bash
LAB_URL=http://localhost:8788 npm test
```

## Commands

| Command | What it runs |
|---|---|
| `npm test` | Every test on UI v1 |
| `npm run test:ui` | Shop, checkout, Playground, hover and site tests |
| `npm run test:api` | REST API tests for the shop and the bank |
| `npm run test:ai` | RAG, LLM-as-judge and agent tests |
| `npm run test:a11y` | Accessibility scans |
| `npm run test:bank` | Harbor Demo Bank, API and UI |
| `npm run typecheck` | TypeScript strict-mode check of every file |
| `npm run demo:broken` | Plain test-ID locators on UI v2: the test fails |
| `npm run demo:healed` | The same journey with the healer on UI v2: it passes and writes `healing-report.md` |
| `npm run har:record` | Records the catalog API to `fixtures/catalog.har`; the replay test uses it afterwards |
| `LAB_LLM=1 npm test` | Adds the LLM-mode RAG test (uses the live lab's Workers AI) |
| `VISUAL=1 npm test` | Adds the baseline screenshot test (`--update-snapshots` on the first run) |
| `npm run report` | Opens the HTML report |

## Continuous integration

`.github/workflows/playwright.yml` runs the typecheck and the full suite on every push, on pull requests and every night at 09:17 UTC. The HTML report is attached to each run for 14 days.

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
