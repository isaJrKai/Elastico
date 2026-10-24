#!/usr/bin/env python3
"""Train and chronologically evaluate a transparent Elo baseline on OpenFootball data.

Data source: https://github.com/openfootball/football.json
Only use seasons/leagues whose repository files and licence you have checked.
This script uses the standard library only. It does not claim betting profitability.
"""
from __future__ import annotations

import argparse
import json
import math
import urllib.request
from collections import Counter
from datetime import date
from pathlib import Path
from typing import Any

BASE_URL = "https://raw.githubusercontent.com/openfootball/football.json/master"
DEFAULT_SEASONS = ["2019-20", "2020-21", "2021-22", "2022-23", "2023-24", "2024-25", "2025-26"]
DEFAULT_LEAGUES = ["en.1", "es.1", "de.1", "it.1", "fr.1"]
K_FACTOR = 20.0
HOME_ADVANTAGE = 65.0
INITIAL_ELO = 1500.0
EPSILON = 1e-12


def fetch_json(url: str, timeout: int = 30) -> dict[str, Any]:
    request = urllib.request.Request(url, headers={"User-Agent": "ELASTICO-baseline-research/1.0"})
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return json.loads(response.read().decode("utf-8"))


def parse_matches(payload: dict[str, Any], league: str, season: str) -> list[dict[str, Any]]:
    result = []
    for item in payload.get("matches", []):
        try:
            match_date = date.fromisoformat(str(item["date"])[:10])
            home = str(item["team1"]).strip()
            away = str(item["team2"]).strip()
            full_time = item["score"]["ft"]
            hg, ag = int(full_time[0]), int(full_time[1])
            if not home or not away or hg < 0 or ag < 0 or home == away:
                continue
        except (KeyError, TypeError, ValueError, IndexError):
            continue
        result.append({"date": match_date.isoformat(), "home": home, "away": away,
                       "home_goals": hg, "away_goals": ag, "league": league, "season": season})
    return result


def load_dataset(seasons: list[str], leagues: list[str], cache: Path) -> list[dict[str, Any]]:
    cache.mkdir(parents=True, exist_ok=True)
    matches: list[dict[str, Any]] = []
    errors: list[str] = []
    for season in seasons:
        for league in leagues:
            url = f"{BASE_URL}/{season}/{league}.json"
            cache_file = cache / f"{season}_{league}.json"
            try:
                if cache_file.exists():
                    payload = json.loads(cache_file.read_text(encoding="utf-8"))
                else:
                    payload = fetch_json(url)
                    cache_file.write_text(json.dumps(payload), encoding="utf-8")
                matches.extend(parse_matches(payload, league, season))
            except Exception as exc:  # missing season files are reported, not silently treated as data
                errors.append(f"{url}: {type(exc).__name__}: {exc}")
    if errors:
        print("Dataset source warnings:")
        for error in errors:
            print(f"  - {error}")
    deduped = {}
    for match in matches:
        key = (match["date"], match["league"], match["home"], match["away"])
        deduped[key] = match
    return sorted(deduped.values(), key=lambda m: (m["date"], m["league"], m["home"], m["away"]))


def probabilities(home_elo: float, away_elo: float, draw_probability: float) -> list[float]:
    expected_home_score = 1.0 / (1.0 + 10.0 ** (-((home_elo + HOME_ADVANTAGE) - away_elo) / 400.0))
    remaining = 1.0 - draw_probability
    home = remaining * expected_home_score
    away = remaining * (1.0 - expected_home_score)
    return [max(EPSILON, home), max(EPSILON, draw_probability), max(EPSILON, away)]


def outcome_index(match: dict[str, Any]) -> int:
    if match["home_goals"] > match["away_goals"]:
        return 0
    if match["home_goals"] == match["away_goals"]:
        return 1
    return 2


def score_prediction(probs: list[float], actual: int) -> dict[str, float | int]:
    total = sum(probs)
    probs = [p / total for p in probs]
    log_loss = -math.log(max(EPSILON, probs[actual]))
    brier = sum((p - (1.0 if i == actual else 0.0)) ** 2 for i, p in enumerate(probs))
    return {"log_loss": log_loss, "brier": brier, "correct": int(max(range(3), key=lambda i: probs[i]) == actual)}


