# Longitudinal team history for Elastico predictions

## Product principle

A team's past is useful evidence about its future, but it is not destiny. Elastico should estimate the strength and uncertainty implied by historical results, then update that estimate as new evidence arrives. Historical features must be calculated only from information available before the kickoff being predicted.

## Feature families

### 1. Long-term strength
- Elo-style team rating updated match-by-match across seasons.
- Season-to-season rating carryover: retain some prior strength, but regress toward the competition mean to avoid treating an old squad as unchanged.
- League-relative points, goal difference and goals-for/against rates per match.
- Promotion/relegation and league changes represented explicitly; do not compare raw records across divisions as if the competition strength were identical.

### 2. Form at multiple horizons
Calculate separate features for approximately the last 5, 10 and 20 matches, alongside season-to-date and multi-season summaries:
- points per match and win/draw/loss rates;
- goals scored and conceded per match;
- goal difference;
- clean-sheet and failed-to-score rates;
- home-only and away-only performance.
Use shrinkage toward league averages for small samples, rather than trusting a short streak as a stable estimate.

### 3. Home/away and matchup context
- Home and away strength separately.
- Head-to-head results as a low-weight, sample-size-aware feature only when relevant historical matches exist.
- Rest days, fixture congestion and competition context when reliable data is available.
- Team identity aliases and club continuity need careful handling; renamed, promoted, reserve and re-formed clubs must not be silently conflated.

### 4. Change and uncertainty
- Measure whether recent performance differs materially from a team's longer-term baseline.
- Track the amount and age of evidence available for each team.
- When data is sparse, newly promoted, or from a different league, widen uncertainty and shrink predictions toward a calibrated league prior.
- Avoid pretending that public match results reveal unobserved causes such as injuries, transfers or lineup quality. Add those only when a reliable, timestamped source is available.

## Evaluation design

1. Sort by kickoff date and predict each match using strictly earlier matches only.
2. Keep entire later time periods as holdouts; tune features and hyperparameters only on earlier periods.
3. Compare, on the same scored matches:
   - smoothed league-frequency baseline;
   - current short-window Elo/goal-rate baselines;
   - longitudinal Elo with season carryover;
   - multi-horizon history model;
   - blend only if it improves out-of-sample performance.
4. Report log loss and multiclass Brier score as primary probability-quality metrics; include calibration by probability bucket, accuracy, coverage and results by league/season. Do not optimize accuracy alone.
5. Report confidence intervals or season-to-season variation. Do not claim a model is better from a tiny sample or one favourable season.
6. Compare with bookmaker odds only where properly licensed, timestamped odds data exists; no profitability claim without a separate, realistic backtest accounting for odds availability, margins, stake sizing and costs.

## Data and leakage safeguards

- Each source snapshot must record its upstream commit/revision, retrieval date, licence, file SHA-256 and parsing counts.
- Distinguish completed scored matches from scheduled fixtures and malformed rows.
- Never use final season tables, end-of-season standings, or future-season information when generating an earlier prediction.
- Keep team aliases and competition identifiers in versioned mappings so data corrections are reviewable.
- Treat missing history as an explicit data-quality state, not as evidence that a team has average strength.
- Any feature used by production inference must have tests proving it changes only when valid prior data changes and never reads future matches.

## Rollout gates

The current evaluator is a baseline harness, not proof that these longitudinal features are implemented or profitable. Implement these feature families incrementally, measure them against the simple baselines on identical chronological holdouts, and only promote them to production when the lift is reproducible across seasons and leagues. If a league lacks sufficient verified data, display prediction unavailable / limited data rather than fabricate confidence.
