# Elastico sale-readiness audit

## Objective

Prepare Elastico as a transferable football analytics product, not merely a feature-rich demo. A buyer should be able to install it, configure providers, reproduce predictions, understand limitations, and maintain it without the original developer.

## Current status

**Not yet ready to represent as production-ready or independently validated.** The code review identified concrete blockers; the complete runtime and model audit is still in progress.

## Initial verified source findings

1. `src/app/api/cron/sync/route.ts` accepted the literal `elastico-cron-2024` even when a different secret was configured. A security branch removes this fallback and fails closed if the configured secret is absent or shorter than 32 characters.
2. `src/app/api/predictions/compute/route.ts` synthesized team rating offsets from abbreviations for teams not present in the manual rating map. A separate branch removes that fallback, withholds unsupported predictions, and returns reasons.
3. The same prediction route substituted `Home` / `Away` and 0-0 when fixture names/scores were missing. A separate branch stops fabricating those values and reports incomplete fixture counts.
4. The repository has multiple statistical engines and a training script, but their existence alone does not prove the production route uses trained models or that forecasts are calibrated. This needs route tracing and reproducible backtesting.
5. `package.json` has build and lint scripts but no standard test script in the reviewed version. A quality-gates branch adds CI for dependency installation, Prisma generation, lint, type-check and production build; CI must run successfully before any pass is claimed.
6. The current visual system defaults to a dark, high-glow palette. A UI branch introduces a quieter paper/ink palette as a first design direction; this is not a complete screen-by-screen redesign.

## Required buyer due diligence package

- [ ] Installation and deployment guide with required environment variables.
- [ ] Architecture and data-flow diagram.
- [ ] Inventory of APIs, providers, licenses, quotas and fallback behaviour.
- [ ] Database schema, migrations, backup/restore and ownership-transfer steps.
- [ ] Authentication, authorization, threat-model and dependency audit.
- [ ] CI evidence for lint, type-check, build and automated tests.
- [ ] Route-by-route API contract and integration-test report.
- [ ] Model cards with training data, feature definitions, model version and limitations.
- [ ] Time-split backtest report and comparison against bookmaker/no-skill baselines.
- [ ] Calibration reports, log loss, Brier score, and performance by league/market.
- [ ] Prediction tracking from pre-match timestamp to final result, including failures and abstentions.
- [ ] UI/UX review across desktop and mobile, keyboard accessibility and empty/error states.
- [ ] Clean production deployment and smoke-test evidence.
- [ ] No unmarked sample data, placeholder analytics, fake odds or fabricated team-strength values.
- [ ] IP ownership, third-party dependency licenses, provider terms and transfer documentation.

## Sale principle

Do not market accuracy, profitability, production readiness, or provider coverage without evidence. Keep an explicit list of known limitations and deliverable assets for the buyer.
