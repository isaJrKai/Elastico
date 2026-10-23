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
| D-08 | The forecast endpoint generated pseudo-ELO values from team-name hashes for unknown teams and used a manually curated team-prior map without calibration evidence. | Hash-based fallback removed; unknown teams are omitted. Outputs and UI now disclose that the remaining prior-map probabilities are experimental and uncalibrated. Replacing priors with a sourced ratings pipeline and backtesting remains a release blocker. |
| D-09 | The prediction-engine simulator silently supplied default ELO, odds, goals-conceded, and bankroll values. | UI defaults removed; manual values are required and bounded at the API. ELO/odds provenance and model calibration still require validation. |
| D-10 | Advanced-analytics descriptions made unsupported quantitative claims, and its compute endpoint was unauthenticated. | Unsupported empirical claims replaced with experimental/unvalidated language; endpoint now requires authentication and rate-limits by user.

## Build, deployment, and operations

| ID | Finding | Current branch status |
|---|---|---|
| O-01 | Docker expected standalone output without enabling it in Next configuration. | `output: 'standalone'` enabled and build script runs `prisma generate`; not yet built in CI. |
| O-02 | Docker/Caddy used incompatible listener/upstream settings. | Compose now routes Caddy to the app service and requires a domain for HTTPS; not yet deployed. |
| O-03 | Compose configured SQLite while the Prisma schema is PostgreSQL-only. | Compose now provisions PostgreSQL. |
| O-04 | Production migration history/baseline is missing or not evident. | Open release blocker: create and validate a migration strategy against both fresh and existing databases. Do not use `prisma db push` as the production release process. |
| O-05 | No trustworthy automated verification gate was evident at audit start. | Initial GitHub Actions workflow, typecheck/lint/test scripts, and auth-focused tests added. **First CI run failed before tests at `npm ci` because the lockfile is out of sync.** |
| O-08 | The checked-in `package-lock.json` is inconsistent with `package.json`; clean install fails. CI also warned that `kysely@0.29.5` requires Node 22 while the workflow originally used Node 20. | Workflow and Docker base image moved to Node 22. Lockfile still needs regeneration and review; no tests/build have run yet. |
| O-06 | Archived code and research artifacts enlarged and confused the Docker build context. | `.dockerignore` added; full repository hygiene and history review remain open. |
| O-07 | Production startup, health checks, backup/restore, observability, and rollback have not been proven end to end. | Open. |

## Immediate operator actions

1. Rotate the exposed database credential at the database provider now. Do not wait for this branch to merge.
2. Review provider access logs and database activity for unexpected access since the credential was exposed.
3. After rotation, update all deployment environments and verify that no old credential remains active.
4. Plan a controlled Git-history cleanup. A branch-level deletion does not erase secrets from previous commits or forks.
5. Keep this pull request in draft until the build, tests, migrations, and remaining audit gates are complete.

## Release gates still required

- [ ] Regenerate and review `package-lock.json`; verify `npm ci` succeeds cleanly.\n- [ ] CI green: install, dependency audit, Prisma generation, TypeScript, lint, tests, production build.
- [ ] Database migration baseline and rollback strategy validated.
- [ ] Security tests for auth, admin, session expiry/revocation, malformed inputs, rate limits, and environment endpoints.
- [ ] Full route-by-route authorization and input-validation review.
- [ ] Full data-source/provenance review for fixtures, scores, odds, standings, xG, predictions, and achievements.
- [ ] UI/UX pass for loading, empty, error, stale, unavailable, and success states.
- [ ] Docker Compose smoke test against a clean PostgreSQL database and real domain/TLS.
- [ ] Backup/restore and rollback rehearsed.
- [ ] Provider credential rotation and history cleanup complete.

**No production deployment has been performed.**

## Follow-up verification — 2026-10-23

- A one-time lockfile refresh on the hardening branch regenerated `package-lock.json` from the current `package.json` and applied compatible, non-major advisory fixes. The refresh job completed successfully; its full dependency audit summary still reported **8 high-severity findings**, so dependency remediation remains open.
- The prior CI attempt passed typecheck, lint, and the existing test suite. Its clean-install gate was checking the pre-refresh lockfile; the refreshed lockfile still needs a fresh `npm ci` result on the new branch head.
- Docker image creation previously failed while compiling the native `canvas` dependency because the Alpine build stage lacked Python/build and graphics development packages. The Docker build stage now installs those build prerequisites; the new image build must still pass before this can be considered fixed.
- No production deployment or production database operation was performed. Do not merge this draft or label the app production-ready until exact-head CI passes and the remaining audit findings are triaged.

## Follow-up verification — 2026-10-23, second pass

- The committed npm lockfile has now been regenerated after the dependency-manifest cleanup. The first fresh run after regeneration passed `npm ci --legacy-peer-deps`; a new exact-head run is required after the latest dependency-classification commit.
- The full dependency audit still reports 8 high findings across two root advisories:
  - `braces` GHSA-vfj7-8cjw-p6xm, reached through Next ESLint tooling. Upstream currently has no patched release; do not force-downgrade Next to clear the report.
  - `deepmerge-ts` GHSA-ggr8-5vv4-36mx, reached through the Prisma CLI. Its patched version is 8.0.0, while npm's suggested fix upgrades Prisma to 7.10.1 (a major-version migration). The Prisma CLI has been moved to `devDependencies`; `@prisma/client` remains a runtime dependency. The new CI workflow separately gates the production dependency graph and retains the full toolchain audit as a visible check.
- The refreshed lint toolchain surfaced 18 `react-hooks/set-state-in-effect` findings in existing UI effects. The rule is currently warnings—not disabled—because it flags both synchronous derived-state patterns and legitimate asynchronous data-fetch/subscription handlers. These warnings remain visible and need a targeted UI refactor before claiming a clean lint baseline.
- The Docker build stage now installs native prerequisites for the build-time `canvas` package. Compose now forwards the configured sports/news data-provider keys and uses the same `GITHUB_TOKEN` name as the AI gateway.
- These changes are on the draft hardening branch only. Production secrets have not been rotated, no production database was accessed, and no deployment occurred.
