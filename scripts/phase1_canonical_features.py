#!/usr/bin/env python3
"""
Phase 1A: Create canonical feature schema shared by all components.

Fixes the XGBoost feature-vector mismatch by creating ONE authoritative
feature definition file imported by:
  - feature engineering (features.py)
  - XGBoost training and inference
  - LSTM sequence building
  - ensemble inference
  - saved model metadata

Also fixes the ensemble's _run_xgboost to use correct feature names.
"""

import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

PROJECT_ROOT = "/home/z/my-project/football-prediction-mega"

# ─────────────────────────────────────────────────────────────────────────────
# STEP 1: Create the canonical feature schema file
# ─────────────────────────────────────────────────────────────────────────────

CANONICAL_FEATURE_SCHEMA = '''"""
Canonical Feature Schema — Single Source of Truth
================================================

This module defines the authoritative feature names, their categories,
descriptions, and default values for the entire prediction pipeline.

Every component that produces or consumes feature vectors MUST import
from this file.  No competing feature-name definitions are permitted.

Feature categories (50 total):
  1. ELO features          (5)
  2. Goal features         (10)
  3. Form features          (8)
  4. Head-to-head           (4)
  5. Home/away splits       (4)
  6. Market features        (4)
  7. Temporal               (5)
  8. Advanced              (10)
"""

from __future__ import annotations

# ═══════════════════════════════════════════════════════════════════════════
# Feature definitions: (name, category, description, default_value)
# ═══════════════════════════════════════════════════════════════════════════

FEATURE_DEFINITIONS: list[tuple[str, str, str, float]] = [
    # ── ELO (5) ──────────────────────────────────────────────────────────
    ("elo_home",                   "elo",    "Home team ELO rating",                      1500.0),
    ("elo_away",                   "elo",    "Away team ELO rating",                      1500.0),
    ("elo_diff",                   "elo",    "ELO difference (home - away)",              0.0),
    ("elo_home_advantage_adjusted","elo",    "Home ELO + home advantage bonus",          0.0),
    ("elo_form_trend",            "elo",    "Recent ELO trend (slope over last N)",     0.0),
    # ── Goal features (10) ─────────────────────────────────────────────
    ("avg_goals_scored_home",     "goals",  "Home team avg goals scored (all venues)",  1.3),
    ("avg_goals_scored_away",     "goals",  "Away team avg goals scored (all venues)",  1.1),
    ("avg_goals_conceded_home",   "goals",  "Home team avg goals conceded (all)",      1.0),
    ("avg_goals_conceded_away",   "goals",  "Away team avg goals conceded (all)",      1.2),
    ("avg_goals_scored",          "goals",  "Home team overall avg goals scored",        1.3),
    ("avg_goals_conceded",        "goals",  "Home team overall avg goals conceded",      1.0),
    ("goal_difference",           "goals",  "Home goal difference (scored - conceded)", 0.0),
    ("xg_for_home",               "goals",  "Home team expected goals (xG)",             0.0),
    ("xg_for_away",               "goals",  "Away team expected goals (xG)",             0.0),
    ("xg_diff",                   "goals",  "xG difference (home - away)",              0.0),
    # ── Form features (8) ────────────────────────────────────────────────
    ("last_5_form_points_home",   "form",   "Home team points from last 5 matches",      0.0),
    ("last_5_form_points_away",   "form",   "Away team points from last 5 matches",      0.0),
    ("form_points_diff",          "form",   "Form points difference (home - away)",     0.0),
    ("win_streak_home",           "form",   "Home team current win streak",             0.0),
    ("win_streak_away",           "form",   "Away team current win streak",             0.0),
    ("unbeaten_streak_home",      "form",   "Home team current unbeaten streak",        0.0),
    ("unbeaten_streak_away",      "form",   "Away team current unbeaten streak",        0.0),
    ("goals_per_game_trend",     "form",   "Home team goals-per-game trend",            0.0),
    # ── Head-to-head (4) ────────────────────────────────────────────────
    ("h2h_home_win_pct",          "h2h",    "Home win % in H2H meetings",                0.0),
    ("h2h_away_win_pct",          "h2h",    "Away win % in H2H meetings",                0.0),
    ("h2h_draw_pct",             "h2h",    "Draw % in H2H meetings",                    0.0),
    ("h2h_avg_goals",             "h2h",    "Average total goals in H2H meetings",       0.0),
    # ── Home/away splits (4) ────────────────────────────────────────────
    ("home_win_pct",              "venue",  "Home team home win %",                     0.0),
    ("away_win_pct",              "venue",  "Away team away win %",                     0.0),
    ("home_goals_avg",            "venue",  "Home team avg goals at home",              0.0),
    ("away_goals_avg",            "venue",  "Away team avg goals away",                0.0),
    # ── Market features (4) ─────────────────────────────────────────────
    ("implied_prob_home",         "market", "Market implied probability for home win",   0.0),
    ("implied_prob_draw",         "market", "Market implied probability for draw",       0.0),
    ("implied_prob_away",         "market", "Market implied probability for away win",   0.0),
    ("overround",                 "market", "Bookmaker overround (sum of implied probs)", 0.0),
    # ── Temporal (5) ────────────────────────────────────────────────────
    ("day_of_week",               "temporal","Day of week (0=Mon, 6=Sun)",             0.0),
    ("month",                     "temporal","Month of year (1-12)",                     0.0),
    ("is_weekend",                "temporal","1 if Saturday/Sunday, else 0",             0.0),
    ("days_since_last_match_home","temporal","Days since home team\'s last match",       7.0),
    ("days_since_last_match_away","temporal","Days since away team\'s last match",       7.0),
    # ── Advanced (10) ───────────────────────────────────────────────────
    ("attacking_strength_home",   "advanced","Home attack strength vs league avg",       1.0),
    ("attacking_strength_away",   "advanced","Away attack strength vs league avg",       1.0),
    ("defensive_strength_home",   "advanced","Home defence strength vs league avg",       1.0),
    ("defensive_strength_away",   "advanced","Away defence strength vs league avg",       1.0),
    ("poisson_lambda_home",       "advanced","Poisson lambda for home team",              1.3),
    ("poisson_lambda_away",       "advanced","Poisson lambda for away team",              1.1),
    ("shot_conversion_rate_home", "advanced","Home team shot conversion rate",           0.0),
    ("shot_conversion_rate_away", "advanced","Away team shot conversion rate",           0.0),
    ("clean_sheet_pct_home",     "advanced","Home team clean sheet %",                  0.0),
    ("clean_sheet_pct_away",     "advanced","Away team clean sheet %",                  0.0),
]

# Derived ordered lists
FEATURE_NAMES: list[str] = [f[0] for f in FEATURE_DEFINITIONS]
FEATURE_DEFAULTS: dict[str, float] = {f[0]: f[3] for f in FEATURE_DEFINITIONS}
FEATURE_CATEGORIES: dict[str, str] = {f[0]: f[1] for f in FEATURE_DEFINITIONS}
N_FEATURES: int = len(FEATURE_NAMES)

assert N_FEATURES == 50, f"Expected 50 features, got {N_FEATURES}"

# ── Subset for LSTM sequences (core features suitable for per-match vectors) ──
LSTM_SEQUENCE_FEATURES: list[str] = [
    # Goals (4)
    "avg_goals_scored", "avg_goals_conceded",
    "xg_for_home", "xg_for_away",
    # ELO (2)
    "elo_home", "elo_away",
    # Form (4)
    "last_5_form_points_home", "last_5_form_points_away",
    "win_streak_home", "win_streak_away",
    # Venue (2)
    "home_win_pct", "away_win_pct",
    # Advanced (3)
    "attacking_strength_home", "defensive_strength_home",
    "poisson_lambda_home",
]

N_LSTM_FEATURES: int = len(LSTM_SEQUENCE_FEATURES)
'''

