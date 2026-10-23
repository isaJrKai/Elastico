# Elastico Production-Readiness Audit

**Status:** In progress — do not deploy or merge as production-ready yet.  
**Working branch:** `production-readiness/hardening`  
**Review method:** Static source/configuration inspection plus CI-driven remediation. On commit `553a7ef95487f9aa2887dc76eb588f4181aece54`, clean install, typecheck, lint, tests, Next.js production build, Docker image build, fresh PostgreSQL 17 migration check, and production-only dependency audit passed. The full toolchain audit remains red for 8 high findings. No penetration test or live deployment verification has been performed.

## Executive summary

The repository had multiple release-blocking security and data-integrity defects. The working branch contains initial mitigations, but several operational and product-truth issues remain open. This document distinguishes source changes from verified runtime outcomes.

## Critical findings

| ID | Finding | Evidence | Current branch status |
|---|---|---|---|
| C-01 | A live-looking PostgreSQL connection string with credentials was hardcoded in multiple tracked root scripts and an audit artifact. | `scripts/cycle45-*.js`, `scripts/cycle46-*.js`, `scripts/fix-dupes.ts`, `scripts/seed-neon.ts`, `download/phase6_product_truth_audit.md` | Credential literals removed from these current-branch files. **Provider-side rotation and Git-history cleanup remain mandatory.** |
| C-02 | Unauthenticated demo authentication allowed a caller to request an administrator role and could create an administrator account. | `src/app/api/auth/demo/route.ts` | Endpoint now returns 404; demo-login controls removed from the login UI. |
| C-03 | Cron sync accepted a hardcoded fallback secret and `?force=true` bypassed authorization. | `src/app/api/cron/sync/route.ts`, `src/lib/cron-auth.ts` | Fallback and query bypass removed. Vercel Bearer and internal secret headers are validated; route-level regression test added. |
| C-04 | Authenticated requests could fall back to JWT claims when the database lookup failed. | `src/lib/auth.ts` | Fail-open fallback removed; protected requests fail closed. |
| C-05 | A stochastic match simulation could mark real user predictions correct/incorrect and update streaks/accuracy using simulated scores. | `src/app/api/matches/[id]/simulate/route.ts` | Simulation no longer settles predictions; response is explicitly labelled illustrative. |

## High-priority security findings

| ID | Finding | Current branch status |
|---|---|---|
| S-01 | Login/register and authenticated-user responses returned database fields beyond the public profile. | Explicit `toPublicUser` allowlist added. |
| S-02 | Admin authorization could rely on stale JWT role claims. | Current database role is checked. |
| S-03 | Admin routes did not share the new session-revocation check. | `requireAdmin` now validates the hashed database session and expiry. |
| S-04 | Tokens had no persistent session record or server-side revocation path. | Hashed token sessions added at login/register and a logout endpoint added. Requires runtime verification. |
| S-05 | Environment diagnostics were public and exposed secret prefixes and lengths. | Admin authorization added; secret prefixes removed. |
| S-06 | A stored 2FA flag was not enforced at login and no complete verification flow exists. | Login now fails closed when 2FA is enabled. **Actual enrolment/challenge/recovery flow remains unimplemented.** |
| S-07 | Browser bearer tokens were stored in `localStorage`, increasing impact if an XSS path is found. | UI now uses HttpOnly session cookies with origin checks and server-side session revocation; no localStorage token write remains in the login flow. Browser/XSS verification is still required. |
| S-08 | Rate limiting is an in-memory `Map`, not shared across instances or restarts. Client IP extraction depends on trusted proxy behavior. | Open: use a shared production limiter and document trusted proxy configuration. |
| S-09 | Authentication/session lifecycle needs broader tests, including account disable, role downgrade, logout, expiry, and DB outage. | Auth, cron, and database-target regression tests pass in CI; broader lifecycle/DB-outage coverage remains open. |
| S-10 | Several authenticated screens were still gated on an in-memory bearer token; cookie-only login sets that token to null, breaking predictions, bookmarks, match actions, chat, and exports. | `src/components/elastico/{match-detail-view,predictions-view,chat-view,export-view,player-view,settings-view,prediction-engine-view}.tsx` | Fixed in branch: use the HttpOnly session cookie, gate actions on the signed-in user, remove stale bearer headers, and clear legacy localStorage credentials. Browser verification remains open. |

## Data integrity and product truth

| ID | Finding | Evidence / action |
|---|---|---|
| D-01 | Match score fields are non-null integers defaulting to zero, while provider responses can omit goals for upcoming matches. Sync adapters also use `?? 0`. Missing scores can be misrepresented as 0–0. | Open: schema/migration change to represent missing scores as null, then update adapters, APIs, and UI empty states. |
| D-02 | Team API falls back to zero wins/draws/losses/goals and may use a default ELO value when source statistics are absent. | Open: propagate missingness and provenance instead of fabricating zeros/default ratings. |
| D-03 | Admin dashboard returned hardcoded zero values for unavailable operational metrics and estimated revenue from plan labels. | Current branch returns unavailable values instead; prediction-accuracy display no longer derives a percentage from an unrelated error-rate placeholder. |
| D-04 | Admin sync/clear-events actions reported success despite doing no work. | Current branch returns an explicit unavailable response instead of false success. |
| D-05 | Achievement reads generated a fresh timestamp for every unlocked achievement despite no timestamp being stored. | Current branch no longer invents unlock timestamps. |
| D-06 | Prediction submissions accepted client-selected outcomes and model labels without checking score consistency. | Current branch validates payloads, enforces score/outcome consistency, labels client submissions as user predictions, and checks free-plan quota in a serializable transaction. Runtime/DB testing remains open. |
| D-07 | Some advanced analytics, simulation, and derived metrics need view-by-view verification that labels match the actual computation and source quality. | Open: complete product-truth audit across every screen and API. |
| D-08 | The forecast endpoint generated pseudo-ELO values from team-name hashes for unknown teams and used a manually curated team-prior map without calibration evidence. | Hash-based fallback removed; unknown teams are omitted. Outputs and UI now disclose that the remaining prior-map probabilities are experimental and uncalibrated. Replacing priors with a sourced ratings pipeline and backtesting remains a release blocker. |
| D-09 | The prediction-engine simulator silently supplied default ELO, odds, goals-conceded, and bankroll values. | UI defaults removed; manual values are required and bounded at the API. ELO/odds provenance and model calibration still require validation. |
| D-10 | Advanced-analytics descriptions made unsupported quantitative claims, and its compute endpoint was unauthenticated. | Unsupported empirical claims replaced with experimental/unvalidated language; endpoint now requires authentication and rate-limits by user.

