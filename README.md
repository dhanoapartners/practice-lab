# Practice Lab: Playwright test suite

[![Playwright](https://github.com/dhanoapartners/practice-lab/actions/workflows/playwright.yml/badge.svg)](https://github.com/dhanoapartners/practice-lab/actions/workflows/playwright.yml)

A Playwright + TypeScript suite for **[Practice Lab](https://www.dhanoapartners.com)**, a training site with a demo store, a UI playground, a REST API, SVG charts and a fictional bank. **255 tests** in 16 spec files: the site suite plus training samples for self-healing, RAG, LLM-as-judge, AI agents and failure triage, documented with JSDoc and run nightly in GitHub Actions.

All test data is synthetic. The lab never uses real customer or personal data, and neither should your tests: generate or mock data instead.

## What is covered

| Spec | Tests | What it covers |
|---|---:|---|
| `specs/shop.spec.ts` | 24 | Search suggestions (keyboard, highlight, no results), category and color multi-selects, price slider, rating and stock filters, sorting, paging, and the product page (variants, sizes, quantity rules, store pickup, tabs, paged reviews, wishlist). |
| `specs/checkout.spec.ts` | 21 | Cart lines, merge, remove-with-confirm, totals checked against an independent pricing model, SAVE10 and FREESHIP, all four checkout steps with every validation message, sign-in, and the `locked_user`, `slow_user` and `error_user` behaviors. |
| `specs/playground.spec.ts` | 41 | Every Playground tile: click types, delayed buttons, modals, inputs, native, multi and custom dropdowns, checkboxes, pickers, dynamic loading, progress, changing elements, drag and drop, keys, infinite scroll, accordion, upload, downloads, new tab, popup, iframe, shadow DOM, visual change and the sortable table. |
| `specs/hover.spec.ts` | 9 | Hover menus, tooltips, the site-wide hover text, and keyboard access to all of them. |
| `specs/site.spec.ts` | 36 | Navigation and deep links, the Test IDs overlay, UI v2 switch, Chaos toggle, Reset data, the in-browser API console, the Help Center, Triage Lab and Skills pages, Coaching, Terms and the footer. |
| `specs/a11y.spec.ts` | 12 | axe-core scans of every screen, proof that axe finds the four planted bugs, and a keyboard-only purchase. |
| `specs/api.spec.ts` | 23 | Products (filters, sort, paging, lookups), reviews, store availability, auth, cart writes, promo codes, order rules, reset, 404 shapes, and chaos mode with a retry that only retries 503. |
| `specs/network.spec.ts` | 4 | Mocking responses, forcing errors, waiting on API calls and replaying traffic from a HAR file. |
| `specs/locators.spec.ts` | 15 | Chained-locator patterns: scoping, `filter({ hasText / has / hasNot })`, `first/last/nth`, `or()`, `and()`, iframes, shadow DOM, parents, visible-only, SVG. |
| `specs/svg.spec.ts` | 15 | Chart values vs the API, `data-*`, `aria-label` and `<text>`, tooltips, legend toggles and the SVG element gallery. |
| `specs/bank.spec.ts` | 35 | Harbor Demo Bank: balances, running balance, pending-to-posted transfers, idempotency keys, limits, loan wizard, rate engine vs the amortization formula, payments sandbox, webhooks, and four planted money bugs. |

Page objects live in `pages/` (`ShopPage`, `CheckoutPage`; see `specs/pages.spec.ts`). Helpers live in `support/`:

| File | Purpose |
|---|---|
| `lab.ts` | `labUrl()` for screens and `sessionHeaders()` for isolated API sessions. |
| `test-data.ts` | Every fixed value (users, products, promo codes, address, test cards) in one place. |
| `fixtures.ts` | Custom fixtures that hand each test ready-made page objects. |
| `fallback-locator.ts` | Training sample: test ID first, then role + name, then text; logs every fallback. |
| `pricing.ts` | An independent copy of the store's pricing rules, so totals are computed by the test, not copied from the page. |

## How the tests are written

- **Stable locators.** Test IDs first, then roles and labels. No XPath, no CSS chains tied to layout.
- **No sleeps.** Every wait is an assertion that retries (`toHaveText`, `toBeEnabled`, `expect.poll`).
- **Isolated data.** Each test gets its own session (cookie or `X-Session-Id`), so the suite runs fully in parallel.
- **Independent oracles.** Money, loan payments and sort orders are computed by the test, then compared with the site.
- **Every checker is tested.** Planted defects must be caught, and the same check must pass on the healthy system.
- **JSDoc everywhere.** Each spec starts with a `@file` block saying what it covers and how to run it.

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
| `npm run test:smoke` | Only the key journeys tagged `@smoke` (fast check) |
| `npm run test:regression` | Everything except `@smoke` |
| `npm run test:ui` | Shop, checkout, Playground, hover and site tests |
| `npm run test:api` | REST API tests for the shop and the bank |
| `npm run test:ai` | RAG, LLM-as-judge and AI agent samples |
| `npm run test:a11y` | Accessibility scans |
| `npm run test:bank` | Harbor Demo Bank, API and UI |
| `npm run typecheck` | TypeScript strict-mode check of every file |
| `npm run har:record` | Records the catalog API to `fixtures/catalog.har`; the replay test uses it afterwards |
| `VISUAL=1 npm test` | Adds the baseline screenshot test (`--update-snapshots` on the first run) |
| `npm run demo:broken` / `demo:healed` | Fallback-locator demo on UI v2 |
| `npm run demo:triage` | Release night + basic triage |
| `npm run report` | Opens the Playwright HTML report |
| `npm run allure:generate` / `allure:open` | Builds / opens the Allure report from the last run (needs Java 11+) |

UI v2 simulates a release: test IDs and button labels change (`add-to-cart` becomes `add-to-bag`, "Add to cart" becomes "Add to bag"). Switch it in the lab's header or with `?ui=v2`.

## Continuous integration

`.github/workflows/playwright.yml` runs the typecheck, then the `@smoke` tests, then the rest, on every push, on pull requests and every night at 09:17 UTC. The Playwright HTML report and the Allure report are attached to each run for 14 days.

## Reports

Every run writes two reports:

- **Playwright HTML report** (`npm run report`): the place to debug, with traces, screenshots and step-by-step actions.
- **Allure report** (`npm run allure:generate`, then `npm run allure:open`): the place to share results, with suites, timelines, history and categories for people who don't read code.

## Training samples: AI-era testing

Small, readable versions of the ideas taught in the Dhanoa Partners courses. They show the concept and run against the lab; production tools go much further.

| Sample | Files | Run |
|---|---|---|
| **Fallback (self-healing) locators** | `support/fallback-locator.ts`, `specs/healing.spec.ts` | `npm run demo:broken` (plain locators on UI v2: fails), `npm run demo:healed` (fallbacks: passes and logs each fallback) |
| **Testing a RAG bot** | `specs/rag.spec.ts` | `npx playwright test specs/rag.spec.ts` |
| **LLM-as-judge** | `specs/eval.spec.ts` | `npx playwright test specs/eval.spec.ts` |
| **Testing an AI agent** | `specs/agent.spec.ts` | `npx playwright test specs/agent.spec.ts` |
| **Failure triage (basic rules)** | `triage-basic/triage.ts`, `specs/triage/release-night.spec.ts` | `npm run demo:triage` |

`npm run test:ai` runs the RAG, judge and agent samples together.

### Release night

The site's **[Triage Lab](https://www.dhanoapartners.com/#triage)** tells the story: four things break in one nightly run, eight tests go red, and only two are real bugs. `npm run demo:triage` runs that night (failures are expected) and then sorts each failure with simple rules on the error text and retry history.

Compare the result with the table at the top of `specs/triage/release-night.spec.ts`. The basic rules get one failure wrong: the error text can't tell a missing element from a page whose backend is down. Working out why, and what extra evidence would fix it, is the exercise.

The full AI failure triage agent (evidence capture, AI verdicts, confidence gating, Allure categories) and the production self-healing engine are part of **[QualityFirstQA](https://qualityfirstqa.com)**'s services. To see them on your own suite, [book a call](https://bookings.cloud.microsoft/book/QualityFirstQA@qualityfirstqa.com/).

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