schema_path = os.path.join(PROJECT_ROOT, "src", "ml", "feature_schema.py")
with open(schema_path, "w", encoding="utf-8") as f:
    f.write(CANONICAL_FEATURE_SCHEMA)
print(f"Created {schema_path}")

# ─────────────────────────────────────────────────────────────────────────────
# STEP 2: Patch features.py to import from schema instead of defining its own
# ─────────────────────────────────────────────────────────────────────────────

features_path = os.path.join(PROJECT_ROOT, "src", "ml", "features.py")
with open(features_path, "r", encoding="utf-8") as f:
    content = f.read()

# Replace the inline FEATURE_NAMES list with an import from the schema.
# The old definition starts at line 35 and ends at the assert on line 96.
old_block = '''FEATURE_NAMES: list[str] = [
    # ELO (5)
    "elo_home",
    "elo_away",
    "elo_diff",
    "elo_home_advantage_adjusted",
    "elo_form_trend",
    # Goal features (10)
    "avg_goals_scored_home",
    "avg_goals_scored_away",
    "avg_goals_conceded_home",
    "avg_goals_conceded_away",
    "avg_goals_scored",
    "avg_goals_conceded",
    "goal_difference",
    "xg_for_home",
    "xg_for_away",
    "xg_diff",
    # Form features (8)
    "last_5_form_points_home",
    "last_5_form_points_away",
    "form_points_diff",
    "win_streak_home",
    "win_streak_away",
    "unbeaten_streak_home",
    "unbeaten_streak_away",
    "goals_per_game_trend",
    # Head-to-head (4)
    "h2h_home_win_pct",
    "h2h_away_win_pct",
    "h2h_draw_pct",
    "h2h_avg_goals",
    # Home/away splits (4)
    "home_win_pct",
    "away_win_pct",
    "home_goals_avg",
    "away_goals_avg",
    # Market features (4)
    "implied_prob_home",
    "implied_prob_draw",
    "implied_prob_away",
    "overround",
    # Temporal (5)
    "day_of_week",
    "month",
    "is_weekend",
    "days_since_last_match_home",
    "days_since_last_match_away",
    # Advanced (10)
    "attacking_strength_home",
    "attacking_strength_away",
    "defensive_strength_home",
    "defensive_strength_away",
    "poisson_lambda_home",
    "poisson_lambda_away",
    "shot_conversion_rate_home",
    "shot_conversion_rate_away",
    "clean_sheet_pct_home",
    "clean_sheet_pct_away",
]

assert len(FEATURE_NAMES) == 50, f"Expected 50 features, got {len(FEATURE_NAMES)}"'''

