# Elastico Production Readiness Audit

Status: **IN PROGRESS — NOT APPROVED FOR PRODUCTION**
Branch: `integration/release-candidate-03`
Scope: End-to-end behavior, data provenance, prediction correctness, UI/UX, security, persistence, external integrations, operational deployment.

## Release rule

A feature is only marked **PASS** after the real user journey and its backend/data path are verified. A successful TypeScript build or HTTP 200 alone is not proof that a feature works. Never represent placeholders, simulations, priors, synthetic values, or unvalidated forecasts as real observations.

## Confirmed findings and fixes

| ID | Severity | Area | Finding | Action/status |
|---|---|---|---|---|
| PRED-001 | P1 | Stochastic prediction API | `simulation-only` mode still required bookmaker odds and bankroll before checking the mode, making probability-only simulation unusable. | Fixed in candidate: mode-specific validation; UI now sends simulation-only when all market fields are blank. Needs CI/runtime verification. |
| PRED-002 | P1 | Prediction mathematics | Full analysis invented observed goals as `xG * 1.1` for home and `xG * 0.9` for away, then described that as a luck adjustment. | Fixed in candidate: only use observed goals when explicitly supplied; otherwise keep xG unchanged. |
| PRED-003 | P1 | Market analysis | The engine derived over/under odds by multiplying home-win odds by 0.9/1.1. These are different markets. | Fixed in candidate: Kelly outputs only cover the supplied 1X2 odds; no proxy total-market odds. |
| PRED-004 | P1 | Main predictions endpoint | Dixon–Coles was called with expected goals in parameters that represent score-grid bounds and with arbitrary fixed attack/defence values. | Fixed in candidate: new `dixonColesFromExpectedGoals` takes goal intensities directly; compute route uses it. Needs CI and test verification. |
| PRED-005 | P1 | Prediction inputs | Goals-conceded inputs were required by the stochastic UI but ignored by its expected-goals calculation. | Fixed in candidate: opponent goals-conceded rate now contributes a clamped defensive modifier. This is an explicit heuristic, not a trained calibration. |
| PRED-006 | P1 | Prediction API validation | Optional historical values, correlations and injury payloads were not sufficiently validated. | Fixed in candidate: bounded validation added. Needs CI/runtime verification. |
| PRED-007 | P1 | Prediction quality | Main predictions use manually curated team-rating priors; response labels forecasts `UNVALIDATED_HEURISTIC` and `calibrated: false`. | OPEN: obtain a reliable, versioned rating/history source and run out-of-sample backtests before describing forecasts as validated. |
| PRED-008 | P1 | Prediction Engine UI | Core xG/ELO inputs are manual when trustworthy source data is absent; no complete match-input pipeline exists yet. | PARTIAL: xG auto-fills only when source class is REAL/DERIVED; goals-conceded rates derive from standings when possible; ELO remains explicitly manual. Build the canonical match-to-input pipeline next. |
| PRED-009 | P1 | Model validation | No current evidence yet of a reproducible held-out backtest for the production prediction path. | OPEN: create dataset/version manifest, time-based train/test split, calibration metrics (log loss, Brier, reliability), and baseline comparisons. |
| PRED-010 | P1 | ELO updates | `calculateElo` previously assumed a home win when returning post-match ratings, even when no result was known. | Fixed in candidate: ratings remain unchanged for a forecast; update only when an actual outcome is explicitly provided. Unit test added. |
| PRED-011 | P1 | Training data licensing | The candidate Hugging Face dataset declares CC BY 4.0, but its stated upstream sources include football-data.co.uk, whose site states its data is intended for private individuals and not commercial data-training products. | BLOCKED for commercial training/use until rights and upstream terms are confirmed. Do not ship a model trained on this data based only on the dataset-card license. |
| PRED-012 | P1 | Trained model pipeline | A reproducible chronological training/evaluation script and manual GitHub Actions workflow have been added. No trained artifact or measured result exists yet. | OPEN: run the workflow for research evaluation only, inspect metrics/schema/coverage, resolve data rights, then implement and test live inference with explicit team-name mapping. |

## Additional cross-feature audit findings

