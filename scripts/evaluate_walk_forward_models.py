#!/usr/bin/env python3
"""Leakage-aware walk-forward evaluation for football 1X2 models.

Supports the common football-data.co.uk CSV schema (Date, Div, HomeTeam,
AwayTeam, FTHG, FTAG, FTR) and compatible CSV exports. Standard library only.

Models compared:
  * Elo: rating-difference logistic win probability with a draw probability
    estimated only from prior matches in the same competition.
  * Rolling Poisson: attack/defence goal rates from prior matches only.
  * Dixon-Coles: rolling Poisson score matrix with low-score correlation
    correction (rho fixed to -0.08 for this baseline, not fitted).
  * Equal-weight Elo + Dixon-Coles blend.

This is a baseline evaluator, not a claim of production-ready model superiority.
Use chronologically ordered predictions; never shuffle matches before evaluation.
"""
from __future__ import annotations

import argparse
import csv
import json
import math
import sys
from collections import defaultdict, deque
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Iterable

OUTCOMES = ("H", "D", "A")
RHO = -0.08
ELO_K = 20.0
HOME_ADVANTAGE = 60.0
ROLLING_N = 10


@dataclass(frozen=True)
class Match:
    date: datetime
    league: str
    home: str
    away: str
    hg: int
    ag: int
    result: str


def parse_date(value: str) -> datetime:
    value = (value or "").strip()
    for fmt in ("%d/%m/%y", "%d/%m/%Y", "%Y-%m-%d", "%Y-%m-%d %H:%M:%S"):
        try:
            d = datetime.strptime(value, fmt)
            if d.year < 100:
                d = d.replace(year=2000 + d.year if d.year < 70 else 1900 + d.year)
            return d
        except ValueError:
            pass
    raise ValueError(f"Unsupported or missing date: {value!r}")


def first(row: dict[str, str], *names: str) -> str:
    for name in names:
        if name in row and row[name] is not None and str(row[name]).strip() != "":
            return str(row[name]).strip()
    return ""


def load_matches(paths: Iterable[Path]) -> list[Match]:
    matches: list[Match] = []
    for path in paths:
        with path.open("r", encoding="utf-8-sig", newline="") as handle:
            reader = csv.DictReader(handle)
            if not reader.fieldnames:
                continue
            for line, row in enumerate(reader, start=2):
                try:
                    home = first(row, "HomeTeam", "home_team", "homeTeam")
                    away = first(row, "AwayTeam", "away_team", "awayTeam")
                    hg_s = first(row, "FTHG", "home_goals", "homeScore")
                    ag_s = first(row, "FTAG", "away_goals", "awayScore")
                    if not home or not away or not hg_s or not ag_s:
                        continue
                    hg, ag = int(float(hg_s)), int(float(ag_s))
                    if hg < 0 or ag < 0:
                        continue
                    result = "H" if hg > ag else "A" if hg < ag else "D"
                    declared = first(row, "FTR", "result")
                    if declared in OUTCOMES and declared != result:
                        raise ValueError("FTR disagrees with full-time scores")
                    matches.append(Match(
                        parse_date(first(row, "Date", "date", "utcDate")),
                        first(row, "Div", "League", "league", "competition") or path.stem,
                        home, away, hg, ag, result,
                    ))
                except (ValueError, TypeError) as exc:
                    # Bad rows are excluded, but visible in stderr for auditability.
                    print(f"[skip] {path}:{line}: {exc}", file=sys.stderr)
    # Stable sort ensures chronological walk-forward even when files are mixed.
    matches.sort(key=lambda m: (m.date, m.league, m.home, m.away))
    # Remove exact duplicates (same competition, date, teams, score).
    seen: set[tuple] = set()
    unique = []
    for m in matches:
        key = (m.date.date(), m.league, m.home, m.away, m.hg, m.ag)
        if key not in seen:
            seen.add(key)
            unique.append(m)
    return unique


def poisson_pmf(k: int, lam: float) -> float:
    if lam <= 0:
        return 1.0 if k == 0 else 0.0
    return math.exp(-lam + k * math.log(lam) - math.lgamma(k + 1))


