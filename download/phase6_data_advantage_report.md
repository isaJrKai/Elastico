# Phase 6 — Data Advantage Audit

**Date**: 2026-08-19
**Evidence Base**: Phase 3 (XGBoost v1), Phase 3.5 (Stress Test), Phase 4 (LSTM — FAILED), Phase 5 (Calibration & Market Intelligence)
**Schema**: v1.0.0 (hash: 52e5a19749b8d954)

---

## Purpose

Phases 1–5 have established the current predictive boundary of the ELASTICO system.

This phase does NOT build another model. It does NOT tune hyperparameters. It does NOT
deploy. It answers one question:

> **What information does ELASTICO need to know that the market does not already know?**

The evidence so far is unambiguous:

| Question | Answer | Evidence |
|----------|--------|----------|
| Can static football features beat the market? | **No** | Phase 3.5: football-only XGB never beats market LL (0.959) |
| Can temporal football history unlock signal? | **Not with this dataset** | Phase 4: LSTM test LL 3.1–3.8 vs market 0.959 |
| Can calibration fix the models? | **No** | Phase 5: temperature T=1.0; Platt/isotonic HURT performance |

**The bottleneck is information, not algorithms.** Raw normalized market odds achieve
log loss 0.959 across all temporal windows. The best ELASTICO model (XGBoost Combined)
achieves 1.100. The gap is 0.141 log loss points — substantial.

---

## 6A — Current Data Inventory

### Active Data Sources

**1. football-data.co.uk (Primary Training Data)**

- **Type**: Manually downloaded CSV files
- **Status**: IMPLEMENTED — sole source for ML training pipeline
- **Leagues**: E0 (PL), SP1 (La Liga), I1 (Serie A), D1 (Bundesliga), F1 (Ligue 1)
- **Seasons**: 1920, 2021, 2122, 2223, 2324 (E0 has 5 seasons; others start from 2021)
- **Match count**: 7,536 total rows in training dataset (6,096 complete)
- **Update frequency**: Manual, post-season batch download
- **Reliability**: High — widely used academic source

Fields available in CSV but not all used:

| Used in Pipeline | Available but UNUSED |
|---|---|
| Date, HomeTeam, AwayTeam | Referee |
| FTHG, FTAG, FTR | HTHG, HTAG, HTR (half-time goals/results) |
| HS, AS, HST, AST (shots) | WHH/D/A (William Hill odds) |
| HC, AC (corners) | VCH/D/A (VC Bet odds) |
| HF, AF (fouls) | BFH/D/A (Betfair odds) |
| HY, AY, HR, AR (cards) | 1XBH/D/A (1xBet odds) |
| PSH/D/A, B365H/D/A (closing odds) | MaxH/D/A, AvgH/D/A (aggregate odds) |
| PSCH/D/A, B365CH/D/A (closing odds) | MaxCH/D/A, AvgCH/D/A (closing aggregate) |

**Critical observation**: Opening odds for multiple bookmakers (B365, PS, WH, VC) exist in the
CSVs but are completely ignored. Only Pinnacle/Bet365 closing odds are used for the 4 market
features.

**2. API-Football (API-Sports.io v3)**

- **Type**: REST API (async, httpx)
- **Status**: IMPLEMENTED — service complete, API routes exposed, but data NOT piped to training
- **Leagues**: 12 leagues (PL, La Liga, Serie A, Bundesliga, Ligue 1, UCL, EFL Championship, Segunda, Serie B, 2. Bundesliga, Ligue 2, Eredivisie)
- **Authentication**: Header `x-apisports-key`
- **Rate limit**: ~100 requests/day (free tier)
- **Endpoints implemented**: fixtures, fixture/statistics, odds, predictions, teams/statistics, fixtures/headtohead

Data available via this API but NOT flowing to training pipeline:

- In-match statistics (possession, shots, corners, fouls) — fetched on demand, never stored
- Team statistics (form, goals, clean sheets, lineups, cards) — fetched on demand, never stored
- Head-to-head records — fetched on demand, never stored
- **Injuries** — endpoint EXISTS in API-Football API spec but is NOT called by the service
- **Lineups** — available in teams/statistics and fixture/statistics, not piped to training

**3. ESPN Public API**

- **Type**: REST API (unauthenticated, async)
- **Status**: IMPLEMENTED — live scores and team info working
- **Leagues**: 11 leagues mapped
- **Data fetched**: Live scores, team info (name, logo, venue), news headlines
- **NOT piped to training**: News, standings, injuries (endpoint exists but not called)