| ID | Severity | Area | Finding | Action/status |
|---|---|---|---|---|
| DATA-001 | P1 | Match export | ESPN fallback previously converted unknown scores to 0, which could falsely export an upcoming fixture as 0–0. | Fixed in candidate: unknown scores remain blank. |
| SEC-001 | P1 | CSV export | Exported untrusted strings were not protected against spreadsheet formula injection. | Fixed in candidate: string cells beginning with formula-like prefixes are neutralized and CSV escaping handles CR/LF. Needs automated tests. |
| FEAT-001 | P2 | Social/community | `SocialView` is a deliberate feature stub; discussions, sharing, profiles and trending topics are not implemented. | OPEN: keep visibly marked as under development or implement persistence/API before marketing the feature. |
| FEAT-002 | P2 | Scheduled reports/export UI | Scheduled report automation and bulk export are explicitly marked coming soon. Export API currently exports at most 500 records per category and does not apply meaningful filters. | OPEN: either finish and test scheduled/bulk exports or remove/disable unsupported controls and disclose limits. |
| FEAT-003 | P2 | Admin operations | Some admin actions return HTTP 501 because no persistent operation exists. Operational metrics such as API calls, error rate and revenue are correctly returned as unknown/null rather than invented. | PARTIAL: no false metrics; remaining actions need implementation or visibly disabled controls. |
| SIM-001 | P2 | Match simulator | `/api/matches/[id]/simulate` intentionally creates synthetic scores, events, xG and possession. The API marks the output `simulationOnly` and disclaims that the values are synthetic. | VERIFY UI: keep the synthetic/illustrative label visible wherever this output is rendered; never feed simulated results into prediction accuracy or match history. |
| AI-001 | P2 | AI chat | With no provider key, the API returns an explicit no-provider response rather than pretending an LLM ran. | CONFIGURATION REQUIRED: set a valid provider key and test failover before selling AI analysis as active. |

## Training pipeline added

- `ml/train_match_model.py`: chronological feature construction from prior results, multinomial logistic regression, held-out metrics (accuracy, log loss, multiclass Brier), final model coefficients and latest team-state export.
- `ml/requirements.txt` and `ml/README.md`: reproducible setup and evaluation gates.
- `.github/workflows/train-prediction-model.yml`: manual-only training run that uploads candidate model/evaluation artifacts for 14 days; it does not deploy or commit a model.
- This is research infrastructure only. It has not been executed or independently validated yet, and the current dataset's commercial rights need resolution before production use.

## Deployment status at last check

- Vercel team access was authorized by the user.
- Latest ready preview deployment observed: commit `7138db3639b257fa9aef08b2de7593eedb88d75d`.
- Latest candidate code commit checked: `5b9589fa31cee1f04263c79d399b5c2b6e66ecf0`; it is newer than the ready preview.
- The fixes listed above are newer than that deployment and are **not yet verified in the running preview**.
- Vercel status checks for the candidate still report `upgradeToPro=build-rate-limit`; this blocks reliable automatic preview updates. Do not promote or merge to production to work around it.
- Added unit tests for stochastic probability normalization, observed-goal provenance, 1X2-only Kelly outputs, Dixon–Coles score-grid normalization/symmetry, and ELO updates.
- GitHub production-readiness and dependency-remediation runs remain pending with no jobs reported at the last check. No green result has been claimed for the latest fixes.

## Required end-to-end audit matrix

Every row remains **NOT VERIFIED** until exercised against the current candidate with evidence.

- [ ] Authentication: register/login/logout/session expiry/password reset/role boundaries
- [ ] Match data: source freshness, normalization, missing values, duplicates, status handling
- [ ] Live scores: current status/minute/events and provider outage behavior
- [ ] Predictions: upcoming-fixture filtering, model inputs, normalized probabilities, errors and empty states
- [ ] Save/edit prediction: persistence, quota, duplicate submission, kickoff/status enforcement
- [ ] Leaderboard: source query, ranking logic, ties and empty state
- [ ] Prediction Engine: probability-only mode, full 1X2 analysis, invalid inputs, injury overlay and Kelly guard
- [ ] Team compare/tactical/player views: every metric source verified; no invented or silently substituted values
- [ ] AI chat: provider failover, explicit fallback labeling, no fabricated source claims
- [ ] Admin: metrics from persisted/real data, mutations persist, permission checks, no false success states
- [ ] News/social/notifications: actual provider or persisted data, empty/error states, actions work
- [ ] Settings/profile/subscription: persistence, auth, plan enforcement and billing state
- [ ] Export: valid, complete data and correct file format
- [ ] Responsive UI: 320–1440px, keyboard, contrast, typography, dark/light themes and reduced motion
- [ ] Security: authorization, rate limits, request validation, secrets, headers, dependency audit
- [ ] Operations: migrations, backup/restore evidence, logs, health checks, preview smoke test and rollback proof

## Evidence policy

For each fix, record commit, tests executed, result, and remaining limitation. If a route cannot be exercised because Vercel cannot build the candidate, mark it **BLOCKED**, not **PASS**. No production promotion until all P0/P1 items are closed and prediction quality is honestly described.
