"""Validate the GSI snapshot against Sentinel's actual schemas and isolated API.

Run: python scripts/validate_northeast_data.py
No production database, satellite provider or notification gateway is used.
"""
from __future__ import annotations

import asyncio
from collections import Counter
from datetime import date, datetime, timedelta, timezone
import hashlib
import gzip
import json
import os
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data/gsi/northeast_inventory.json.gz"
OUT = ROOT / "test-results/northeast"
STATES = {
    "Arunachal Pradesh": "AR", "Assam": "AS", "Manipur": "MN",
    "Meghalaya": "ML", "Mizoram": "MZ", "Nagaland": "NL",
    "Sikkim": "SK", "Tripura": "TR",
}
# Controls from the original prepared inventory, including its first record.
EXPECTED = {"AR": 1220, "AS": 857, "MN": 1631, "ML": 1051,
            "MZ": 3487, "NL": 1902, "SK": 777, "TR": 97}


def exact_day(raw: str) -> str | None:
    """Accept one complete day only. Never extract a day out of a date range."""
    text = re.sub(r"(?<=\d)(st|nd|rd|th)\b", "", raw.strip(), flags=re.I)
    # Only anchored complete dates, optionally followed by an explicit time.
    match = re.fullmatch(
        r"(\d{1,2}[./-]\d{1,2}[./-]\d{4}|\d{1,2}\s+[A-Za-z]+[.\s]+\d{4})"
        r"\.?\s*(?:(?:at\b|in the\b|from\b|\().*)?", text, flags=re.I,
    )
    if not match:
        return None
    suffix = text[match.end(1):]
    # Do not accept a second day or another year in a suffix.
    if re.search(r"\b(?:19|20)\d{2}\b", suffix):
        return None
    token = match.group(1)
    if re.search(r"[A-Za-z]", token):
        token = re.sub(r"\s+", " ", token.replace(".", " ")).strip()
    for fmt in ("%d %B %Y", "%d %b %Y", "%d.%m.%Y", "%d/%m/%Y", "%d-%m-%Y"):
        try:
            return datetime.strptime(token, fmt).date().isoformat()
        except ValueError:
            continue
    return None


def uid(row: dict) -> str:
    return f"GSI-{STATES[row['state']]}-{row['inventory_serial_no']}"


def district_key(row: dict) -> str:
    # Explicit test aliases preserve historical labels; these are not LGD codes.
    digest = hashlib.sha256(str(row['district']).encode()).hexdigest()[:12]
    return f"test-gsi-{STATES[row['state']]}-{digest}"


