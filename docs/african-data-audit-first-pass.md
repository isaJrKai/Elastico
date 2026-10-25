# African historical football data audit — first pass

**Audit date:** 2026-10-25  
**Status:** Uganda source files parsed and walk-forward benchmark wired into CI; model acceptance is still pending.\n**Pinned source commit:** `42df8203e73e922cdfa36104e3acee3aea1f2bc0` (2026-09-23).  
**Primary source:** [openfootball/world](https://github.com/openfootball/world), repository branch `master`, CC0-1.0/public-domain dedication per repository `LICENSE.md`.  
**Important:** The upstream branch is mutable. Before model evaluation, pin a repository commit SHA and retain source files, retrieval timestamp, SHA-256 hashes, parsed row counts, and exclusions. Git blob SHAs below are Git object identifiers, not SHA-256 file hashes.

## First-pass findings

The repository’s Africa directory includes Algeria, Egypt, Morocco, Nigeria and Uganda, among others. This corrects our earlier assumption that Uganda coverage was unconfirmed at the directory level: Uganda files do exist. Their actual completeness still needs measurement.

| Competition | Season files found in first-pass listing | Evidence from source listing | Current assessment |
|---|---|---|---|
| Algeria Ligue 1 | 2023-24, 2024-25 | Files `2023-24_dz1.txt`, `2024-25_dz1.txt` | Two seasons identified; completed-match counts and missing/duplicate checks pending |
| Egypt Premier League | 2023-24, 2024-25 | Files `2023-24_eg1.txt`, `2024-25_eg1.txt` | Two seasons identified; completed-match counts and missing/duplicate checks pending |
| Morocco Botola Pro 1 | 2023-24, 2024-25 | Files `2023-24_ma1.txt`, `2024-25_ma1.txt` | Two seasons identified; completed-match counts and missing/duplicate checks pending |
| Nigeria top division | Multiple files from 2009-10 onward in the directory listing; additional second-tier files also exist | Files include `2009-10_ng1.txt` through later `ng1` seasons and `ng2` files | More historical depth than the other three in this initial listing; season-by-season completeness must be measured rather than inferred |
| Uganda Premier League | 2023-24, 2024-25, 2025-26 | Files `2023-24_ug1.txt`, `2024-25_ug1.txt`, `2025-26_ug1.txt` | **705 unique scored results** parsed across three seasons; 2023-24: 225, 2024-25: 240, 2025-26: 240. No exact duplicate scorelines were found within or across these files. Still too short for a strong long-horizon claim. |

### Uganda sample checked directly

The header of `africa/uganda/2024-25_ug1.txt` declares **16 teams and 240 scheduled matches**, with a stated date range of **13 September 2024 to 24 May 2025**. These are source-declared season metadata, not a verified count of completed, unique, valid scored matches. The full file must be parsed to count completed results, missing scores, duplicates, team-name inconsistencies, and actual date range before use.

Source: [Uganda Premier League 2024-25 file](https://github.com/openfootball/world/blob/master/africa/uganda/2024-25_ug1.txt).

## Data-quality and modelling gates

1. Pin the exact upstream repository commit; do not treat `master` as a reproducible snapshot.
2. Download each selected season and record SHA-256, byte size, source path, Git blob SHA, retrieval timestamp, declared teams/matches, parsed fixtures, parsed completed results, missing scores, duplicates, and earliest/latest completed-result dates.
3. Check expected matches against competition format only where the format and season structure are documented. Do not assume every league has a simple round-robin schedule.
4. Normalize dates and team names with an auditable alias map; never silently merge clubs with ambiguous identities.
5. Convert Football.TXT into the evaluator's canonical CSV format with a deterministic parser and tests for postponed, abandoned, incomplete, and malformed lines.
6. Run chronological walk-forward evaluation separately per league. Compare smoothed league-frequency, Elo, rolling-goal model, and blend; add calibration and uncertainty checks before any release decision.
7. Treat Uganda as a developing coverage lane. If usable history is insufficient, label it **coverage found — validation pending**, not production-ready.

## Scope and limitations

The pinned Uganda sample is now parsed by `scripts/audit_openfootball_txt.py`, and CI downloads the three source files from the pinned commit, writes a SHA-256 manifest, and runs the chronological evaluator. The CI log contains the generated audit manifest and metrics; model superiority is not claimed until those metrics are reviewed and calibration/season-level stability checks are added. No raw data from restricted sources is included. The broader `schochastics/football-data` archive remains a candidate for backfill only after ODbL attribution and database/share-alike implications are reviewed for the intended product.
