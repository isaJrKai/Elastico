import tempfile
import unittest
from pathlib import Path
import importlib.util
import sys

SCRIPT = Path(__file__).resolve().parents[1] / "audit_openfootball_txt.py"
SPEC = importlib.util.spec_from_file_location("audit_openfootball_txt", SCRIPT)
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)


class OpenFootballParserTests(unittest.TestCase):
    def test_completed_and_incomplete_fixtures_and_manifest(self):
        source = """= Uganda Premier League 2024/2025

# Teams 16
  Fri Sep 13 2024
           KCCA FC            v URA FC             1-0
           Lugazi FC          v Kitara FC
           NEC FC             v Vipers SC          3-1
"""
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / "sample.txt"
            path.write_text(source, encoding="utf-8")
            rows, manifest = MODULE.parse_file(path, "UG1")
        self.assertEqual(len(rows), 2)
        self.assertEqual(rows[0]["Date"], "2024-09-13")
        self.assertEqual(rows[0]["FTR"], "H")
        self.assertEqual(rows[1]["FTR"], "H")
        self.assertEqual(manifest["completed_unique_results"], 2)
        self.assertEqual(manifest["scheduled_or_incomplete_fixtures"], 1)
        self.assertEqual(len(manifest["sha256"]), 64)

    def test_duplicate_completed_result_is_counted(self):
        source = """  Fri Sep 13 2024
           KCCA FC            v URA FC             1-0
           KCCA FC            v URA FC             1-0
"""
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / "sample.txt"
            path.write_text(source, encoding="utf-8")
            rows, manifest = MODULE.parse_file(path, "UG1")
        self.assertEqual(len(rows), 1)
        self.assertEqual(manifest["duplicate_results"], 1)

    def test_no_date_does_not_emit_result(self):
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / "sample.txt"
            path.write_text("           KCCA FC v URA FC 1-0\\n", encoding="utf-8")
            rows, manifest = MODULE.parse_file(path, "UG1")
        self.assertEqual(rows, [])
        self.assertEqual(manifest["malformed_or_unparsed_lines"], 1)

    def test_annotated_awarded_score_is_retained(self):
        source = """  Sat Oct 4 2025
           Kitara FC v Vipers SC 3-0 [awarded 3-0; Vipers dns because of dispute]
"""
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / "sample.txt"
            path.write_text(source, encoding="utf-8")
            rows, manifest = MODULE.parse_file(path, "UG1")
        self.assertEqual(len(rows), 1)
        self.assertEqual((rows[0]["FTHG"], rows[0]["FTAG"]), ("3", "0"))
        self.assertEqual(manifest["annotated_completed_results"], 1)

    def test_abandoned_fixture_is_not_a_completed_result(self):
        source = """  Thu Oct 19 2023
           Arua Hill SC abd. Gaddafi Modern FC [abandoned at 0-0 after 10' due to heavy rain]
"""
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / "sample.txt"
            path.write_text(source, encoding="utf-8")
            rows, manifest = MODULE.parse_file(path, "UG1")
        self.assertEqual(rows, [])
        self.assertEqual(manifest["abandoned_fixtures"], 1)
        self.assertEqual(manifest["scheduled_or_incomplete_fixtures"], 1)


    def test_bye_entry_is_not_a_malformed_match(self):
        source = """= Uganda Premier League 2023/2024
  Fri Sep 15 2023
           Vipers SC            bye
"""
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / "sample.txt"
            path.write_text(source, encoding="utf-8")
            rows, manifest = MODULE.parse_file(path, "UG1")
        self.assertEqual(rows, [])
        self.assertEqual(manifest["bye_entries"], 1)
        self.assertEqual(manifest["malformed_or_unparsed_lines"], 0)

    def test_cross_file_duplicates_are_removed(self):
        row = {"Date": "2024-09-13", "Div": "UG1", "HomeTeam": "KCCA", "AwayTeam": "URA",
               "FTHG": "1", "FTAG": "0", "FTR": "H"}
        unique, duplicates = MODULE.deduplicate_across_files([row, dict(row)])
        self.assertEqual(len(unique), 1)
        self.assertEqual(duplicates, 1)


if __name__ == "__main__":
    unittest.main()
