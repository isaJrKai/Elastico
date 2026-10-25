#!/usr/bin/env python3
"""Parse OpenFootball Football.TXT files into audited match rows.

Only completed, non-negative scorelines are emitted. Fixtures without a score
are counted as scheduled/incomplete, not silently treated as results.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
import re
from datetime import datetime
from pathlib import Path

DATE_RE = re.compile(r"^\s{2,}([A-Z][a-z]{2}\s+[A-Z][a-z]{2}\s+\d{1,2}\s+\d{4})\s*$")
MATCH_RE = re.compile(r"^\s{2,}(.+?)\s+v\s+(.+?)\s+(\d+)\s*-\s*(\d+)\s*$")
FIXTURE_RE = re.compile(r"^\s{2,}(.+?)\s+v\s+(.+?)\s*$")


def parse_file(path: Path, league: str) -> tuple[list[dict[str, str]], dict[str, object]]:
    raw = path.read_bytes()
    text = raw.decode("utf-8-sig")
    current_date: datetime | None = None
    rows: list[dict[str, str]] = []
    scheduled = incomplete = malformed = 0
    for number, line in enumerate(text.splitlines(), 1):
        if not line.strip() or line.lstrip().startswith(("#", "=", "▪", "-")):
            continue
        date_match = DATE_RE.match(line)
        if date_match:
            try:
                current_date = datetime.strptime(date_match.group(1), "%a %b %d %Y")
            except ValueError:
                malformed += 1
                current_date = None
            continue
        match = MATCH_RE.match(line)
        if match:
            if current_date is None:
                malformed += 1
                continue
            home, away, hg, ag = (part.strip() for part in match.groups())
            if not home or not away or home.casefold() == away.casefold():
                malformed += 1
                continue
            rows.append({
                "Date": current_date.strftime("%Y-%m-%d"),
                "Div": league,
                "HomeTeam": home,
                "AwayTeam": away,
                "FTHG": hg,
                "FTAG": ag,
                "FTR": "H" if int(hg) > int(ag) else "A" if int(hg) < int(ag) else "D",
            })
            scheduled += 1
            continue
        if FIXTURE_RE.match(line):
            scheduled += 1
            incomplete += 1
            continue
        malformed += 1

    seen: set[tuple[str, str, str, str, str]] = set()
    unique: list[dict[str, str]] = []
    duplicates = 0
    for row in rows:
        key = (row["Date"], row["HomeTeam"], row["AwayTeam"], row["FTHG"], row["FTAG"])
        if key in seen:
            duplicates += 1
            continue
        seen.add(key)
        unique.append(row)
    manifest = {
        "source_file": str(path),
        "sha256": hashlib.sha256(raw).hexdigest(),
        "bytes": len(raw),
        "league": league,
        "completed_result_rows_before_deduplication": len(rows),
        "completed_unique_results": len(unique),
        "duplicate_results": duplicates,
        "scheduled_or_incomplete_fixtures": incomplete,
        "malformed_or_unparsed_lines": malformed,
        "first_result_date": min((r["Date"] for r in unique), default=None),
        "last_result_date": max((r["Date"] for r in unique), default=None),
    }
    return unique, manifest


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("files", nargs="+", type=Path)
    parser.add_argument("--league", required=True, help="Stable competition identifier")
    parser.add_argument("--csv-output", type=Path, required=True)
    parser.add_argument("--manifest-output", type=Path, required=True)
    args = parser.parse_args()

    all_rows: list[dict[str, str]] = []
    manifests = []
    for path in args.files:
        rows, manifest = parse_file(path, args.league)
        all_rows.extend(rows)
        manifests.append(manifest)
    args.csv_output.parent.mkdir(parents=True, exist_ok=True)
    with args.csv_output.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=["Date", "Div", "HomeTeam", "AwayTeam", "FTHG", "FTAG", "FTR"])
        writer.writeheader()
        writer.writerows(sorted(all_rows, key=lambda r: (r["Date"], r["HomeTeam"], r["AwayTeam"])))
    args.manifest_output.parent.mkdir(parents=True, exist_ok=True)
    args.manifest_output.write_text(json.dumps({
        "source": "OpenFootball Football.TXT",
        "league": args.league,
        "files": manifests,
        "combined_rows_before_cross_file_deduplication": len(all_rows),
    }, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"rows": len(all_rows), "files": len(manifests)}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