**4. The Odds API**

- **Type**: REST API (async)
- **Status**: IMPLEMENTED — current odds and market signal detection working
- **Markets**: h2h, spreads, totals
- **Signal detection**: Steam moves, reverse line movement, sharp action — code exists in `odds_service.py` and `market_signals.py`
- **NOT piped to training**: Historical odds (endpoint exists but not systematically collected)
- **NOT piped to training**: Market signal features (steam, RLM, sharp action)

### Scaffolded / Not Integrated

| Source | Status | Notes |
|--------|--------|-------|
| football-data.org | SCAFFOLDED | Env var exists, DB seed references it, no service file, status: `never_fetched` |
| StatsBomb | NOT INTEGRATED | Frontend has demo code for one WC Final match. Open data is limited. Enterprise requires license. |
| Understat | NOT INTEGRATED | No code exists. Free xG data for 5 major leagues, 2014–present. |
| fbref / Sports Reference | NOT INTEGRATED | No code exists. Free comprehensive squad/player/tactical data. |
| Weather APIs | NOT INTEGRATED | No code exists. |
| News / Sentiment APIs | NOT INTEGRATED | ESPN news fetched but not processed for training. |

---

## 6B — Feature Information Gap

### Current 50 Canonical Features

The feature schema (v1.0.0) defines 50 features in 8 categories. Here is the complete
inventory with data quality and information content assessment.

| Category | Count | Features | Data State | Key Gap |
|----------|-------|----------|------------|----------|
| ELO | 5 | elo_home, elo_away, elo_diff, elo_home_advantage_adjusted, elo_form_trend | DERIVED (4.1% missing) | None structural |
| Goals | 10 | avg_goals_scored/conceded (home/away/all), goal_difference, xg_for_home/away, xg_diff + 2 overall | DERIVED + PROXY (0.8-1.7% missing) | **xG is FAKE** (SOT × 0.1) |
| Form | 8 | last_5_form_points, form_diff, win/unbeaten_streaks, goals_per_game_trend | DERIVED (0.8-1.7% missing) | None structural |
| H2H | 4 | h2h_home/away/draw_win_pct, h2h_avg_goals | DERIVED (19.1% missing) | First meetings have no H2H |
| Venue Splits | 4 | home/away_win_pct, home/away_goals_avg | DERIVED (0.9-1.7% missing) | None structural |
| Market | 4 | implied_prob_home/draw/away, overround | REAL (0.0% missing) | Only closing odds used |
| Temporal | 5 | day_of_week, month, is_weekend, days_since_last_match × 2 | DERIVED (0.8% missing) | Crude rest proxy only |
| Advanced | 10 | attacking/defensive_strength × 2, poisson_lambda × 2, shot_conversion × 2, clean_sheet_pct × 2 | DERIVED (0.8% missing) | Goals-based, not xG-based |

### Critical Proxy Problem

Three features — `xg_for_home`, `xg_for_away`, `xg_diff` — are labeled as expected goals
but are actually computed as:

```
xg_for_home = mean(shots_on_target_last_5_matches) × 0.1
```

This has no theoretical basis. A shot on target from 40 yards and a shot on target from 6 yards
both count as 1 SOT, but their xG values differ by ~0.5. The proxy destroys shot quality
information that real xG preserves. Per the Data Quality Contract (6G), these features should
be renamed to `xg_proxy_for_home` etc., and real xG should be sourced from a proper provider.

### Missing Information by Category

#### TEAM — Currently Available

ELO (✅), form (✅), goals scored/conceded (✅), shots and SOT (✅), home/away splits (✅),
streaks (✅), strength trends (✅)

**Missing**: Strength trends against similar-quality opponents, performance vs specific formations

#### EXPECTED PERFORMANCE — Severely Deficient

**Currently available**: xG_PROXY (SOT × 0.1), shot conversion rate, goals-based attacking/defensive
strength, goals-based Poisson lambda

**Missing**:

- **Real xG** (from Opta/StatsBomb/Understat) — the single most important missing feature
- **xGA** (expected goals against) — defensive quality measure
- **xA** (expected assists) — chance creation quality
- **Shot quality metrics** (xG per shot, xG by location/zone)
- **Post-shot xG** (quality of shots on target specifically)
- **xT** (Expected Threat) — territorial control value
- **Progressive actions** (passes, carries that move the ball into dangerous zones)
- **Chance creation rate** (per 90 minutes)

