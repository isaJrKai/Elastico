# Elastico Production-Readiness Audit

**Status:** In progress — do not deploy or merge as production-ready yet.  
**Working branch:** `production-readiness/hardening`  
**Review method:** Static source/configuration inspection plus targeted remediation. A full build, automated suite, penetration test, and live deployment verification have not yet been completed.

## Executive summary

The repository had multiple release-blocking security and data-integrity defects. The working branch contains initial mitigations, but several operational and product-truth issues remain open. This document distinguishes source changes from verified runtime outcomes.

## Critical findings

| ID | Finding | Evidence | Current branch status |
|---|---|---|---|
| C-01 | A live-looking PostgreSQL connection string with credentials was hardcoded in multiple tracked root scripts and an audit artifact. | `scripts/cycle45-*.js`, `scripts/cycle46-*.js`, `scripts/fix-dupes.ts`, `scripts/seed-neon.ts`, `download/phase6_product_truth_audit.md` | Credential literals removed from these current-branch files. **Provider-side rotation and Git-history cleanup remain mandatory.** |
| C-02 | Unauthenticated demo authentication allowed a caller to request an administrator role and could create an administrator account. | `src/app/api/auth/demo/route.ts` | Endpoint now returns 404; demo-login controls removed from the login UI. |
| C-03 | Cron sync accepted a hardcoded fallback secret. | `src/app/api/cron/sync/route.ts` | Fallback removed; missing/short secret fails closed. |
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
| S-07 | Browser bearer tokens are stored in `localStorage`, increasing impact if an XSS path is found. | Open: migrate to secure HttpOnly cookies with CSRF/origin protections and audit rendering paths. |
| S-08 | Rate limiting is an in-memory `Map`, not shared across instances or restarts. Client IP extraction depends on trusted proxy behavior. | Open: use a shared production limiter and document trusted proxy configuration. |
| S-09 | Authentication/session lifecycle needs broader tests, including account disable, role downgrade, logout, expiry, and DB outage. | Basic tests and CI gates added; not yet run successfully. |

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

## Build, deployment, and operations

| ID | Finding | Current branch status |
|---|---|---|
| O-01 | Docker expected standalone output without enabling it in Next configuration. | `output: 'standalone'` enabled and build script runs `prisma generate`; not yet built in CI. |
| O-02 | Docker/Caddy used incompatible listener/upstream settings. | Compose now routes Caddy to the app service and requires a domain for HTTPS; not yet deployed. |
| O-03 | Compose configured SQLite while the Prisma schema is PostgreSQL-only. | Compose now provisions PostgreSQL. |
| O-04 | Production migration history/baseline is missing or not evident. | Open release blocker: create and validate a migration strategy against both fresh and existing databases. Do not use `prisma db push` as the production release process. |
| O-05 | No trustworthy automated verification gate was evident at audit start. | Initial GitHub Actions workflow, typecheck/lint/test scripts, and auth-focused tests added. Workflow results are not yet confirmed. |
| O-06 | Archived code and research artifacts enlarged and confused the Docker build context. | `.dockerignore` added; full repository hygiene and history review remain open. |
| O-07 | Production startup, health checks, backup/restore, observability, and rollback have not been proven end to end. | Open. |

## Immediate operator actions

1. Rotate the exposed database credential at the database provider now. Do not wait for this branch to merge.
2. Review provider access logs and database activity for unexpected access since the credential was exposed.
3. After rotation, update all deployment environments and verify that no old credential remains active.
4. Plan a controlled Git-history cleanup. A branch-level deletion does not erase secrets from previous commits or forks.
5. Keep this pull request in draft until the build, tests, migrations, and remaining audit gates are complete.

## Release gates still required

- [ ] CI green: install, Prisma generation, TypeScript, lint, tests, production build.
- [ ] Database migration baseline and rollback strategy validated.
- [ ] Security tests for auth, admin, session expiry/revocation, malformed inputs, rate limits, and environment endpoints.
- [ ] Full route-by-route authorization and input-validation review.
- [ ] Full data-source/provenance review for fixtures, scores, odds, standings, xG, predictions, and achievements.
- [ ] UI/UX pass for loading, empty, error, stale, unavailable, and success states.
- [ ] Docker Compose smoke test against a clean PostgreSQL database and real domain/TLS.
- [ ] Backup/restore and rollback rehearsed.
- [ ] Provider credential rotation and history cleanup complete.

**No production deployment has been performed.**