def evaluate(matches: list[dict[str, Any]], output_dir: Path) -> dict[str, Any]:
    if len(matches) < 100:
        raise SystemExit(f"Need at least 100 valid matches; found {len(matches)}. Check data availability.")
    # Split on unique dates, not rows, so fixtures played on the same date
    # cannot land on both sides of the train/test boundary.
    unique_dates = sorted({match["date"] for match in matches})
    date_cutoff_index = max(1, min(len(unique_dates) - 1, int(len(unique_dates) * 0.8)))
    cutoff_date = unique_dates[date_cutoff_index]
    train = [match for match in matches if match["date"] < cutoff_date]
    test = [match for match in matches if match["date"] >= cutoff_date]
    train_draw_rate = sum(outcome_index(m) == 1 for m in train) / len(train)
    draw_probability = min(0.40, max(0.10, train_draw_rate))
    ratings: dict[tuple[str, str], float] = {}

    def rating_for(match: dict[str, Any], side: str) -> tuple[str, str]:
        return (match["league"], match[side])

    for match in train:
        home_key, away_key = rating_for(match, "home"), rating_for(match, "away")
        home_elo, away_elo = ratings.get(home_key, INITIAL_ELO), ratings.get(away_key, INITIAL_ELO)
        expected = 1.0 / (1.0 + 10.0 ** (-((home_elo + HOME_ADVANTAGE) - away_elo) / 400.0))
        actual = 1.0 if match["home_goals"] > match["away_goals"] else (0.5 if match["home_goals"] == match["away_goals"] else 0.0)
        ratings[home_key] = home_elo + K_FACTOR * (actual - expected)
        ratings[away_key] = away_elo + K_FACTOR * ((1.0 - actual) - (1.0 - expected))

    totals = {"log_loss": 0.0, "brier": 0.0, "correct": 0}
    baseline_totals = {"log_loss": 0.0, "brier": 0.0, "correct": 0}
    train_counts = Counter(outcome_index(m) for m in train)
    baseline = [(train_counts[i] + 1) / (len(train) + 3) for i in range(3)]
    predictions = []
    # Predict every match on a date from the same start-of-day ratings. Results
    # from that date update Elo only after all predictions for that date are made.
    test_by_date: dict[str, list[dict[str, Any]]] = {}
    for match in test:
        test_by_date.setdefault(match["date"], []).append(match)
    for match_date in sorted(test_by_date):
        day_matches = test_by_date[match_date]
        day_updates = []
        for match in day_matches:
            home_key, away_key = rating_for(match, "home"), rating_for(match, "away")
            home_elo, away_elo = ratings.get(home_key, INITIAL_ELO), ratings.get(away_key, INITIAL_ELO)
            probs = probabilities(home_elo, away_elo, draw_probability)
            actual = outcome_index(match)
            score = score_prediction(probs, actual)
            base_score = score_prediction(baseline, actual)
            for key in totals:
                totals[key] += score[key]
                baseline_totals[key] += base_score[key]
            predictions.append({
                "date": match["date"], "league": match["league"], "home": match["home"], "away": match["away"],
                "actual": ["home", "draw", "away"][actual],
                "probabilities": {"home": probs[0], "draw": probs[1], "away": probs[2]},
                "elo": {"home": home_elo, "away": away_elo},
            })
            expected = 1.0 / (1.0 + 10.0 ** (-((home_elo + HOME_ADVANTAGE) - away_elo) / 400.0))
            actual_score = 1.0 if match["home_goals"] > match["away_goals"] else (0.5 if match["home_goals"] == match["away_goals"] else 0.0)
            day_updates.append((home_key, away_key, home_elo, away_elo, expected, actual_score))
        for home_key, away_key, home_elo, away_elo, expected, actual_score in day_updates:
            ratings[home_key] = home_elo + K_FACTOR * (actual_score - expected)
            ratings[away_key] = away_elo + K_FACTOR * ((1.0 - actual_score) - (1.0 - expected))
    n = len(test)
    def summarize(values: dict[str, float]) -> dict[str, float]:
        return {
            "log_loss": values["log_loss"] / n,
            "multiclass_brier_score": values["brier"] / n,
            "accuracy": values["correct"] / n,
        }

    metrics = {
        "dataset": "OpenFootball football.json",
        "datasetLicenceNote": "Verify the current repository licence and each file before commercial use.",
        "trainMatches": len(train), "testMatches": n,
        "trainDateRange": [train[0]["date"], train[-1]["date"]],
        "testDateRange": [test[0]["date"], test[-1]["date"]],
        "drawProbabilityEstimatedFromTrainingOnly": draw_probability,
        "elo": summarize(totals),
        "trainingFrequencyBaseline": summarize(baseline_totals),
        "note": "Chronological 80/20 split with sequential rating updates. This is a baseline evaluation, not evidence of betting profitability or a trained ML model.",
    }
    output_dir.mkdir(parents=True, exist_ok=True)
    (output_dir / "metrics.json").write_text(json.dumps(metrics, indent=2), encoding="utf-8")
    (output_dir / "holdout_predictions.json").write_text(json.dumps(predictions, indent=2), encoding="utf-8")
    (output_dir / "elo_ratings.json").write_text(json.dumps([
        {"league": league, "team": team, "rating": round(rating, 2)}
        for (league, team), rating in sorted(ratings.items())
    ], indent=2), encoding="utf-8")
    return metrics


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--seasons", nargs="+", default=DEFAULT_SEASONS)
    parser.add_argument("--leagues", nargs="+", default=DEFAULT_LEAGUES)
    parser.add_argument("--cache", type=Path, default=Path("data/openfootball-cache"))
    parser.add_argument("--output", type=Path, default=Path("artifacts/openfootball-elo"))
    args = parser.parse_args()
    matches = load_dataset(args.seasons, args.leagues, args.cache)
    print(f"Loaded {len(matches)} unique completed matches.")
    if not matches:
        raise SystemExit("No matches loaded. Verify dataset URLs/network and retry.")
    metrics = evaluate(matches, args.output)
    print(json.dumps(metrics, indent=2))


if __name__ == "__main__":
    main()