async def validate() -> dict:
    os.environ["APP_ENV"] = "test"
    os.environ["PERSISTENCE_BACKEND"] = "in_memory"
    os.environ["STORAGE_BACKEND"] = "local"
    os.environ["SATELLITE_MODE"] = "test"
    os.environ["NOTIFICATION_PROVIDER"] = "simulated"
    os.environ["AWS_EC2_METADATA_DISABLED"] = "true"
    sys.path.insert(0, str(ROOT / "apps/api"))
    from fastapi import FastAPI
    from httpx import ASGITransport, AsyncClient
    from pydantic import ValidationError
    from src.api.v1 import landslide_events as endpoint
    from src.core.errors import ConflictException
    from src.core.config import settings
    from src.core.risk.features import FeatureSnapshotBuilder
    from src.db.repository import InMemoryRepository
    from src.schemas.domain import LandslideEventCreate, LandslideEventResponse
    from src.schemas.geojson import GeoJSONPoint
    from src.schemas.risk import DataQualityState, RiskSubjectType

    source_bytes = gzip.decompress(DATA.read_bytes())
    source_sha256 = hashlib.sha256(source_bytes).hexdigest()
    assert source_sha256 == "1f3e261371264dfabe3694811f6e9886d4950443e3d752289b6f9933d493665d"
    snapshot = json.loads(source_bytes)
    rows = snapshot["records"]
    assert len(rows) == 11022, "Inventory row loss or unexpected source change"
    assert len({uid(row) for row in rows}) == len(rows)
    counts = Counter(STATES[row["state"]] for row in rows)
    assert counts == Counter(EXPECTED), counts
    assert rows[0]["slide_no"] == "ASM/HKN/83D07/2020/2", "First Assam row was dropped"
    assert exact_day("14th -15th May 2022") is None
    assert exact_day("2 July 2024/ August 2024") is None
    assert exact_day("May-2016 & 31 May 2017") is None
    assert exact_day("31.05.2025 09.06.2025") is None
    assert exact_day("18 June 2024 at 04:30 hrs.") == "2024-06-18"
    assert exact_day("31 February 2024") is None

    OUT.mkdir(parents=True, exist_ok=True)
    settings.ENABLE_DEV_FIXTURES = False
    repo = InMemoryRepository()
    known_districts = set()
    valid_counts = Counter()
    imported_counts = Counter()
    quarantine = []
    parsed = []
    last_event = None
    features_by_state = {state: [] for state in STATES}
    for row in rows:
        state = row["state"]
        code = STATES[state]
        if not row["coordinate_valid"]:
            quarantine.append({"record_uid": uid(row), "slide_id": row["slide_no"],
                               "reason": "source_coordinate_check_failed"})
            continue
        point = GeoJSONPoint(coordinates=[row["longitude"], row["latitude"]])
        valid_counts[code] += 1
        day = exact_day(str(row["history_raw"]))
        properties = {**row, "record_uid": uid(row), "event_date_iso": day,
                      "date_parse_status": "single_day" if day else "unresolved",
                      "district_mapping_status": "historical_label_not_validated_against_current_boundaries"}
        features_by_state[state].append({"type": "Feature", "id": uid(row),
            "geometry": point.model_dump(mode="json"), "properties": properties})
        if day is None:
            continue
        parsed.append(day)
        district = district_key(row)
        if district not in known_districts:
            await repo.create_district({"id": district, "code": district,
                "name": row["district"], "state_code": code,
                "metadata": {"test_alias": True, "geometry_not_provided": True}})
            known_districts.add(district)
        payload = LandslideEventCreate(
            event_reference=uid(row),
            # Day-only source: start-of-day IST is an explicit test convention.
            event_time=datetime.fromisoformat(day + "T00:00:00+05:30"),
            geometry=point, district_id=district, state_code=code,
            source="IMPORTED_DATA", source_reference=str(row["slide_no"])[:150],
            status="HISTORICAL", description=str(row["slide_name"])[:1000],
            metadata={"gsi_record": row, "event_time_precision": "day",
                      "test_time_convention": "start_of_day_Asia/Kolkata",
                      "source_pdf_page": row["source_pdf_page"]},
        )
        event = await repo.create_landslide_event(payload.model_dump())
        LandslideEventResponse.model_validate(event)
        imported_counts[code] += 1
        last_event = event

    assert sum(valid_counts.values()) == 11020
    assert len(quarantine) == 2
    try:
        await repo.create_landslide_event(last_event)
    except ConflictException:
        duplicate_rejected = True
    else:
        raise AssertionError("Duplicate event reference was accepted")
    missing_time = dict(last_event)
    missing_time.pop("event_time")
    try:
        LandslideEventCreate.model_validate(missing_time)
    except ValidationError:
        missing_time_rejected = True
    else:
        raise AssertionError("Missing event date was accepted")

    # Exercise the production router in a separate in-process application.
    # Test identity injection avoids real accounts; existing RBAC tests run separately.
    endpoint.repository = repo
    test_app = FastAPI()
    test_app.include_router(endpoint.router, prefix="/api/v1")
    actor = {"id": "test-gsi-validator", "role": "PLATFORM_ADMIN"}
    for route in endpoint.router.routes:
        for dependency in route.dependant.dependencies:
            test_app.dependency_overrides[dependency.call] = lambda: actor
    async with AsyncClient(transport=ASGITransport(app=test_app), base_url="http://testserver") as client:
        for code in STATES.values():
            page = 1
            received = []
            while True:
                response = await client.get("/api/v1/landslide-events", params={
                    "state_code": code, "limit": 100, "page": page})
                assert response.status_code == 200, response.text[:300]
                result = response.json()["data"]
                assert result["total"] == imported_counts[code], (code, result["total"], imported_counts[code], result["items"][:1])
                assert all(item["state_code"] == code for item in result["items"])
                received.extend(item["id"] for item in result["items"])
                if not result["has_next"]:
                    break
                page += 1
            assert len(received) == len(set(received)) == imported_counts[code]

    as_of = datetime(2026, 9, 8, tzinfo=timezone.utc)
    recent, total_recent = await repo.list_landslide_events(
        from_date=as_of - timedelta(days=30), to_date=as_of, limit=100)
    risk_snapshot = FeatureSnapshotBuilder.build_snapshot(
        subject_type=RiskSubjectType.SLOPE_UNIT, subject_id="test-gsi-missing-terrain",
        district_id="test-gsi", state_code="MZ", feature_dict={}, now=as_of)
    assert risk_snapshot.data_quality_state == DataQualityState.DATA_INSUFFICIENT
    assert risk_snapshot.missing_feature_count == 5

    for state, features in features_by_state.items():
        slug = state.lower().replace(" ", "_")
        (OUT / f"{slug}.geojson").write_text(json.dumps(
            {"type": "FeatureCollection", "features": features}, ensure_ascii=False,
            separators=(",", ":")), encoding="utf-8")
    report = {
        "status": "PASS", "source_sha256": source_sha256,
        "as_of_date": as_of.date().isoformat(), "source_rows": len(rows),
        "valid_coordinate_points": sum(valid_counts.values()), "quarantined": quarantine,
        "single_day_records_imported_to_test_repository": sum(imported_counts.values()),
        "records_kept_as_historical_map_only": sum(valid_counts.values()) - sum(imported_counts.values()),
        "exact_day_range": [min(parsed), max(parsed)],
        "recorded_events_in_previous_30_days": total_recent,
        "duplicate_event_reference_rejected": duplicate_rejected,
        "missing_event_time_rejected": missing_time_rejected,
        "api_state_filter_and_full_pagination": "PASS",
        "risk_without_terrain_inputs": risk_snapshot.data_quality_state.value,
        "state_summary": [{"state": state, "state_code": code,
            "source_rows": counts[code], "map_points": valid_counts[code],
            "test_event_records": imported_counts[code]} for state, code in STATES.items()],
        "limits": ["Coordinate numeric checks do not verify field location or state/district boundaries.",
            "Historical district labels need a reviewed mapping to current district IDs.",
            "No slope, road, drainage, soil, rainfall, training labels or live alerts are supplied.",
            "Zero recorded recent events does not demonstrate zero risk or complete current coverage.",
            "Imported rows remain HISTORICAL; day-level time uses an explicit test-only convention."]}
    (OUT / "validation_report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    return report


if __name__ == "__main__":
    print(json.dumps(asyncio.run(validate()), indent=2))
