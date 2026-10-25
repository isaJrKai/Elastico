import importlib.util
import tempfile
import unittest
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[1] / "evaluate_walk_forward_models.py"
SPEC = importlib.util.spec_from_file_location("walk_forward", SCRIPT)
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC and SPEC.loader
SPEC.loader.exec_module(MODULE)


class WalkForwardEvaluatorTests(unittest.TestCase):
    def test_dixon_coles_probabilities_are_normalized(self):
        probs = MODULE.dc_probabilities(1.4, 1.1)
        self.assertEqual(len(probs), 3)
        self.assertTrue(all(0 <= p <= 1 for p in probs))
        self.assertAlmostEqual(sum(probs), 1.0, places=10)

    def test_safe_normalize_handles_invalid_zero_vector(self):
        probs = MODULE.safe_normalize([0, 0, 0])
        self.assertAlmostEqual(sum(probs), 1.0, places=10)
        self.assertTrue(all(p > 0 for p in probs))

    def test_csv_rows_are_sorted_and_exact_duplicates_removed(self):
        sample = (
            "Div,Date,HomeTeam,AwayTeam,FTHG,FTAG,FTR\n"
            "UG1,02/01/24,Alpha,Beta,2,0,H\n"
            "UG1,01/01/24,Beta,Gamma,1,1,D\n"
            "UG1,02/01/24,Alpha,Beta,2,0,H\n"
        )
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "matches.csv"
            path.write_text(sample, encoding="utf-8")
            matches = MODULE.load_matches([path])
        self.assertEqual(len(matches), 2)
        self.assertLessEqual(matches[0].date, matches[1].date)

    def test_evaluation_reports_league_metrics_and_no_future_prediction(self):
        matches = []
        for day in range(1, 45):
            home = "Alpha" if day % 2 else "Beta"
            away = "Beta" if day % 2 else "Alpha"
            hg, ag = (2, 1) if day % 3 else (1, 1)
            result = "H" if hg > ag else "D" if hg == ag else "A"
            matches.append(MODULE.Match(
                MODULE.datetime(2024, 1, day) if day <= 31 else MODULE.datetime(2024, 2, day - 31),
                "UG1", home, away, hg, ag, result
            ))
        report = MODULE.evaluate(matches, min_history=2, min_league_history=3)
        self.assertTrue(report["methodology"]["walk_forward"])
        self.assertGreater(report["dataset"]["scored_matches"], 0)
        self.assertIn("UG1", report["per_league"])
        for metrics in report["overall"].values():
            self.assertGreater(metrics["n"], 0)
            self.assertGreaterEqual(metrics["log_loss"], 0)


if __name__ == "__main__":
    unittest.main()