new_block = '''# ═══════════════════════════════════════════════════════════════════════════
# Feature name constants — imported from canonical schema
# ═══════════════════════════════════════════════════════════════════════════
# The canonical feature schema lives in feature_schema.py.
# All components (training, inference, ensemble) MUST use these names.
from src.ml.feature_schema import (  # noqa: E402
    FEATURE_NAMES,
    FEATURE_DEFAULTS,
    FEATURE_CATEGORIES,
    N_FEATURES,
    LSTM_SEQUENCE_FEATURES,
    N_LSTM_FEATURES,
)

# Re-export for backward compatibility with code that imports from features.py
__all__ = [
    "FEATURE_NAMES",
    "FEATURE_DEFAULTS",
    "FEATURE_CATEGORIES",
    "N_FEATURES",
    "LSTM_SEQUENCE_FEATURES",
    "N_LSTM_FEATURES",
    "FeatureEngineer",
]

assert N_FEATURES == 50, f"Expected 50 features, got {N_FEATURES}"'''

if old_block in content:
    content = content.replace(old_block, new_block)
    print("Replaced FEATURE_NAMES in features.py with import from schema")
else:
    print("WARNING: Could not find exact FEATURE_NAMES block in features.py")
    print("Attempting more flexible replacement...")
    # Try line-based replacement
    lines = content.split('\n')
    start_idx = None
    end_idx = None
    for i, line in enumerate(lines):
        if 'FEATURE_NAMES: list[str] = [' in line:
            start_idx = i
        if start_idx and 'assert len(FEATURE_NAMES) == 50' in line:
            end_idx = i
            break
    if start_idx and end_idx:
        lines = lines[:start_idx] + new_block.split('\n') + lines[end_idx + 1:]
        content = '\n'.join(lines)
        print(f"Replaced lines {start_idx}-{end_idx} in features.py")
    else:
        print(f"ERROR: Could not find replacement boundaries (start={start_idx}, end={end_idx})")

with open(features_path, "w", encoding="utf-8") as f:
    f.write(content)
