"""Read-only GSI historical overlay. Never imports observations as live events."""
from collections import Counter
from functools import lru_cache
import gzip
import hashlib
import json
import math
import os
from pathlib import Path

STATES = ("Arunachal Pradesh", "Assam", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Sikkim", "Tripura")
CHECKSUM = "1f3e261371264dfabe3694811f6e9886d4950443e3d752289b6f9933d493665d"


def coordinate_issue(row: dict) -> str | None:
    lat, lon = row.get("latitude"), row.get("longitude")
    if lat is None or lon is None:
        return "Coordinates are missing in the source. This record is not plotted."
    if any(isinstance(v, bool) or not isinstance(v, (int, float)) or not math.isfinite(v) for v in (lat, lon)):
        return "Coordinates are not finite numbers. This record is not plotted."
    if not (-90 <= lat <= 90 and -180 <= lon <= 180):
        return "Coordinates are outside WGS 84 limits. This record is not plotted."
    if not row.get("coordinate_valid"):
        return "Source coordinates were flagged as inconsistent with the Northeast inventory. They are preserved without correction and are not plotted."
    return None


class HistoricalInventory:
    def __init__(self, directory: Path):
        raw = gzip.decompress((directory / "northeast_inventory.json.gz").read_bytes())
        if hashlib.sha256(raw).hexdigest() != CHECKSUM:
            raise ValueError("Unrecognized historical inventory snapshot")
        rows = json.loads(raw)["records"]
        self.records = {}
        for row in rows:
            serial = row["inventory_serial_no"]
            if serial in self.records or row["state"] not in STATES:
                raise ValueError("Invalid historical inventory record identity")
            self.records[serial] = {**row, "id": serial, "coordinate_issue": coordinate_issue(row)}
        totals = Counter(r["state"] for r in self.records.values())
        mapped = Counter(r["state"] for r in self.records.values() if not r["coordinate_issue"])
        self.states = [{"name": s, "total": totals[s], "mapped": mapped[s], "flagged": totals[s] - mapped[s]} for s in STATES]

    def snapshot(self, state: str | None = None, district: str | None = None) -> dict:
        state_rows = [r for r in self.records.values() if not state or r["state"] == state]
        rows = [r for r in state_rows if not district or r["district"] == district]
        points = [{"id": r["id"], "name": r["slide_name"], "state": r["state"], "district": r["district"],
                   "latitude": r["latitude"], "longitude": r["longitude"]} for r in rows if not r["coordinate_issue"]]
        flagged = [r for r in rows if r["coordinate_issue"]]
        return {"snapshot_date": "2026-09-08", "source_name": "Geological Survey of India (GSI) · Bhusanket",
                "source_url": "https://bhusanket.gsi.gov.in/statewiseLandslideReport.html",
                "historical_only": True, "total": len(rows), "mapped": len(points), "flagged": len(flagged),
                "global_total": len(self.records), "states": self.states,
                "districts": sorted({r["district"] for r in state_rows if r["district"]}),
                "points": points, "flagged_records": flagged}


@lru_cache(maxsize=1)
def get_historical_inventory() -> HistoricalInventory:
    configured = os.environ.get("GSI_DATA_DIR") or os.environ.get("CHATBOT_DATA_DIR")
    directory = Path(configured) if configured else next((p / "data/gsi" for p in Path(__file__).resolve().parents if (p / "data/gsi/northeast_inventory.json.gz").is_file()), None)
    if directory is None:
        raise FileNotFoundError("Historical inventory not configured")
    return HistoricalInventory(directory)
