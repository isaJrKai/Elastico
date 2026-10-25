# ELASTICO prediction research results

**Run date:** 2026-10-24  
**Status:** Research evidence only — not a production betting-performance claim.

## Dataset and evaluation design

- Results source: [OpenFootball football.json](https://github.com/openfootball/football.json), public-domain match fixtures and results. The project describes the data as public domain; verify the upstream licence and source provenance when redistributing.
- Leagues: England, Spain, Germany, Italy and France top divisions.
- Unique completed matches loaded: 12,558 across the cached run.
- Training set: 10,137 matches, 2019-07-01 through 2025-02-23.
- Holdout set: 2,421 matches, 2025-02-24 through 2026-09-20.
- The split is based on unique dates, so a date cannot appear in both train and test.
- Elo ratings are updated sequentially during the holdout only after predictions for a match are made. The Poisson model is fitted only on the training period and is not updated using holdout outcomes.
- Metrics are average multiclass log loss, multiclass Brier score, and accuracy. Lower log loss/Brier is better; higher accuracy is better.

## Holdout results

| Candidate | Log loss ↓ | Multiclass Brier ↓ | Accuracy ↑ |
|---|---:|---:|---:|
| Sequential Elo | 0.9802 | 0.5829 | 54.44% |
| Regularized team-attack/defence Poisson | 0.9824 | 0.5845 | 52.58% |
| Fixed 50/50 Elo–Poisson blend | **0.9765** | **0.5801** | 53.53% |
| Training-frequency baseline | 1.0570 | 0.6391 | 45.68% |

The fixed 50/50 blend has the best log loss and Brier score among these candidates; Elo has the highest accuracy. Blend weights were not tuned on the holdout. This is evidence of improvement over the simple frequency baseline on this dataset, not proof of calibration in every league, superiority to the betting market, or profitability.

## Market reference diagnostic

Source: [TipsAudit Football Prediction Dataset](https://tipsaudit.com/data), CC-BY-4.0, with attribution required.

Only **45 exact fixture overlaps** were found between the five-league holdout and this source's logged-prediction data. The diagnostic is marked **insufficient overlap** (minimum 50 matches) and must not be interpreted as a reliable market comparison. The source is not an exhaustive fixture universe and may have selection bias. A larger, independently representative and lawfully usable market-odds dataset is still needed before claiming a betting edge.

## Production decision

- The regularized Poisson candidate is slightly behind Elo on the full holdout.
- The fixed blend is the strongest candidate by log loss/Brier among the tested baselines, but its market comparison is not adequately sampled.
- Do not deploy the research artifact into betting recommendations yet. It is not currently wired into production inference.
- The existing live prediction endpoint now marks neutral fallbacks and stale team-history gaps, and the stochastic endpoint discloses that it is not a trained/independently validated ML model.
- The prediction-engine CI passed tests, TypeScript, lint, and the research experiments for the reviewed PR head. Vercel build checks remain blocked by the account build-rate limit; no production deployment has been verified.

## Reproduction

See [prediction-baseline-research.md](prediction-baseline-research.md) and the scripts:
- `scripts/train_openfootball_baseline.py`
- `scripts/train_openfootball_poisson.py`
- `scripts/benchmark_openfootball_market.py`

The GitHub Actions artifact for the run contains fixture-level holdout predictions and fitted research parameters. It is a research artifact, not an automatically deployed model.
