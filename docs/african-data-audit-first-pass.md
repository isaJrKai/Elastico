# African historical football data audit — first pass

**Audit date:** 2026-10-25  
**Status:** Reproducible Uganda data audit and first walk-forward baseline completed; model acceptance remains pending.  
**Pinned source commit:** `42df8203e73e922cdfa36104e3acee3aea1f2bc0`.  
**Primary source:** [openfootball/world](https://github.com/openfootball/world), whose repository identifies its data as CC0/public-domain. Verify the upstream license at the pinned revision before each commercial release.

## First-pass findings

| Competition | Seasons identified | Current assessment |
|---|---|---|
| Algeria Ligue 1 | 2023-24, 2024-25 | Source files found; counts and completeness not yet audited |
| Egypt Premier League | 2023-24, 2024-25 | Source files found; counts and completeness not yet audited |
| Morocco Botola Pro 1 | 2023-24, 2024-25 | Source files found; counts and completeness not yet audited |
| Nigeria top division | Multiple seasons from 2009-10 onward in the source listing | Potential deeper history; season-by-season audit required |
| Uganda Premier League | 2023-24, 2024-25, 2025-26 | 705 unique scored results parsed from three pinned season files |

## Uganda audit result

CI downloaded the three files at the pinned source commit, parsed them, wrote a SHA-256 manifest, and ran the chronological evaluator.

| Season | Unique scored results | Other audited entries |
|---|---:|---|
| 2023-24 | 225 | 1 abandoned/incomplete listing; 15 bye entries |
| 2024-25 | 240 | 0 incomplete fixtures found |
| 2025-26 | 240 | 0 incomplete fixtures found |
| **Total** | **705** | **No exact duplicate scored results found within or across the files** |

Observed result dates span **15 September 2023 to 23 May 2026**. Annotated scorelines are retained as results but separately counted in the audit manifest; the annotation itself is not interpreted as proof of a normal played match. Before commercial model use, awarded/administrative results should be reviewed and the product decision on whether to include them documented. The audit is a parse/completeness check, not independent verification of every result against the league.

Source example: [Uganda Premier League 2024-25 file](https://github.com/openfootball/world/blob/42df8203e73e922cdfa36104e3acee3aea1f2bc0/africa/uganda/2024-25_ug1.txt).

## First walk-forward benchmark — Uganda only

The pinned sample produced **638 scored predictions after chronological warm-up exclusions**. The evaluator updates team ratings and rolling goal features only after scoring each match. Scores below are in-sample historical evaluation across the walk-forward test periods, not betting returns and not a promise of future performance.

| Model | Log loss (lower is better) | Multiclass Brier (lower is better) | Accuracy |
|---|---:|---:|---:|
| Smoothed league-frequency baseline | 1.071469 | 0.647425 | 45.30% |
| **Elo baseline** | **0.998685** | **0.596909** | **54.39%** |
| Rolling-goal Dixon-Coles baseline | 1.139831 | 0.670503 | 45.92% |
| Equal-weight Elo + Dixon-Coles blend | 1.009688 | 0.606723 | 49.06% |

**Decision:** Do not promote the Dixon-Coles baseline or equal-weight blend as the winner. On this dataset and implementation, Elo has lower log loss and Brier score and higher accuracy. The fixed Dixon-Coles correlation parameter and goal-rate formulation are unfit baselines, not tuned model candidates. Keep Elo as the benchmark to beat; improve the goal model only through training-only fitting and new untouched chronological evaluation. Add calibration and season-level stability checks before a release decision.

The reported 54.39% accuracy is not sufficient on its own to establish usefulness: probability quality, calibration, league/season variation, data freshness, and comparison to market odds (where legally sourced) also matter. No profitability or commercial-readiness claim is made.

## Data-quality and modelling gates

1. Keep the upstream source pinned and record SHA-256, byte size, source path, row counts, exclusions, and date coverage.
2. Add an auditable team alias map; never silently merge clubs with ambiguous identities.
3. Review administrative/awarded results and decide explicitly whether to exclude them from training.
4. Run chronological walk-forward evaluation separately per league and season; never shuffle historical matches.
5. Compare against simple baselines and add calibration, uncertainty, and stability checks.
6. For Uganda, three seasons are a useful first test set but not enough to establish durable performance across changes in squads, coaches, and competition structure.
7. Treat the live endpoint as a separate release gate: predictions must use real, sufficiently fresh team history and explicitly disclose missing data. Do not generate synthetic team ratings from names or present neutral fallback numbers as trained forecasts.

## Scope and licensing

The pinned Uganda sample is parsed by `scripts/audit_openfootball_txt.py`; CI runs the parser and `scripts/evaluate_walk_forward_models.py` against the same source revision. The CI run is the source for the metrics above. Other African league files still need the same audit. Do not use datasets with unresolved commercial training restrictions. The `schochastics/football-data` archive is a candidate only after ODbL attribution and database/share-alike implications are reviewed for the intended product.