## Build, deployment, and operations

| ID | Finding | Current branch status |
|---|---|---|
| O-01 | Docker expected standalone output without enabling it in Next configuration. | `output: 'standalone'` enabled; Next.js production build and Docker image build passed in CI. Runtime container smoke test remains open. |
| O-02 | Docker/Caddy used incompatible listener/upstream settings. | Compose now routes Caddy to the app service and requires a domain for HTTPS; not yet deployed. |
| O-03 | Compose configured SQLite while the Prisma schema is PostgreSQL-only. | Compose now provisions PostgreSQL. |
| O-04 | Production migration history/baseline was missing. | Initial migration generated from the checked-in schema and applied successfully to a disposable PostgreSQL 17 database in CI. Existing-database schema comparison, baseline, backup/restore, and rollback rehearsal remain release blockers. Do not use `prisma db push` as the production release process. |
| O-05 | No trustworthy automated verification gate was evident at audit start. | GitHub Actions now checks clean installs, production/full dependency audits, typecheck, lint, tests, production build, Docker image build, and a fresh-database migration. All except the full toolchain dependency audit passed on the latest completed run. |
| F-01 | Login page used an admin-only announcements endpoint and expected `message` while the stored field is `content`, so public announcements could silently disappear. | `src/app/api/announcements/route.ts`, `src/lib/public-announcements.ts` | Fixed: public read-only endpoint exposes only active, unexpired `targetRole=all` announcements and maps content to the UI shape. Serializer regression test added. |
| O-08 | The checked-in `package-lock.json` was inconsistent with `package.json`; clean install failed. CI also warned that `kysely@0.29.5` requires Node 22 while the workflow originally used Node 20. | Resolved on the hardening branch: lockfile regenerated, Node 22 used, and clean `npm ci --legacy-peer-deps` passes. |
| O-06 | Archived code and research artifacts enlarged and confused the Docker build context. | `.dockerignore` added; full repository hygiene and history review remain open. |
| O-07 | Production startup, health checks, backup/restore, observability, and rollback have not been proven end to end. | Open. |

## Immediate operator actions

1. Rotate the exposed database credential at the database provider now. Do not wait for this branch to merge.
2. Review provider access logs and database activity for unexpected access since the credential was exposed.
3. After rotation, update all deployment environments and verify that no old credential remains active.
4. Plan a controlled Git-history cleanup. A branch-level deletion does not erase secrets from previous commits or forks.
5. Keep this pull request in draft until the build, tests, migrations, and remaining audit gates are complete.

## Release gates still required

- [x] Regenerate and review `package-lock.json`; verify clean `npm ci --legacy-peer-deps`.
- [x] Add an initial Prisma migration and verify it applies to a disposable PostgreSQL 17 database.
- [x] Add fail-closed cron authentication and explicit database mutation guards.
- [ ] Resolve or explicitly risk-accept the 8 high findings in the full development-toolchain audit; production-only dependency audit currently passes.
- [ ] Rotate the exposed Neon credential and complete a deliberate repository-history cleanup.
- [ ] Compare the existing database schema to `prisma/schema.prisma`, take/verify a backup, and baseline the initial migration without applying its SQL.
- [ ] Complete security tests for account disable, role downgrade, logout, expiry, DB outage, rate limits, and all protected routes.
- [ ] Complete route-by-route authorization/input validation and the full data-source/provenance review.
- [ ] Complete UI/UX verification for loading, empty, error, stale, unavailable, and success states.
- [ ] Run the Docker container against a clean database and verify health/authenticated journeys; test the real deployment and TLS.
- [ ] Rehearse off-site backup/restore and rollback.
- [ ] Perform live production verification only after the preceding gates are closed.

**No production deployment has been performed.**

## Latest verification — 2026-10-23

- Exact-head CI run: [39912024713](https://github.com/isaJrKai/Elastico/actions/runs/39912024713), code commit `553a7ef95487f9aa2887dc76eb588f4181aece54`.
- Passed: clean lockfile install; production-only dependency audit; typecheck; lint; tests (including cron force-bypass, database-target guard, and public-announcement serializer regression tests); Next.js production build; Docker image build; fresh PostgreSQL 17 migration apply/status check.
- Failed: full dependency audit, with 8 high findings across two toolchain advisories: `braces` through Next ESLint tooling (no upstream patch reported) and `deepmerge-ts` through the Prisma CLI (the suggested Prisma fix is a major-version migration). Do not force a downgrade or upgrade without a separate tested migration.
- Cookie-session auth is now wired through match actions, predictions, chat, player data, exports, settings, and the prediction engine. The login page uses a separate public allowlisted announcements endpoint.
- The initial migration has only been tested against a disposable database. Existing production schema baseline remains unverified.
- The draft hardening branch has not been merged or deployed. No production database was accessed or modified.