**Assessment**: The expected performance category is the weakest link. Every advanced feature
in this category is derived from goals, which are extremely noisy (low-scoring sport, high
variance). Real xG would provide a fundamentally different signal.

#### PLAYER — Completely Empty

**Currently available**: Nothing. Zero player-level features in the 50-feature schema.

**Missing**:

- Injuries (who is out, doubtful, returning)
- Suspensions (yellow card accumulation, red cards)
- Expected/confirmed lineups
- Player ratings (per-match performance scores)
- Player availability percentage
- Minutes played (fatigue indicator)
- Player form (recent individual performance)
- Key player absence impact

**Assessment**: This is a massive gap. The ELASTICO frontend already has an `InjuryAdjustment`
system in the prediction engine form (with star/key/rotation importance levels and xgImpact),
but it relies on manual user input. No automated injury data feed exists.

#### TACTICAL — Completely Empty

**Currently available**: Nothing.

**Missing**: Formation, formation changes, pressing intensity (PPDA), defensive line height,
possession structures, passing networks, spatial control, set piece efficiency

**Assessment**: Tactical data is interesting but hard to quantify and partially captured by
form/goal statistics. Medium priority. Formation data from API-Football lineups endpoint
would be the easiest entry point.

#### CONTEXT — Partially Available

**Currently available**: day_of_week, month, is_weekend, days_since_last_match (× 2)

**Missing**:

- Fixture congestion (matches in last 7/14/30 days — current feature only captures last match)
- Competition importance (league vs cup vs dead rubber)
- Travel distance (European away matches)
- Home advantage magnitude (crowd size, stadium capacity)
- Referee identity and tendencies (**already in CSVs but unused**)
- Weather conditions
- Managerial changes (new manager bounce effect)
- International break impact (player return from national duty)

**Assessment**: The referee column already exists in the CSVs (2019–2023) and is completely
ignored. Fixture congestion can be derived from existing date data. These are low-effort
additions with moderate expected value.

#### MATCH EVENT — Partially Available

**Currently available**: Shots (total), shots on target, corners, fouls, yellow/red cards — all
from football-data.co.uk CSVs (aggregate per-match counts only)

**Missing**: Shot coordinates, shot types, pass events, carry events, pressure events,
defensive actions by zone, set piece details, possession chains

**Assessment**: Event-level data is the foundation for computing real xG, xT, PPDA, and all
advanced metrics. Without it, most advanced football analytics are impossible. StatsBomb
open data provides this for limited tournaments; enterprise access (StatsBomb/Opta) would
be needed for full league coverage.

#### MARKET TIMING — Severely Deficient

**Currently available**: Closing odds (Pinnacle/Bet365) → 4 normalized implied probability features

**Missing**:

