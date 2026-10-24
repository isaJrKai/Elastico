#!/usr/bin/env python3
"""Diagnostic comparison against the CC-BY-4.0 TipsAudit fair-probability dataset.

This is an overlap-only diagnostic, not a representative market benchmark: the
source contains logged predictions rather than an exhaustive fixture universe.
Small samples must not be used to claim a betting edge.
"""
from __future__ import annotations

import csv
import json
import math
import re
import urllib.request
from datetime import datetime
from pathlib import Path
from typing import Any

from train_openfootball_baseline import outcome_index, score_prediction

CSV_URL = "https://tipsaudit.com/data/tipsaudit-predictions.csv"
EPSILON = 1e-12


def normalize_team(value: str) -> str:
    text = value.lower().strip()
    text = re.sub(r"\b(fc|cf|afc|sc|ac|club|football club)\b", "", text)
    return re.sub(r"[^a-z0-9]", "", text)


def parse_probability(value: str) -> float | None:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    if not math.isfinite(number) or number < 0:
        return None
    if number > 1:
        number /= 100.0
    return number if number <= 1 else None


def metrics_for(rows: list[tuple[list[float], int]]) -> dict[str, float | int]:
    if not rows:
        return {"matches": 0, "log_loss": 0.0, "multiclass_brier_score": 0.0, "accuracy": 0.0}
    totals = {"log_loss": 0.0, "brier": 0.0, "correct": 0.0}
    for probs, actual in rows:
        scored = score_prediction(probs, actual)
        totals["log_loss"] += float(scored["log_loss"])
        totals["brier"] += float(scored["brier"])
        totals["correct"] += float(scored["correct"])
    n = len(rows)
    return {
        "matches": n,
        "log_loss": totals["log_loss"] / n,
        "multiclass_brier_score": totals["brier"] / n,
        "accuracy": totals["correct"] / n,
    }


def main() -> None:
    parser_output = Path("artifacts/openfootball-market-comparison")
    elo_path = Path("artifacts/openfootball-elo/holdout_predictions.json")
    poisson_path = Path("artifacts/openfootball-poisson/holdout_predictions.json")
    parser_output.mkdir(parents=True, exist_ok=True)

    if not elo_path.exists() or not poisson_path.exists():
        raise SystemExit("Run Elo and Poisson training steps before the market comparison.")

    elo_predictions = json.loads(elo_path.read_text(encoding="utf-8"))
    poisson_predictions = json.loads(poisson_path.read_text(encoding="utf-8"))

    def index_predictions(items: list[dict[str, Any]]) -> dict[tuple[str, str, str], dict[str, Any]]:
        indexed = {}
        for item in items:
            key = (item["date"][:10], normalize_team(item["home"]), normalize_team(item["away"]))
            indexed[key] = item
        return indexed

    elo_by_key = index_predictions(elo_predictions)
    poisson_by_key = index_predictions(poisson_predictions)
    request = urllib.request.Request(CSV_URL, headers={"User-Agent": "ELASTICO-market-benchmark/1.0"})
    try:
        with urllib.request.urlopen(request, timeout=45) as response:
            rows = response.read().decode("utf-8-sig").splitlines()
    except Exception as exc:
        result = {
            "status": "source-unavailable",
            "source": CSV_URL,
            "error": f"{type(exc).__name__}: {exc}",
            "note": "No market comparison was performed. Do not treat unavailable market data as a pass.",
        }
        (parser_output / "metrics.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
        print(json.dumps(result, indent=2))
        return

    reader = csv.DictReader(rows)
    elo_pairs: list[tuple[list[float], int]] = []
    poisson_pairs: list[tuple[list[float], int]] = []
    market_pairs: list[tuple[list[float], int]] = []
    matched_keys: set[tuple[str, str, str]] = set()
    for row in reader:
        kickoff = (row.get("kickoff_utc") or "").strip()
        home = (row.get("home") or "").strip()
        away = (row.get("away") or "").strip()
        if not kickoff or not home or not away:
            continue
        try:
            match_date = datetime.fromisoformat(kickoff.replace("Z", "+00:00")).date().isoformat()
        except ValueError:
            match_date = kickoff[:10]
        key = (match_date, normalize_team(home), normalize_team(away))
        elo_match = elo_by_key.get(key)
        poisson_match = poisson_by_key.get(key)
        if not elo_match or not poisson_match:
            continue
        fair = [
            parse_probability(row.get("fair_prob_home", "")),
            parse_probability(row.get("fair_prob_draw", "")),
            parse_probability(row.get("fair_prob_away", "")),
        ]
        if any(value is None for value in fair):
            continue
        market_probs = [float(value) for value in fair if value is not None]
        total = sum(market_probs)
        if total <= 0:
            continue
        market_probs = [p / total for p in market_probs]
        actual_name = elo_match["actual"]
        actual = {"home": 0, "draw": 1, "away": 2}.get(actual_name)
        if actual is None or poisson_match["actual"] != actual_name:
            continue
        elo_probs = [elo_match["probabilities"][k] for k in ("home", "draw", "away")]
        poisson_probs = [poisson_match["probabilities"][k] for k in ("home", "draw", "away")]
        elo_pairs.append((elo_probs, actual))
        poisson_pairs.append((poisson_probs, actual))
        market_pairs.append((market_probs, actual))
        matched_keys.add(key)

    result = {
        "status": "evaluated" if len(matched_keys) >= 50 else "insufficient-overlap",
        "source": CSV_URL,
        "license": "CC-BY-4.0; attribute TipsAudit and link https://tipsaudit.com/data",
        "sourceRowsMatched": len(matched_keys),
        "elo": metrics_for(elo_pairs),
        "poisson": metrics_for(poisson_pairs),
        "marketFairProbabilities": metrics_for(market_pairs),
        "testWindow": {
            "eloStart": min((item["date"] for item in elo_predictions), default=None),
            "eloEnd": max((item["date"] for item in elo_predictions), default=None),
        },
        "limitations": [
            "TipsAudit is a logged-prediction dataset, not an exhaustive sample of all fixtures; selection bias is possible.",
            "Only exact date/home/away overlaps are evaluated; team-name aliases can reduce matched coverage.",
            "At least 50 matches are required for the status to be evaluated; larger independent samples are preferred.",
            "Market fair probabilities are a diagnostic reference and do not prove executable odds or profitability.",
        ],
    }
    (parser_output / "metrics.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
