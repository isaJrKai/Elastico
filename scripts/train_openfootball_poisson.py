#!/usr/bin/env python3
"""Fit a regularized team-attack/defence Poisson model on OpenFootball results.

Uses scipy/numpy for maximum-likelihood fitting. Evaluates on a chronological,
date-grouped holdout; all fixtures on a date share start-of-day information.
This is research output, not proof of betting profitability.
"""
from __future__ import annotations

import argparse
import json
import math
from collections import Counter
from pathlib import Path
from typing import Any

import numpy as np
from scipy.optimize import minimize

from train_openfootball_baseline import (
    DEFAULT_LEAGUES,
    DEFAULT_SEASONS,
    evaluate as evaluate_elo,
    load_dataset,
    outcome_index,
    score_prediction,
)

EPSILON = 1e-12
MAX_GOALS = 10
REGULARIZATION = 0.05


def split_by_date(matches: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    dates = sorted({match["date"] for match in matches})
    if len(dates) < 2:
        raise ValueError("At least two distinct match dates are required.")
    cutoff_index = max(1, min(len(dates) - 1, int(len(dates) * 0.8)))
    cutoff_date = dates[cutoff_index]
    train = [match for match in matches if match["date"] < cutoff_date]
    test = [match for match in matches if match["date"] >= cutoff_date]
    if not train or not test:
        raise ValueError("Chronological split produced an empty train or test set.")
    return train, test


def fit_league(matches: list[dict[str, Any]]) -> dict[str, Any]:
    teams = sorted({m["home"] for m in matches} | {m["away"] for m in matches})
    if len(teams) < 4 or len(matches) < 50:
        raise ValueError(f"Insufficient league data: {len(teams)} teams, {len(matches)} matches")
    index = {team: i for i, team in enumerate(teams)}
    n_teams = len(teams)
    home_idx = np.array([index[m["home"]] for m in matches], dtype=np.int64)
    away_idx = np.array([index[m["away"]] for m in matches], dtype=np.int64)
    home_goals = np.array([m["home_goals"] for m in matches], dtype=np.float64)
    away_goals = np.array([m["away_goals"] for m in matches], dtype=np.float64)

    initial = np.zeros(2 * n_teams + 2, dtype=np.float64)
    initial[-2] = math.log(max(0.2, float(home_goals.mean())))
    initial[-1] = math.log(max(0.2, float(away_goals.mean())))

    def unpack(theta: np.ndarray) -> tuple[np.ndarray, np.ndarray, float, float]:
        attack = theta[:n_teams] - np.mean(theta[:n_teams])
        defence = theta[n_teams:2 * n_teams] - np.mean(theta[n_teams:2 * n_teams])
        return attack, defence, float(theta[-2]), float(theta[-1])

    def objective(theta: np.ndarray) -> float:
        attack, defence, home_base, away_base = unpack(theta)
        log_home = np.clip(home_base + attack[home_idx] - defence[away_idx], -3.0, 2.0)
        log_away = np.clip(away_base + attack[away_idx] - defence[home_idx], -3.0, 2.0)
        home_lambda = np.exp(log_home)
        away_lambda = np.exp(log_away)
        # Independent Poisson negative log likelihood; factorial terms retained for reporting consistency.
        nll = np.sum(home_lambda - home_goals * log_home + np.array([math.lgamma(g + 1) for g in home_goals]))
        nll += np.sum(away_lambda - away_goals * log_away + np.array([math.lgamma(g + 1) for g in away_goals]))
        nll += REGULARIZATION * (np.sum(attack ** 2) + np.sum(defence ** 2))
        return float(nll)

    result = minimize(objective, initial, method="L-BFGS-B", options={"maxiter": 800, "ftol": 1e-9})
    if not result.success and not np.isfinite(result.fun):
        raise RuntimeError(f"Poisson fit failed: {result.message}")
    attack, defence, home_base, away_base = unpack(result.x)
    return {
        "teams": {
            team: {"attack": float(attack[index[team]]), "defence": float(defence[index[team]])}
            for team in teams
        },
        "homeBaseGoals": float(math.exp(home_base)),
        "awayBaseGoals": float(math.exp(away_base)),
        "trainingMatches": len(matches),
        "trainingDateRange": [matches[0]["date"], matches[-1]["date"]],
        "optimizer": str(result.message),
        "objective": float(result.fun),
    }


def poisson_pmf(lam: float, max_goals: int = MAX_GOALS) -> list[float]:
    values = [math.exp(-lam)]
    for goals in range(1, max_goals + 1):
        values.append(values[-1] * lam / goals)
    return values


def predict_1x2(model: dict[str, Any], home: str, away: str) -> list[float]:
    home_team = model["teams"].get(home, {"attack": 0.0, "defence": 0.0})
    away_team = model["teams"].get(away, {"attack": 0.0, "defence": 0.0})
    home_lambda = max(0.05, min(6.0, model["homeBaseGoals"] * math.exp(home_team["attack"] - away_team["defence"])))
    away_lambda = max(0.05, min(6.0, model["awayBaseGoals"] * math.exp(away_team["attack"] - home_team["defence"])))
    home_pmf, away_pmf = poisson_pmf(home_lambda), poisson_pmf(away_lambda)
    probs = [0.0, 0.0, 0.0]
    for hg, hp in enumerate(home_pmf):
        for ag, ap in enumerate(away_pmf):
            if hg > ag:
                probs[0] += hp * ap
            elif hg == ag:
                probs[1] += hp * ap
            else:
                probs[2] += hp * ap
    total = sum(probs)
    return [max(EPSILON, p / total) for p in probs]


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--seasons", nargs="+", default=DEFAULT_SEASONS)
    parser.add_argument("--leagues", nargs="+", default=DEFAULT_LEAGUES)
    parser.add_argument("--cache", type=Path, default=Path("data/openfootball-cache"))
    parser.add_argument("--output", type=Path, default=Path("artifacts/openfootball-poisson"))
    parser.add_argument("--elo-output", type=Path, default=Path("artifacts/openfootball-elo"))
    args = parser.parse_args()

    matches = load_dataset(args.seasons, args.leagues, args.cache)
    print(f"Loaded {len(matches)} unique completed matches.")
    if len(matches) < 100:
        raise SystemExit("Insufficient dataset coverage to fit/evaluate the model.")
    train, test = split_by_date(matches)
    league_names = sorted({m["league"] for m in train})
    models: dict[str, Any] = {}
    for league in league_names:
        league_train = [m for m in train if m["league"] == league]
        try:
            models[league] = fit_league(league_train)
        except ValueError as exc:
            print(f"Skipping {league}: {exc}")

    if not models:
        raise SystemExit("No league models could be fitted.")
    metrics = {"log_loss": 0.0, "multiclass_brier_score": 0.0, "accuracy": 0.0}
    predictions = []
    evaluated = 0
    for match in test:
        model = models.get(match["league"])
        if model is None:
            continue
        probs = predict_1x2(model, match["home"], match["away"])
        actual = outcome_index(match)
        score = score_prediction(probs, actual)
        metrics["log_loss"] += float(score["log_loss"])
        metrics["multiclass_brier_score"] += float(score["brier"])
        metrics["accuracy"] += float(score["correct"])
        predictions.append({
            "date": match["date"], "league": match["league"], "home": match["home"], "away": match["away"],
            "actual": ["home", "draw", "away"][actual],
            "probabilities": {"home": probs[0], "draw": probs[1], "away": probs[2]},
        })
        evaluated += 1
    if evaluated == 0:
        raise SystemExit("No holdout fixtures matched fitted league models.")
    metrics = {key: value / evaluated for key, value in metrics.items()}

    # Run Elo on the same dataset/split for a like-for-like benchmark.
    elo_metrics = evaluate_elo(matches, args.elo_output)
    result = {
        "dataset": "OpenFootball football.json",
        "trainMatches": len(train),
        "testMatchesAvailable": len(test),
        "testMatchesEvaluated": evaluated,
        "trainDateRange": [train[0]["date"], train[-1]["date"]],
        "testDateRange": [test[0]["date"], test[-1]["date"]],
        "poisson": metrics,
        "elo": elo_metrics["elo"],
        "trainingFrequencyBaseline": elo_metrics["trainingFrequencyBaseline"],
        "regularization": REGULARIZATION,
        "note": "Regularized team attack/defence Poisson model fit only on the chronological training period. Holdout fixtures are never used to fit parameters. No market-odds comparison or profit claim is made.",
    }
    args.output.mkdir(parents=True, exist_ok=True)
    (args.output / "metrics.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
    (args.output / "holdout_predictions.json").write_text(json.dumps(predictions, indent=2), encoding="utf-8")
    model_artifact = {
        "model": "regularized-team-attack-defence-poisson",
        "trainedThroughDate": train[-1]["date"],
        "latestDatasetDate": matches[-1]["date"],
        "trainingMatches": len(train),
        "leagues": models,
        "limitations": [
            "No xG, player availability, lineups, weather, or bookmaker odds are used.",
            "Teams absent from training receive league-average attack/defence effects.",
            "This research artifact is not automatically deployed to production.",
        ],
    }
    (args.output / "trained_poisson_model.json").write_text(json.dumps(model_artifact, indent=2), encoding="utf-8")
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