- Opening odds (available in CSVs but unused — B365H, PSH, WHH, VCH opening columns)
- Closing odds (already used)
- Odds movement (opening → closing shift as a feature)
- Bookmaker disagreement (variance across bookmakers at a point in time)
- Historical odds snapshots (The Odds API has this endpoint but it's not collected)
- Steam move detection (code exists in `market_signals.py` but never used in training)
- Public vs sharp money indicators

**Assessment**: This is a high-value, LOW-effort gap. Opening odds are ALREADY in the CSV
files. The odds movement feature (closing - opening) requires zero new API integrations.
Market signal detection code already exists. This should be the first experiment.

#### NEWS/SENTIMENT — Nearly Empty

**Currently available**: ESPN news headlines (fetched by API, not piped to training, not
processed for sentiment)

**Missing**: Injury news timing, manager news, squad news, transfer impact, press conference
sentiment, late-breaking information (< 24h before kickoff)

**Assessment**: News timing creates genuine information asymmetry. When a star player is
ruled out 48 hours before kickoff, the market moves. If ELASTICO can capture this earlier
or more comprehensively, it creates an edge. However, NLP-based sentiment is noisy.
Structured data (injuries, lineups) should come first; unstructured sentiment later.

---

## 6C — Existing Integration Audit

| Source | Service File | API Routes | Training Pipeline | Status |
|--------|-------------|------------|-------------------|--------|
| football-data.co.uk CSVs | `src/services/csv_ingestion.py` | `/api/data/csv/*`, `/api/training/*` | ✅ Phase 2 ETL | **IMPLEMENTED** |
| API-Football v3 | `src/services/api_football_service.py` | `/api/data/api-football/*` | ❌ On-demand only | **IMPLEMENTED (not piped)** |
| ESPN Public API | `src/services/espn_service.py` | `/api/data/espn/*` | ❌ On-demand only | **IMPLEMENTED (not piped)** |
| The Odds API | `src/services/odds_service.py` | `/api/data/odds/*` | ❌ On-demand only | **IMPLEMENTED (not piped)** |
| football-data.org | None | None | ❌ | **SCAFFOLDED** |
| StatsBomb | None | Frontend demo only | ❌ | **NOT INTEGRATED** |
| Understat | None | None | ❌ | **NOT INTEGRATED** |
| fbref | None | None | ❌ | **NOT INTEGRATED** |

**Key finding**: Four API integrations exist but NONE of the on-demand API data flows into
the training pipeline. The training pipeline only consumes manually downloaded CSVs.
The database has 14 tables with proper schema but is completely unwired — no service writes to it.

---

## 6D — Prioritization

### Ranking Criteria

Each data gap is ranked by: (1) expected predictive value, (2) independence from bookmaker
information, (3) historical availability, (4) data quality, (5) coverage, (6) integration
difficulty, (7) cost, (8) licensing/accessibility, (9) ability to validate empirically.

### Priority Rankings

| Rank | Data Type | Independence | Predictive Value | Difficulty | Cost | Why This Order? |
|------|-----------|-------------|-----------------|------------|------|-----------------|
| **1** | **Player Injuries & Suspensions** | VERY HIGH | VERY HIGH | LOW-MED | FREE | API-Football endpoint exists. Injuries move markets. Highest independence. |
| **2** | **Real xG (Understat)** | HIGH | HIGH | MEDIUM | FREE | Replace fraudulent proxy. Genuinely different signal from goals. Free historical data. |
| **3** | **Opening vs Closing Odds Movement** | LOW (market) | HIGH | **VERY LOW** | **FREE** | Already in CSVs. Zero new APIs needed. Just feature engineering. |
| **4** | **Pre-Match Lineups** | HIGH | MED-HIGH | MEDIUM | FREE | API-Football has endpoint. Confirmed ~1h before kickoff limits pre-match use. |
| **5** | **Referee Data** | MED-HIGH | MEDIUM | **VERY LOW** | **FREE** | Already in CSVs (2019–2023). Just read the column. |
| **6** | **Fixture Congestion** | MED-HIGH | MEDIUM | **VERY LOW** | **FREE** | Derivable from existing dates. Replace crude `days_since_last_match`. |
| **7** | **Event-Level Shot Data** | MED-HIGH | MEDIUM | HIGH | FREE–$$ | Foundation for advanced metrics. Free coverage limited. |
| **8** | **Weather Data** | MEDIUM | LOW-MED | LOW | FREE | Easy but low expected value. Bookmakers likely account for weather. |

### Why Injuries Rank #1

Injuries and suspensions satisfy ALL three critical criteria:

1. **Independence**: Injury news breaks AFTER initial odds are set, creating a timing gap.
   If ELASTICO captures injuries before the market fully adjusts, this is genuine alpha.
2. **Predictive value**: Academic research consistently shows player absences affect match
   outcomes, especially for key players (star forwards, starting goalkeepers, defensive
   leaders). The effect is measurable and non-trivial.
3. **Feasibility**: The API-Football injuries endpoint ALREADY EXISTS in a fully implemented
   service. The integration gap is not building a new data source — it's wiring an
   existing one into the training pipeline.

### Why Odds Movement Ranks #3 (not higher)

Odds movement has HIGH predictive value and VERY LOW effort (data already exists), but
its independence from the market is LOW — it IS market data. Using opening and closing odds
to predict match outcomes is fundamentally different from using injury or xG data, because
the closing odds already incorporate the information that moved the line. The value of odds
movement is in detecting whether the market moved TOWARD or AWAY from what football models
predict, not as a standalone signal. It may help as a supplementary feature but is unlikely
to be the primary source of independent predictive information.

---

## 6E — Experiment Design

### General Protocol

Every data addition must be tested with the same methodology:

**Three experiments per data addition:**

1. **Football-Only Incremental**: Baseline (46 football features) vs Treatment (46 + new features)
2. **Combined Incremental**: Baseline (50 features) vs Treatment (50 + new features)
3. **Market Comparison** (THE critical test): Baseline (Raw Market, LL 0.959) vs Treatment (best model with new data)

**Same 5 temporal windows** from Phase 3.5/5:

| Window | Train | Val | Test | N Train | N Test |
|--------|-------|-----|------|---------|--------|
| W1 | 1920, 2021, 2122 | 2223 | 2223 | 2,831 | 1,631 |
| W2 | 1920–2223 | 2223 | 2324 | 4,462 | 1,634 |
| W3 | 2021–2223 | 2223 | 2324 | 4,272 | 1,634 |
| W4 | 2122–2223 | 2223 | 2324 | 3,224 | 1,634 |
| W5 | 1920–2122 | 2122 | 2223+2324 | 2,831 | 3,265 |

**Same XGBoost hyperparameters** as Phase 3.5:

`max_depth=5, eta=0.05, subsample=0.8, colsample_bytree=0.8, min_child_weight=5,
gamma=0.1, lambda=1.5, alpha=0.1, early_stopping_rounds=100, max_rounds=1000`

**Metrics**: Log loss (primary), Brier score, ECE, accuracy

**Success criterion**: Must beat market LL (0.959) in at least 3/5 temporal windows.

**Retention criterion**: Data is only retained if it shows LL improvement > 0.005 over baseline
in at least 2/5 windows, OR provides clearly justified product capability (e.g., UI display).

### Experiment 1: Odds Movement Features

**Hypothesis**: The difference between opening and closing odds encodes information about
late-breaking factors (injuries, team news, weather) that is not captured by closing odds alone.

**Data**: B365H/PSH/WHH (opening) vs B365CH/PSCH (closing) — already in CSVs.

**Features to add**:
- `odds_movement_home_pp`: closing_implied_home - opening_implied_home
- `odds_movement_away_pp`: closing_implied_away - opening_implied_away
- `bookmaker_disagreement`: std_dev(implied_home across B365, PS, WH at opening)

**Critical leakage check**: Opening odds are available BEFORE the match. Closing odds are
available BEFORE the match. The difference is computed from pre-match data only. No leakage.

**Expected outcome**: Moderate improvement in Combined model. Unlikely to beat market alone.

### Experiment 2: Real xG from Understat

**Hypothesis**: Real xG measures chance quality, providing independent football intelligence
that the goals-based proxy does not capture.

**Data**: Team xG and xGA per match from Understat (free, 2014–present, 5 major leagues).

**Features to add/replace**:
- Replace `xg_for_home` (proxy) with `xg_for_home` (real, from Understat)
- Replace `xg_for_away` (proxy) with `xg_for_away` (real, from Understat)
- Add `xga_for_home` (expected goals against)
- Add `xga_for_away` (expected goals against)
- Add `xg_diff_real` (real xG difference)

**Features to rename**:
- `xg_for_home` (proxy) → `xg_proxy_for_home` (archived, not used)

**Critical leakage check**: Understat xG is computed from match events, which are only
available AFTER the match. For training, this means xG from match T can only be used as
a feature for matches AFTER T (i.e., as a rolling average of past real xG, not current-match xG).

**Expected outcome**: Significant improvement in Football-only model (the proxy is known to be
bad). Whether this translates to beating the market depends on whether xG information is
already reflected in bookmaker odds.

### Experiment 3: Injury Features

**Hypothesis**: Key player absences reduce team strength in measurable ways that are not
fully reflected in closing odds, especially when the absence is confirmed close to kickoff.

**Data**: API-Football injuries endpoint.

**Features to add**:
- `key_player_absent_home`: Binary (1 if any player rated star/key is out/doubtful)
- `key_player_absent_away`: Same for away team
- `squad_availability_home`: % of first-choice squad available (estimated)
- `squad_availability_away`: Same
- `days_since_injury_news_home`: How recently an injury was reported (recency)

**Critical leakage check**: Injury data must be timestamped. Only injuries reported BEFORE
kickoff can be used. Late injury news (announced < 2h before kickoff) may not be captured
in practice. The `observation_time` must be documented per the Data Quality Contract.

**Expected outcome**: If injuries are genuinely independent information, this should improve
predictions for matches where key players are absent. The effect size is likely small per-match
but could accumulate across a season.

---

## 6F — Data Acquisition Plan

### Phase 7A: Extract Unused CSV Data (1–2 days)

| Item | Detail |
|------|--------|
| Data needed | Opening odds (B365, PS, WH), referee, half-time results, multiple bookmaker closing odds |
| Source | Existing `data/historical/*.csv` files — NO new API needed |
| Endpoints | None (local file reading) |
| Authentication | None |
| Expected schema | Add columns: `opening_odds_home`, `opening_odds_draw`, `opening_odds_away`, `referee`, `ht_result`, `ht_home_goals`, `ht_away_goals` |
| Ingestion frequency | One-time backfill (historical CSVs already downloaded) |
| Normalization | Same team name mapping as Phase 2. Odds format same as existing. |
| Provenance | `source=football-data.co.uk, observation_time=pre-match, quality_state=REAL` |
| Failure behavior | Missing columns in some seasons → mark as UNAVAILABLE for those rows |
| Caching | Already cached in CSVs |
| Complexity | **VERY LOW** — modify `phase2_data_foundation.py` to read additional columns |

### Phase 7B: Real xG from Understat (3–5 days)

| Item | Detail |
|------|--------|
| Data needed | Team xG and xGA per match per season |
| Source | Understat (understat.com) |
| Endpoints/Method | Scrape or use unofficial API: `https://understat.com/league/{league}/{season}` |
| Authentication | None (unofficial) |
| Expected schema | `{team_name, match_date, xg, xga, opponent_xg, opponent_xga}` |
| Ingestion frequency | Historical backfill + weekly update during season |
| Normalization | Team name mapping to football-data.co.uk names. Date standardization. |
| Provenance | `source=understat, observation_time=post-match, quality_state=REAL` |
| Failure behavior | If Understat is down, mark xG as UNAVAILABLE. Fallback: keep proxy. |
| Caching | Local JSON/Parquet cache with source timestamp |
| Complexity | **MEDIUM** — scraping required, team name mapping, temporal alignment |

### Phase 7C: Injury Data via API-Football (2–3 days)

| Item | Detail |
|------|--------|
| Data needed | Player injuries and suspensions per team per fixture |
| Source | API-Football v3 — injuries endpoint |
| Endpoints | `GET /injuries?league={id}&season={year}&team={id}` |
| Authentication | `x-apisports-key` header (existing key) |
| Expected schema | `{player_name, player_type, reason, status: 'out'|'doubtful'|'questionable', fixture_date}` |
| Ingestion frequency | Pre-match (48h and 2h before kickoff) + historical backfill |
| Normalization | Player importance classification (star/key/rotation) — may need manual mapping or external rating source |
| Provenance | `source=api-football, observation_time=injury_report_time, quality_state=REAL` |
| Failure behavior | API rate limit → cache responses, batch requests. Missing data → STALE or UNAVAILABLE. |
| Caching | PostgreSQL `injuries` table (schema exists but empty) |
| Complexity | **LOW-MEDIUM** — service exists, just needs injury endpoint added + training pipeline wiring |

### Phase 7D: Enhanced Context Features (2–3 days)

| Item | Detail |
|------|--------|
| Data needed | Fixture congestion, competition importance flags |
| Source | Derived from existing match date data + API-Football fixture info |
| Endpoints | None new — computed from existing data |
| Authentication | None |
| Expected schema | `matches_in_last_7d`, `matches_in_last_14d`, `competition_importance: 1-5`, `is_cup_match`, `is_dead_rubber` |
| Ingestion frequency | Computed at feature generation time |
| Normalization | Competition mapping (league=1, UCL=2, domestic cup=3, etc.) |
| Provenance | `source=derived, method=match_date_analysis, quality_state=DERIVED` |
| Failure behavior | Missing fixture history → use defaults (no congestion) |
| Caching | Computed on-the-fly from match history |
| Complexity | **VERY LOW** — pure computation from existing dates |

---

## 6G — Data Quality Contract

### Core Principle

**NO FABRICATION.** Every feature must have traceable provenance from source to model input.

### Feature Quality States

| State | Definition | Example |
|-------|-----------|--------|
| **REAL** | Directly measured or officially recorded | Goals scored (3), Pinnacle closing odds (2.10), referee (M. Oliver) |
| **PROXY** | Derived from a correlated but different measurement | `xg_proxy_for_home = mean(SOT_last_5) × 0.1` |
| **DERIVED** | Computed from REAL data using a defensible method | `elo_rating = 1500 + sum(K × (actual - expected))` |
| **MISSING** | Data point does not exist for this observation | First-ever match: no rolling features → NaN |
| **STALE** | Data is available but older than freshness threshold | Injury data from 3 weeks ago, not updated |
| **UNAVAILABLE** | Source does not provide this field for this match/league/season | Referee column absent from 2324 CSV format |

### Required Metadata Per Feature

Every feature value must carry:

1. **source**: Where did this value come from? (e.g., `football-data.co.uk`, `understat`, `api-football`, `derived:elo_formula`)
2. **timestamp**: When was this value recorded or computed?
3. **observation_time**: What time period does it represent? (e.g., `last_10_matches_before_2024-03-15`)
4. **freshness**: Time between observation and prediction time
5. **provenance**: Chain of derivation from raw data to feature value
6. **quality_state**: One of the six states above

### Proxy Labeling Rule

A proxy feature MUST include `_PROXY` in its name.

- Current: `xg_for_home` (misleading — implies real xG)
- Correct: `xg_proxy_for_home` (honest — makes the proxy nature explicit)
- When real xG is acquired: `xg_for_home` (now real, no suffix needed)

### Missing Data Rule

Missing values MUST be represented as `null`/`NaN`. Default imputation is FORBIDDEN without
explicit documentation of the method and its justification. Tree-based models (XGBoost)
can handle NaN natively.

### Historical Reproducibility Rule

Any feature used in training must be reproducible from raw data. No ad-hoc adjustments.
The Phase 2 pipeline (`scripts/phase2_data_foundation.py`) is the canonical feature
computation path. Any modifications must be versioned and documented.

---

## 6H — Predictive Value Experiment Methodology

### The Fundamental Question

> Does adding this data provide OUT-OF-SAMPLE improvement?

This is not assumed — it must be measured.

### Experiment Structure

For each data addition, run this sequence:

```
BASELINE (existing best)
    ↓
BASELINE + DATA GROUP
    ↓
OUT-OF-SAMPLE EVALUATION
    ↓
RETAIN OR DISCARD
```

### Specific Metrics

| Metric | What It Measures | Why It Matters |
|--------|-----------------|----------------|
| Log Loss | Probability calibration + accuracy combined | Primary ranking metric. Market = 0.959. |
| Brier Score | Mean squared probability error | Complements log loss. Less sensitive to extreme probabilities. |
| ECE | Calibration reliability | How close are predicted probabilities to actual frequencies? |
| Accuracy | Correct predictions | Most intuitive but least informative for probability models. |

### Strict Methodology Rules

1. **Temporal out-of-sample ONLY.** Never evaluate on training data. Never use future data.
2. **Same windows as Phase 3.5/5.** Enables direct comparison with all previous results.
3. **Same hyperparameters.** Only the input features change. The model configuration is fixed.
4. **Feature addition is incremental.** Add one data group at a time. Do not add 5 features at once
   and claim they all help.
5. **Report ALL results**, not just the best window. If a feature helps in W1 but hurts in
   W2–W5, report all five numbers honestly.
6. **The market is the benchmark.** If the new data helps the football model but the
   combined model still loses to raw market odds, the data has not solved the core problem.

### Retention Decision Tree

```
Does new data beat baseline in ≥2/5 windows by >0.005 LL?
    ├─ YES → RETAIN in feature set
    └─ NO → Does it provide product value (UI display, user trust)?
              ├─ YES → RETAIN as display-only feature (not in prediction model)
              └─ NO → DISCARD
```

---

## 6I — ELASTICO Data Architecture

### Current State (Broken)

```
CSV FILES (manual download)
    ↓
Phase 2 Script (one-time ETL)
    ↓
Parquet File (static snapshot)
    ↓
XGBoost Training (reads Parquet)
    ↓
Prediction (not connected to ELASTICO)
```

The database has 14 tables but nothing writes to it. Four API services exist but none
feed the training pipeline. The entire system is a collection of disconnected components.

### Target State

```
EXTERNAL SOURCES
(API-Football, Understat, Odds API, ESPN, football-data.co.uk, weather)
    ↓
INGESTION LAYER
(scheduled collectors, rate limiting, retry, error handling, deduplication)
    ↓
RAW STORAGE (PostgreSQL)
(matches, odds, injuries, events, teams, players — schema EXISTS)
    ↓
NORMALIZATION
(team name mapping, league mapping, date standardization, unit conversion)
    ↓
PROVENANCE & QUALITY
(source, timestamp, observation_time, quality_state for every data point)
    ↓
FEATURE STORE
(canonical features with full metadata per Data Quality Contract)
    ↓
MODEL FEATURES
(selected features per model, with documented quality states)
    ↓
PREDICTION
(ELO + Poisson + XGBoost + Market → calibration → uncertainty → final probability)
    ↓
ELASTICO API
(response with full provenance chain, confidence, market edge, data quality)
    ↓
USER
(probability display, market edge, confidence indicators, xG analytics, team comparison)
```

### What This Architecture Adds (Not Redesigns)

This is an **addition** to the existing system, not a redesign:

- **Ingestion layer**: New services that collect data from APIs on schedule and write to DB
- **Provenance tracking**: Metadata attached to every data point
- **Feature store**: Canonical feature computation with quality states
- **DB wiring**: Connect the existing 14-table schema to actual data flows

The existing Phase 2 pipeline, XGBoost training, ELO computation, and all model artifacts
are preserved as the experimental laboratory.

---

## 6J — Summary & Recommendations

### What ELASTICO Currently Has

1. **7,536 matches** across 5 major European leagues, 2019–2024
2. **50 canonical features** (46 football + 4 market), with strict temporal leakage prevention
3. **4 implemented API services** (API-Football, ESPN, Odds API, CSV ingestion)
4. **6 trained/evaluated models** (ELO, Poisson, XGBoost × 3 variants, LSTM — failed)
5. **5 validated temporal test windows** for reproducible out-of-sample evaluation
6. **A comprehensive calibration framework** (temperature, Platt, isotonic)
7. **A Data Quality Contract** for provenance and quality state tracking
8. **A clear empirical benchmark**: Raw Market LL = 0.959

### What ELASTICO Is Missing

1. **Real xG** (using a fraudulent proxy: SOT × 0.1)
2. **Player data** (injuries, suspensions, lineups, ratings — zero player-level features)
3. **Odds movement** (opening vs closing — data EXISTS in CSVs but is unused)
4. **Referee data** (EXISTS in CSVs but unused)
5. **Context features** (fixture congestion, competition importance — derivable from existing data)
6. **News/sentiment** (ESPN news fetched but not processed)
7. **Event-level data** (shot coordinates, pass events — requires new data source)
8. **Automated data pipeline** (everything is manual or on-demand; no scheduled ingestion)
9. **Database connectivity** (schema exists, nothing writes to it)

### Highest-Value Data Gaps (Ranked)

1. **Player Injuries & Suspensions** — VERY HIGH independence, VERY HIGH value, LOW effort (API already exists)
2. **Real xG** — HIGH independence, HIGH value, MEDIUM effort (Understat free)
3. **Odds Movement** — HIGH value, VERY LOW effort (already in CSVs)
4. **Referee Data** — MEDIUM-HIGH value, VERY LOW effort (already in CSVs)
5. **Fixture Congestion** — MEDIUM-HIGH value, VERY LOW effort (derivable from dates)

### The Strategic Question

> Even with all these data additions, will ELASTICO beat the market?

This is unknown. The efficient market hypothesis suggests that closing odds already
incorporate most available information. But:

- Injuries confirmed 24–48 hours before kickoff may not be fully priced in
- Real xG may capture information that bookmaker models underweight
- Odds movement patterns may reveal systematic market inefficiencies

The only way to know is to acquire the data and test empirically.

### Recommended Phase 7

**Stop model development. Acquire data. Test each addition.**

1. **Phase 7A**: Extract unused CSV data (opening odds, referee). Test odds movement features.
2. **Phase 7B**: Integrate Understat xG. Replace proxy. Test real xG impact.
3. **Phase 7C**: Wire API-Football injuries endpoint. Test injury features.
4. **Phase 7D**: Compute enhanced context features. Test fatigue/congestion.
5. **Phase 7E**: Add lineup/squad data. Test squad strength features.
6. **Phase 7F**: Collect historical odds movement. Test temporal market features.

**Success gate**: Only proceed to next data addition if the current one shows measurable
out-of-sample improvement.

**Failure mode**: If no data addition beats the market after 3 experiments, accept
market-calibrated display as the product's prediction backbone and focus ELASTICO on
analytics, visualization, and user experience value.

### What NOT To Do

- Do NOT train another model architecture
- Do NOT build the final ensemble from existing models
- Do NOT deploy predictions to ELASTICO
- Do NOT modify the ELASTICO frontend
- Do NOT fabricate or proxy any new features
- Do NOT reconnect the failed LSTM
- Do NOT claim a data source improves predictions until it is actually tested
- Do NOT add features without running the full 5-window temporal OOS evaluation

### The Bottom Line

ELASTICO has moved from **"let's build a powerful prediction engine"** to
**"let's scientifically determine what actually works."** The Phase 5 verdict was clear:
the current dataset cannot produce probabilities better than the bookmaker market.

The path forward is not another neural network. It is better, richer, earlier football
information — then empirically testing whether each addition actually adds predictive
value. Every existing model, every script, every artifact from Phases 1–5 is preserved
as the experimental laboratory and baseline against which all future improvements
will be measured.

That is a much stronger foundation than a system that pretends to be better than it is.