def dc_probabilities(lam_h: float, lam_a: float, rho: float = RHO, max_goals: int = 10) -> list[float]:
    """Return normalized [home, draw, away] probabilities from a DC score matrix."""
    p_h = p_d = p_a = 0.0
    total = 0.0
    for h in range(max_goals + 1):
        ph = poisson_pmf(h, lam_h)
        for a in range(max_goals + 1):
            pa = poisson_pmf(a, lam_a)
            tau = 1.0
            if h == 0 and a == 0:
                tau = 1 - lam_h * lam_a * rho
            elif h == 0 and a == 1:
                tau = 1 + lam_h * rho
            elif h == 1 and a == 0:
                tau = 1 + lam_a * rho
            elif h == 1 and a == 1:
                tau = 1 - rho
            weight = max(0.0, ph * pa * tau)
            total += weight
            if h > a:
                p_h += weight
            elif h == a:
                p_d += weight
            else:
                p_a += weight
    if total <= 0:
        return [1 / 3, 1 / 3, 1 / 3]
    return [p_h / total, p_d / total, p_a / total]


def elo_probabilities(home_elo: float, away_elo: float, draw_rate: float) -> list[float]:
    # Expected score uses conventional Elo logistic transform; draw mass is
    # estimated from prior matches only and distributed by relative strength.
    expected = 1 / (1 + 10 ** (-((home_elo + HOME_ADVANTAGE) - away_elo) / 400))
    draw = min(0.40, max(0.12, draw_rate))
    home = (1 - draw) * expected
    away = (1 - draw) * (1 - expected)
    return [home, draw, away]


def safe_normalize(p: list[float]) -> list[float]:
    p = [max(1e-9, float(x)) for x in p]
    s = sum(p)
    return [x / s for x in p]


def score_rows(rows: list[tuple[str, list[float], str]]) -> dict:
    if not rows:
        return {"n": 0, "log_loss": None, "brier": None, "accuracy": None}
    index = {label: i for i, label in enumerate(OUTCOMES)}
    losses, briers, correct = [], [], 0
    for actual, probs, _ in rows:
        probs = safe_normalize(probs)
        losses.append(-math.log(max(1e-15, probs[index[actual]])))
        briers.append(sum((probs[i] - (1.0 if i == index[actual] else 0.0)) ** 2 for i in range(3)))
        correct += OUTCOMES[max(range(3), key=lambda i: probs[i])] == actual
    return {
        "n": len(rows),
        "log_loss": round(sum(losses) / len(losses), 6),
        "brier": round(sum(briers) / len(briers), 6),
        "accuracy": round(correct / len(rows), 6),
    }


