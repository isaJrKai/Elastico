# ELASTICO prediction baseline research

## Why this exists
The live web endpoint is a statistical baseline, not a trained machine-learning model. The reproducible experiments download public historical match results, fit sequential Elo ratings and a regularized team-attack/defence Poisson model, then evaluate them on a later chronological holdout. Both are compared with a simple training-frequency baseline. It deliberately does not claim betting profitability.

## Data source and licensing
- Source: [OpenFootball football.json](https://github.com/openfootball/football.json)
- The project describes its football.json data as public domain/CC0, but **verify the current repository licence, specific files, and any upstream data rights before commercial use**.
- The script downloads files from the upstream repository and caches the exact JSON locally; it does not silently substitute a missing file.
- No xG, injuries, player features, odds, or other fields are fabricated. The experiment uses dates, teams, and full-time scores only.

## Run
The Elo experiment requires Python 3.10+ and no third-party packages. The Poisson experiment additionally uses NumPy and SciPy (both free, open-source libraries).

```bash
python scripts/train_openfootball_baseline.py
python -m pip install numpy scipy
python scripts/train_openfootball_poisson.py
python scripts/benchmark_openfootball_market.py
```

Optional Elo-only run:
```bash
python scripts/train_openfootball_baseline.py --seasons 2021-22 2022-23 2023-24 2024-25 --leagues en.1 es.1 de.1 it.1 fr.1
```

Outputs are written under `artifacts/openfootball-elo/`:
- `metrics.json` — sample counts, date ranges, log loss, multiclass Brier score, and accuracy for Elo and the frequency baseline.
- `holdout_predictions.json` — timestamped fixture-by-fixture holdout probabilities and ratings.
- `elo_ratings.json` — sequentially updated final ratings.

The Poisson experiment writes `artifacts/openfootball-poisson/metrics.json`, `holdout_predictions.json`, `fixed50_50_blend_predictions.json`, and `trained_poisson_model.json`. The fixed 50/50 Elo–Poisson blend is a pre-declared candidate; its weights are not tuned on the holdout. The market diagnostic writes `artifacts/openfootball-market-comparison/metrics.json`. It compares only exact overlaps against TipsAudit's CC-BY-4.0 fair probabilities and marks small samples as insufficient; this is not an exhaustive market benchmark. Credit TipsAudit and link to [its dataset](https://tipsaudit.com/data). Model artifacts are research outputs and are not wired into production inference until their holdout results and runtime integration are reviewed.

## Method and limitations
- Data is sorted chronologically and split on unique dates, so one calendar date cannot appear in both training and test. The Elo holdout is walk-forward; the Poisson model is fitted only on the training period and does not update from holdout results.
- Each holdout fixture is predicted before that match's result updates the Elo ratings. This is a walk-forward evaluation, not random splitting.
- Draw probability is estimated only from the training period.
- Leagues are kept separate in team rating keys.
- Metrics are averages over the holdout. They are not proof of profit, calibration in every league, or superiority over bookmaker closing odds.
- Missing seasons/league files are printed as warnings. Review these warnings and the output date ranges before interpreting metrics.
- This is an auditable baseline experiment, not yet a trained ML service deployed to production. Any more complex model must beat this baseline on the same untouched holdout and should be compared against normalized market-implied probabilities where lawfully available.
