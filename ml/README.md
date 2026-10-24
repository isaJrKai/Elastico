# Elastico match-prediction training

This reproducible training/evaluation path creates a first trained 1X2 model. It stays separate from live inference until held-out metrics and team identity mapping have been reviewed.

## Data

Uses the Hugging Face dataset [eatpizzanot/soccer-dataset](https://huggingface.co/datasets/eatpizzanot/soccer-dataset), configs fixtures and teams. The dataset card states CC BY 4.0 and attributes sources to API-Football and football-data.co.uk. Keep attribution with derived artifacts and product documentation, and review provenance/terms before commercial distribution.

Only completed matches before the as-of cutoff are used. The feature builder walks chronologically and derives Elo, last-five form/goals, rest days and league goal averages from prior results. It does not use full-time match stats as pre-match inputs. Historical xG and odds are deliberately excluded from this first baseline.

## Run from repository root

Python 3.11+ recommended.

```bash
python -m venv .venv
# Windows PowerShell:
.venv\\Scripts\\Activate.ps1
# macOS/Linux/Codespaces:
source .venv/bin/activate
python -m pip install -r ml/requirements.txt
python ml/train_match_model.py --as-of 2026-10-24 --holdout-days 730 --out artifacts/football-1x2
```

The first run downloads the two dataset configs. Outputs:
- artifacts/football-1x2/evaluation.json — chronological held-out evaluation
- artifacts/football-1x2/model.json — model coefficients/scaler and latest team states

Do not commit raw downloaded data. The artifact remains a candidate until metrics, coverage, name mapping and runtime integration are reviewed.

## Evaluation gates

The model must beat the majority-class baseline on log loss and Brier score and be compared to bookmaker-implied probabilities on matches with reliable pre-kickoff odds before it can be described as offering betting value. Add reliability plots and rolling-origin evaluation before release. Do not tune on the held-out period.

## Limitations

Dataset team IDs are not assumed to match ESPN or football-data.org IDs. Use explicit normalized-name aliases; skip unknown or ambiguous matches rather than invent ratings. Coverage varies by league, and global Elo needs league-aware calibration. Historical performance cannot guarantee future performance or profit. This is a first baseline, not a claim of production accuracy.
