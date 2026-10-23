# Elastico

Elastico is a football data and analytics application built with Next.js, TypeScript, Prisma and PostgreSQL. It combines fixture/score integrations, team comparisons, statistical models, an AI evidence assistant, and exploratory analytical formulas.

> **Current validation status:** This repository is under a production-readiness rebuild. The statistical engines and advanced formulas are not yet validated as accurate match-prediction models. Do not treat outputs as guaranteed outcomes or as evidence of betting profitability. See the production-readiness audit in `docs/PRODUCTION_READINESS_AUDIT_2026-10-24.md`.

## What is in the repository

- `src/app/`: Next.js App Router pages and API routes.
- `src/components/elastico/`: application views and shared football UI.
- `src/lib/predictions.ts`: ELO, Poisson and Dixon–Coles statistical helpers.
- `src/lib/prediction-engine.ts`: stochastic simulation and bankroll-analysis utilities.
- `src/lib/advanced-analytics-engine.ts`: experimental heuristic formulas; not empirically validated.
- `src/lib/evidence-builder.ts`: evidence retrieval for AI-assisted analysis.
- `src/lib/football-data.ts`, `src/lib/football-data-org.ts`, `src/lib/api-sports.ts`: data-provider integrations.
- `prisma/schema.prisma`: PostgreSQL data model.
- `scripts/phase3_train_models.py`: experimental ML training pipeline. Its existence does not imply that production predictions use the trained artifacts.
- `docs/`: release criteria and audit notes.

## Requirements

- Node.js 22+
- npm
- PostgreSQL-compatible database (the project documents Neon/Postgres configuration)
- API keys for whichever data providers you enable

## Local setup

1. Install dependencies:

   ```bash
   npm install
   ```

   The committed npm lockfile is currently being reconciled. Until the repair is committed and a strict clean install is verified, a reproducible `npm ci` cannot be claimed.

2. Create `.env` from `.env.example` and configure at least:

   - `DATABASE_URL`
   - `DIRECT_URL` (for Prisma operations that require a direct connection)
   - `JWT_SECRET` (use a random secret of at least 32 characters)
   - `CRON_SECRET` (use a separate random secret of at least 32 characters)

3. Generate the Prisma client:

   ```bash
   npx prisma generate
   ```

4. Start the development server:

   ```bash
   npm run dev
   ```

5. Run checks:

   ```bash
   npm test
   npm run lint
   npx tsc --noEmit
   npm run build
   ```

The CI workflow reconciles the npm lockfile in the runner before installing dependencies. This is temporary diagnostic behaviour, not the final reproducible-install gate. The release blocker is to commit the reconciled lockfile and restore strict `npm ci`.

## Environment variables

See `.env.example` for provider keys and optional AI integrations. Do not commit real credentials. Set production values through the hosting platform's secret manager.

The demo seed script refuses to run when `NODE_ENV=production`. Demo users are disabled unless `SEED_DEMO_USERS=true` is set in a non-production environment and all `SEED_*_EMAIL` / `SEED_*_PASSWORD` values are supplied. Demo passwords must be at least 20 characters.

## Data and model honesty

- Missing or unsupported data should be shown as unavailable, not replaced with invented match statistics.
- Static team offsets are not dynamically updated ELO ratings.
- A Monte Carlo simulation is a synthetic scenario, not an actual match result.
- Advanced analytics are marked experimental until they are validated against historical outcomes.
- Prediction quality must be demonstrated with chronological out-of-sample tests, bookmaker/no-skill baselines, log loss, Brier score and calibration reports.

## Release status

The production-readiness rebuild is tracked in draft pull requests and GitHub issue #14. Do not deploy the integration candidate to production until all release blockers are resolved and staging smoke tests pass.
