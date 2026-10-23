# Elastico production-readiness gates

This checklist is a release contract, not a claim that the application currently passes.

## Release blockers

- [ ] Production app loads from a clean browser session and authenticated session.
- [ ] Every primary navigation destination renders without uncaught client errors.
- [ ] All API routes have an explicit auth policy, input schema, timeout, and failure response.
- [ ] No public/default cron secret or fallback credential is accepted.
- [ ] No fabricated fixture labels, scores, odds, injuries, xG, or model confidence is presented as real.
- [ ] Prediction routes report data source, data timestamp, model version, supported markets, and uncertainty.
- [ ] Unsupported teams and stale/incomplete fixtures are withheld with an explicit reason.
- [ ] Every statistical model has repeatable tests and an out-of-sample evaluation report.
- [ ] Predictions are compared to bookmaker-implied baselines with overround removed where possible.
- [ ] Calibration (Brier score, log loss, reliability curve) is reported by league and market.
- [ ] Time-based evaluation prevents future information leaking into features.
- [ ] Production database migration and backup/restore procedures are documented and tested.
- [ ] Dependency and secret scans run in CI.
- [ ] Accessibility, keyboard navigation, responsive layouts, empty states and error states are reviewed.
- [ ] A release candidate is deployed to staging and smoke-tested before production.
- [ ] Known limitations, data-provider licenses, and third-party dependencies are documented for a buyer.

## Quality-gate status

**Status: NOT VERIFIED.** Adding this checklist or a CI workflow does not mean any gate has passed. Record links to CI runs, evaluation reports, and staging checks as evidence.

## Minimum prediction acceptance criteria

1. All probabilities are finite, within [0, 1], and mutually coherent for the market.
2. The 1X2 probabilities sum to 1 within a documented numerical tolerance.
3. A model is not promoted based on training accuracy alone.
4. Baselines include bookmaker odds and a simple historical/league-average model.
5. Model evaluation uses a chronologically later test period not used for tuning.
6. Calibration and uncertainty are evaluated, not only accuracy.
7. When data is missing, stale, or mismatched, the product abstains rather than inventing an answer.
8. All recommendations are labelled as estimates, never guarantees.

## UI acceptance criteria

- [ ] Visual hierarchy is deliberate and consistent; avoid decorative cards with no analytical purpose.
- [ ] Tables and match comparisons remain usable at narrow widths.
- [ ] Loading, no-data, stale-data, partial-data and API-failure states are distinct.
- [ ] Every number has a unit, source, timestamp or definition where appropriate.
- [ ] Charts include labels and accessible alternatives.
- [ ] Demo/sample data is clearly marked and cannot be confused with live data.
