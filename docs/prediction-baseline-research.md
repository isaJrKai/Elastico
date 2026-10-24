# ELASTICO prediction baseline research

## Why this exists
The live web endpoint is a statistical baseline, not a trained machine-learning model. This reproducible experiment downloads public historical match results, fits sequential Elo ratings and evaluates them on a later chronological holdout. It compares Elo with a simple training-frequency baseline. It deliberately does not claim betting profitability.

## Data source and licensing
- Source: [OpenFootball football.json](https://github.com/openfootball/football.json)
- The project describes its football.json data as public domain/CC0, but **verify the current repository licence, specific files, and any upstream data rights before commercial use**.
- The script downloads files from the upstream repository and caches the exact JSON locally; it does not silently substitute a missing file.
- No xG, injuries, player features, odds, or other fields are fabricated. The experiment uses dates, teams, and full-time scores only.

## Run
Requires Python 3.10+ and no third-party Python packages.

```bash
python scripts/train_openfootball_baseline.py
```

Optional:
```bash
python scripts/train_openfootball_baseline.py --seasons 2021-22 2022-23 2023-24 2024-25 --leagues en.1 es.1 de.1 it.1 fr.1
```

Outputs are written under `artifacts/openfootball-elo/`:
- `metrics.json` — sample counts, date ranges, log loss, multiclass Brier score, and accuracy for Elo and the frequency baseline.
- `holdout_predictions.json` — timestamped fixture-by-fixture holdout probabilities and ratings.
- `elo_ratings.json` — sequentially updated final ratings.

## Method and limitations
- Data is sorted chronologically; the earliest 80% is the rating warm-up/training period and the latest 20% is a sequential holdout.
- Each holdout fixture is predicted before that match's result updates the Elo ratings. This is a walk-forward evaluation, not random splitting.
- Draw probability is estimated only from the training period.
- Leagues are kept separate in team rating keys.
- Metrics are averages over the holdout. They are not proof of profit, calibration in every league, or superiority over bookmaker closing odds.
- Missing seasons/league files are printed as warnings. Review these warnings and the output date ranges before interpreting metrics.
- This is an auditable baseline experiment, not yet a trained ML service deployed to production. Any more complex model must beat this baseline on the same untouched holdout and should be compared against normalized market-implied probabilities where lawfully available.
