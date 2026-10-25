# Prediction evaluation and African-league data plan

## Why this exists

Elastico already contains Elo, Poisson, and Dixon-Coles calculations. The immediate gap is not another model label: it is repeatable evidence that the implementations are fed real historical inputs and improve out-of-sample probability forecasts. The current predictions compute endpoint on main has used a deterministic team-name hash as an Elo input and constant Dixon-Coles parameters; those outputs must not be presented as trained or team-specific forecasts. See the prediction-engine audit PR for the intended correction.

## New evaluation harness

scripts/evaluate_walk_forward_models.py is a dependency-free first evaluation harness for common football-data.co.uk CSV columns (Date, Div, HomeTeam, AwayTeam, FTHG, FTAG, FTR). It evaluates expanding-history predictions in chronological order and reports log loss, multiclass Brier score, and accuracy for Elo, a rolling-goals Dixon-Coles baseline, and a 50/50 blend. It also reports league-level metrics and the warm-up rows excluded.

Example:

    python scripts/evaluate_walk_forward_models.py data/historical/*.csv --output reports/walk-forward.json

The first run should use a fixed, versioned dataset snapshot and retain its source URL, retrieval date, file hashes, row counts, date range, league coverage, and excluded-row counts alongside the metrics. Do not commit large raw datasets unless their licence and repository-size implications are confirmed.

### Important limitations

- This is a baseline harness, not a production training pipeline.
- The first Dixon-Coles implementation uses a fixed rho rather than fitting parameters. Treat it as a comparator, then fit parameters using training data only.
- The rolling-goal rates are deliberately simple and must be benchmarked against league-average and Elo-only baselines before adoption.
- A future benchmark should add calibration/reliability tables, confidence intervals via time-block bootstrap, a market-implied probability baseline when legally usable historical odds are available, and pre-registered acceptance criteria.
- A profitable-betting claim requires timestamp-correct odds, bookmaker margin removal, realistic execution assumptions, closing-line-value analysis, and a held-out period. Prediction accuracy alone is insufficient.

## Data-source candidates

| Source | Coverage and format | Licence / usage caveat | Intended use |
|---|---|---|---|
| [OpenFootball/football.json](https://github.com/openfootball/football.json) | Public JSON results/fixtures, mostly well-covered European leagues | Repository describes its datasets as public domain; verify source/repo licence before redistributing each source | Clean baseline and cross-check for supported leagues |
| [OpenFootball/world](https://github.com/openfootball/world) | Football.TXT results/fixtures for Egypt, Morocco, Algeria, Nigeria, and other regions | Public-domain dedication stated by the project | First African domestic-league coverage investigation |
| [football-data.co.uk](https://www.football-data.co.uk/data) | Long historical CSV results, stats, and odds for many leagues; also lists additional worldwide premier divisions | The site states its free data is for private individuals and not commercial/data-training products using automated bots/scrapers/AI. Do not use for a commercial training pipeline without explicit permission/licence | Research-only comparison unless permission is secured |
| [open-matchday](https://github.com/oladeeayo/open-matchday) | Current-season CSVs for 75 competitions, uneven historical depth and detailed-stat coverage | Repository states non-commercial informational use; verify its licence and source-specific terms before use | Current fixture/results coverage audit, not assumed commercial training data |
| [schochastics/football-data](https://github.com/schochastics/football-data) | Aggregated match-result archive reported by the open-football directory as 1.2M+ results across 207 domestic leagues and 20 international tournaments, through 2023 | Inspect upstream licence, provenance, duplicate handling, and coverage before adoption | Candidate for breadth and African-league backfill |

Do not infer that “free to download” means “licensed for commercial model training.” Keep provenance at row/file level and isolate sources whose terms do not permit commercial use.

## African coverage workstream

Prioritise Egypt, Morocco, Algeria, and Nigeria as the first coverage audit because OpenFootball/world explicitly lists these domestic leagues. Uganda should be investigated separately: the source's public README does not establish a sufficiently deep Uganda Premier League history, so do not claim coverage until the actual season files and match counts are inspected.

For each league, record:
1. seasons and match counts, earliest/latest match date, missing scores, duplicate fixtures, and team-name variants;
2. source and licence/terms, retrieval timestamp, file hashes, and update cadence;
3. competition format changes, promoted/relegated teams, abandoned matches, and incomplete seasons;
4. train/validation/test splits by date, never random row splits;
5. metrics versus league-only frequency, Elo, rolling Poisson, Dixon-Coles, and a blend;
6. uncertainty and minimum sample thresholds before displaying a forecast.

Do not pool African leagues into a single global model until cross-league transfer has been tested. Start with league-specific baselines; use hierarchical/partial-pooling methods only when the data supports them.

## Integration gates

- [ ] Fix production inference so it does not use team-name hashes or fixed illustrative model parameters as real team ratings.
- [ ] Confirm the evaluator against a small hand-calculated fixture and test malformed CSV, duplicate rows, chronological order, and no future-data leakage.
- [ ] Run the evaluator on the existing historical snapshot and save the reproducible report.
- [ ] Add Dixon-Coles parameter fitting on training-only data and tune only on a chronological validation period.
- [ ] Audit African datasets and terms; publish a league coverage matrix with evidence.
- [ ] Require out-of-sample improvement over simple baselines and report calibration before promoting a model.
- [ ] Keep predictions in shadow mode until parity, data freshness, failure behaviour, and production performance are verified.
