from __future__ import annotations

import csv
from pathlib import Path

from lead_model import Lead


def load_leads(csv_path: Path) -> list[Lead]:
    with csv_path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        return [Lead.from_row(row) for row in reader]


def write_ranked_leads(csv_path: Path, rows: list[dict[str, str | int]]) -> None:
    if not rows:
        return

    fieldnames = list(rows[0].keys())
    csv_path.parent.mkdir(parents=True, exist_ok=True)

    with csv_path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)