print(f"Updated {features_path}")

# ─────────────────────────────────────────────────────────────────────────────
# STEP 3: Patch ensemble.py _run_xgboost to use correct feature names
# ─────────────────────────────────────────────────────────────────────────────

ensemble_path = os.path.join(PROJECT_ROOT, "src", "engines", "ensemble.py")
with open(ensemble_path, "r", encoding="utf-8") as f:
    ensemble_content = f.read()

# Fix the incorrect feature names used in _run_xgboost
old_xgb_features = '''        # Map to feature names used by the training pipeline
        feature_dict = {
            "home_goals_for_avg": home_avg_goals,
            "away_goals_for_avg": away_avg_goals,
            "home_goals_against_avg": home_avg_conceded,
            "away_goals_against_avg": away_avg_conceded,
            "home_elo_rating": home_elo,
            "away_elo_rating": away_elo,
        }

        # Fill remaining features with defaults
        for fname in FEATURE_NAMES:
            if fname not in feature_dict:
                feature_dict[fname] = 0.0'''

new_xgb_features = '''        # Build feature vector using canonical feature schema
        from src.ml.feature_schema import FEATURE_NAMES, FEATURE_DEFAULTS

        feature_dict = dict(FEATURE_DEFAULTS)  # start with all defaults

        # Override with available match data (using CANONICAL names)
        feature_dict["elo_home"] = home_elo
        feature_dict["elo_away"] = away_elo
        feature_dict["elo_diff"] = home_elo - away_elo
        feature_dict["elo_home_advantage_adjusted"] = home_elo + 65.0  # standard home advantage
        feature_dict["avg_goals_scored_home"] = home_avg_goals
        feature_dict["avg_goals_scored_away"] = away_avg_goals
        feature_dict["avg_goals_conceded_home"] = home_avg_conceded
        feature_dict["avg_goals_conceded_away"] = away_avg_conceded
        feature_dict["avg_goals_scored"] = home_avg_goals
        feature_dict["avg_goals_conceded"] = home_avg_conceded
        feature_dict["poisson_lambda_home"] = (home_avg_goals + away_avg_conceded) / 2.0
        feature_dict["poisson_lambda_away"] = (away_avg_goals + home_avg_conceded) / 2.0

        # Handle optional xG data
        home_xg = match_data.get("home_xg")
        away_xg = match_data.get("away_xg")
        if home_xg is not None:
            feature_dict["xg_for_home"] = float(home_xg)
        if away_xg is not None:
            feature_dict["xg_for_away"] = float(away_xg)

        # Handle optional odds data for market features
        odds_home = match_data.get("odds_home")
        odds_draw = match_data.get("odds_draw")
        odds_away = match_data.get("odds_away")
        if odds_home and odds_draw and odds_away:
            total_implied = 1.0/float(odds_home) + 1.0/float(odds_draw) + 1.0/float(odds_away)
            feature_dict["implied_prob_home"] = (1.0/float(odds_home)) / total_implied
            feature_dict["implied_prob_draw"] = (1.0/float(odds_draw)) / total_implied
            feature_dict["implied_prob_away"] = (1.0/float(odds_away)) / total_implied
            feature_dict["overround"] = total_implied - 1.0'''

if old_xgb_features in ensemble_content:
    ensemble_content = ensemble_content.replace(old_xgb_features, new_xgb_features)
    print("Fixed XGBoost feature names in ensemble.py")
else:
    print("WARNING: Could not find old XGBoost feature block in ensemble.py")

# Also update the import at the top of _run_xgboost to use the schema
old_import = '''        from src.ml.features import FEATURE_NAMES

        # Build feature dict with defaults'''
new_import = '''        from src.ml.feature_schema import FEATURE_NAMES, FEATURE_DEFAULTS

        # Build feature vector using canonical feature schema'''

if old_import in ensemble_content:
    ensemble_content = ensemble_content.replace(old_import, new_import)
    print("Updated import in _run_xgboost")

with open(ensemble_path, "w", encoding="utf-8") as f:
    f.write(ensemble_content)
print(f"Updated {ensemble_path}")

print("\nPhase 1A complete: Canonical feature schema created and integrated.")
