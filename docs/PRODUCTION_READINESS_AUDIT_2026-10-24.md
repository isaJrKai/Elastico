# Elastico production-readiness audit — 24 October 2026

## Executive status

**Release status: NOT READY FOR SALE YET.** The work is underway in isolated branches and draft pull requests. No pull request listed here has been merged to `main`, and no production deployment has been performed by this audit.

The most important goal is to make the product honest and reproducible: live data must be distinguished from estimates and simulations; every model must be traceable to real inputs; and a clean installation must be reproducible from committed files.

## Work completed on branches

- **Cron security:** `fix/security-cron-secret` removes the known default cron secret fallback and rejects absent/short configured secrets. It also rewrites `prisma/seed.ts` to refuse production execution and removes hard-coded demo passwords. Draft PR #7: https://github.com/isaJrKai/Elastico/pull/7
- **Prediction integrity:** `fix/prediction-no-fake-ratings` removes abbreviation-hash ratings, withholds unsupported teams, avoids invented fixture names/scores, requires explicit stochastic-engine inputs, and labels the engine unvalidated. Draft PR #8: https://github.com/isaJrKai/Elastico/pull/8
- **UI data honesty and simulation safety:** `fix/fabricated-ui-data` stops deriving xG, possession, passing accuracy and pressing intensity from unrelated match results. It also prevents synthetic simulation outcomes from settling real user predictions or changing accuracy/streaks. Draft PR #11: https://github.com/isaJrKai/Elastico/pull/11
- **Prediction API contract:** `fix/prediction-api-contract` validates score/confidence inputs and fixes confidence display being multiplied by 100 twice in the AI evidence builder. Draft PR #13: https://github.com/isaJrKai/Elastico/pull/13
- **Visual system:** `feat/ui-redesign-premium` introduces a quieter paper/ink palette and removes glow-heavy tokens as a first redesign step. It is not yet a full view-by-view redesign. Draft PR #9: https://github.com/isaJrKai/Elastico/pull/9
- **Quality gates:** `test/production-readiness-gates` adds a standalone build setting, probability invariant tests, and CI checks for Prisma generation, unit tests, lint, type-check and production build. Draft PR #6: https://github.com/isaJrKai/Elastico/pull/6
- **Repository checkout hygiene:** `chore/remove-orphaned-submodule` removes an orphaned `elastico-source` gitlink with no `.gitmodules` mapping. Draft PR #12: https://github.com/isaJrKai/Elastico/pull/12
- **Sale-readiness tracking:** Draft PR #10 documents buyer due-diligence requirements: https://github.com/isaJrKai/Elastico/pull/10

## CI evidence and limitations

A CI run on the quality-gates branch completed successfully: https://github.com/isaJrKai/Elastico/actions/runs/40031094737

Passed in that run:
- dependency installation after a lockfile reconciliation step,
- Prisma client generation,
- three statistical invariant tests,
- lint of the active `src` tree,
- TypeScript type-check,
- Next.js production build.

**Important limitation:** the committed `package-lock.json` was stale. The workflow regenerated it inside the runner before running `npm ci` and uploaded the generated file as an artifact. Therefore this run does **not** prove that a fresh checkout can install using the currently committed lockfile. The reconciled lockfile still needs to be reviewed and committed; the install step must then be changed back to a strict `npm ci` from the committed lock.

The statistical tests only verify probability invariants. They do not establish forecast accuracy, calibration, profitability, or model superiority.

## Remaining release blockers

1. **Committed dependency lock:** reconcile and commit the generated npm lockfile, then prove strict clean install from checkout.
2. **Full runtime/UI audit:** reproduce the reported startup/opening failure; verify every navigation route and primary action in a browser.
3. **Model truth:** trace production predictions to actual trained models and timestamped pre-match features. The current compute endpoint still uses static curated team offsets and is explicitly experimental.
4. **Backtesting:** evaluate chronologically on untouched test periods, with bookmaker-implied/no-skill baselines, log loss, Brier score, calibration and per-league/market reports.
5. **Data provider contracts:** verify freshness, rate limits, source conflicts, missing data, team/fixture identity and provider licensing.
6. **API contracts:** test every route for authorization, schema validation, timeout, errors and rate limiting.
7. **Secrets/history:** run a secret scan across repository history and any source repository previously referenced by the orphaned gitlink. Rotate/revoke any credential that may have been committed; deleting a current file is not sufficient.
8. **Archive cleanup:** the nested `elastico-work/Elastico-main` snapshot is stale and contains duplicate source. Quarantine/remove it after deciding what audit evidence must be preserved. Track under issue #14: https://github.com/isaJrKai/Elastico/issues/14
9. **Visual redesign:** complete every major screen, responsive states, accessibility, loading/empty/error states, and ensure no decorative UI implies unsupported analytical certainty.
10. **Production staging:** deploy a release candidate to staging, run smoke tests, verify health and data sync, test rollback/backup restoration, and only then approve production release.
11. **Buyer package:** document architecture, environment variables, migrations, operations, model cards, source licenses, IP ownership and transfer steps.

## Sale principle

Do not claim the application is production-ready, the model is accurate, or the system is profitable until evidence supports each claim. Keep all current PRs in draft until their individual checks pass and overlapping route changes are reconciled into a single integration candidate.