def evaluate(matches: list[Match], min_history: int, min_league_history: int) -> dict:
    ratings: dict[tuple[str, str], float] = defaultdict(lambda: 1500.0)
    goals_for: dict[tuple[str, str], deque[int]] = defaultdict(lambda: deque(maxlen=ROLLING_N))
    goals_against: dict[tuple[str, str], deque[int]] = defaultdict(lambda: deque(maxlen=ROLLING_N))
    league_history: dict[str, list[Match]] = defaultdict(list)
    predictions: dict[str, list[tuple[str, list[float], str]]] = defaultdict(list)
    skipped = 0

    for m in matches:
        hist = league_history[m.league]
        if len(hist) >= min_league_history and len(goals_for[(m.league, m.home)]) >= min_history and len(goals_for[(m.league, m.away)]) >= min_history:
            prior_draw_rate = sum(x.result == "D" for x in hist) / len(hist)
            elo = elo_probabilities(ratings[(m.league, m.home)], ratings[(m.league, m.away)], prior_draw_rate)
            # Smoothed league-only frequency baseline, computed strictly from prior results.
            prior_counts = [sum(x.result == outcome for x in hist) for outcome in OUTCOMES]
            frequency = safe_normalize([count + 1.0 for count in prior_counts])
            league_home = sum(x.hg for x in hist) / len(hist)
            league_away = sum(x.ag for x in hist) / len(hist)
            home_att = sum(goals_for[(m.league, m.home)]) / len(goals_for[(m.league, m.home)])
            home_def = sum(goals_against[(m.league, m.home)]) / len(goals_against[(m.league, m.home)])
            away_att = sum(goals_for[(m.league, m.away)]) / len(goals_for[(m.league, m.away)])
            away_def = sum(goals_against[(m.league, m.away)]) / len(goals_against[(m.league, m.away)])
            lam_h = max(0.15, min(4.5, league_home * (home_att / max(0.1, league_home)) * (away_def / max(0.1, league_home))))
            lam_a = max(0.15, min(4.5, league_away * (away_att / max(0.1, league_away)) * (home_def / max(0.1, league_away))))
            dc = dc_probabilities(lam_h, lam_a)
            blend = safe_normalize([(elo[i] + dc[i]) / 2 for i in range(3)])
            predictions["league_frequency"].append((m.result, frequency, m.league))
            predictions["elo"].append((m.result, elo, m.league))
            predictions["dixon_coles"].append((m.result, dc, m.league))
            predictions["blend_elo_dixon_coles"].append((m.result, blend, m.league))
        else:
            skipped += 1

        # Update ratings and rolling goal features only AFTER scoring this match.
        home_key, away_key = (m.league, m.home), (m.league, m.away)
        home_r, away_r = ratings[home_key], ratings[away_key]
        actual_score = 1.0 if m.result == "H" else 0.5 if m.result == "D" else 0.0
        expected_score = 1 / (1 + 10 ** (-((home_r + HOME_ADVANTAGE) - away_r) / 400))
        delta = ELO_K * (actual_score - expected_score)
        ratings[home_key] = home_r + delta
        ratings[away_key] = away_r - delta
        goals_for[home_key].append(m.hg)
        goals_against[home_key].append(m.ag)
        goals_for[away_key].append(m.ag)
        goals_against[away_key].append(m.hg)
        hist.append(m)

    overall = {name: score_rows(rows) for name, rows in predictions.items()}
    per_league = {}
    leagues = sorted({league for rows in predictions.values() for _, _, league in rows})
    for league in leagues:
        per_league[league] = {
            name: score_rows([row for row in rows if row[2] == league])
            for name, rows in predictions.items()
        }
    return {
        "methodology": {
            "walk_forward": True,
            "elo_k": ELO_K,
            "home_advantage_elo_points": HOME_ADVANTAGE,
            "rolling_team_match_window": ROLLING_N,
            "dixon_coles_rho": RHO,
            "min_team_history": min_history,
            "min_league_history": min_league_history,
            "note": "Baseline-only; rho and hyperparameters are not fitted. No odds/profit claims.",
            "league_frequency_smoothing": "Laplace +1 over prior home/draw/away outcomes only.",
        },
        "dataset": {
            "matches_loaded": len(matches),
            "date_start": matches[0].date.date().isoformat() if matches else None,
            "date_end": matches[-1].date.date().isoformat() if matches else None,
            "leagues": sorted({m.league for m in matches}),
            "scored_matches": next(iter(overall.values()))["n"] if overall else 0,
            "warmup_skipped": skipped,
        },
        "overall": overall,
        "per_league": per_league,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("csv", nargs="+", type=Path, help="CSV files (supports football-data.co.uk columns)")
    parser.add_argument("--min-history", type=int, default=5, help="minimum prior matches per team (default: 5)")
    parser.add_argument("--min-league-history", type=int, default=30, help="minimum prior league matches (default: 30)")
    parser.add_argument("--output", type=Path, help="write JSON report to this path (default: stdout)")
    args = parser.parse_args()
    if args.min_history < 1 or args.min_league_history < 1:
        parser.error("history thresholds must be positive")
    try:
        matches = load_matches(args.csv)
    except OSError as exc:
        print(f"Could not read input: {exc}", file=sys.stderr)
        return 2
    if not matches:
        print("No usable matches found; verify CSV schema and paths.", file=sys.stderr)
        return 2
    report = evaluate(matches, args.min_history, args.min_league_history)
    rendered = json.dumps(report, indent=2, ensure_ascii=False)
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(rendered + "\n", encoding="utf-8")
    else:
        print(rendered)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
