"""Real-snapshot counts, coordinate exclusion, provenance and API boundaries."""
import gzip
import pytest
from httpx import ASGITransport, AsyncClient

from src.core.gsi_history import HistoricalInventory, coordinate_issue, get_historical_inventory
from src.core.security.dependencies import get_current_user
from src.main import app


@pytest.mark.parametrize("state,total,mapped,flagged", [
    ("Arunachal Pradesh",1220,1220,0), ("Assam",857,856,1), ("Manipur",1631,1631,0),
    ("Meghalaya",1051,1051,0), ("Mizoram",3487,3486,1), ("Nagaland",1902,1902,0),
    ("Sikkim",777,777,0), ("Tripura",97,97,0),
])
def test_full_state_counts(state, total, mapped, flagged):
    result = get_historical_inventory().snapshot(state)
    assert (result["total"], result["mapped"], result["flagged"]) == (total, mapped, flagged)
    assert len(result["points"]) == mapped
    assert all(p["state"] == state for p in result["points"])
    assert result["historical_only"] is True


def test_all_records_unique_and_two_flagged_rows_never_plotted():
    result = get_historical_inventory().snapshot()
    assert (result["total"], result["mapped"], result["flagged"]) == (11022,11020,2)
    ids = {p["id"] for p in result["points"]}
    assert len(ids) == 11020
    assert not ids.intersection(r["id"] for r in result["flagged_records"])
    assert {r["slide_no"] for r in result["flagged_records"]} == {"ASM/WKA/83C09/2016/34", "MZ/AIZ/84A14/2015/70"}
    assert result["flagged_records"][1]["latitude"] == -23.736217
    assert result["points"][0] == {"id":1, "name":"Kukinala slide", "state":"Assam", "district":"Hailakandi", "latitude":24.27, "longitude":92.5}


def test_district_filter_and_unknown_selection():
    inv = get_historical_inventory()
    selection = inv.snapshot("Assam", "Hailakandi")
    assert selection["mapped"] > 0
    assert all(p["district"] == "Hailakandi" for p in selection["points"])
    assert inv.snapshot("Sikkim", "Hailakandi")["total"] == 0
    assert inv.records[1]["history_raw"] == "NA"  # Do not invent 2020 from the ID.
    assert inv.records[1]["source_pdf_page"] == 1


@pytest.mark.parametrize("lat,lon,reason", [(None,92,"missing"), (float('nan'),92,"finite"), (24,float('inf'),"finite"), (91,92,"WGS"), (24,181,"WGS")])
def test_coordinate_validation(lat, lon, reason):
    assert reason in coordinate_issue({"latitude":lat, "longitude":lon, "coordinate_valid":True})


def test_unrecognized_dataset_is_not_loaded(tmp_path):
    (tmp_path / "northeast_inventory.json.gz").write_bytes(gzip.compress(b'{"records":[]}'))
    with pytest.raises(ValueError, match="Unrecognized"):
        HistoricalInventory(tmp_path)


@pytest.mark.asyncio
async def test_http_auth_filters_limits_and_read_only_contract():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://testserver") as client:
        assert (await client.get("/api/v1/gsi-history")).status_code == 401
        assert (await client.get("/api/v1/gsi-history/1")).status_code == 401
        app.dependency_overrides[get_current_user] = lambda: {"id":"gsi-reader", "role":"DDMA_OFFICER", "district_id":"unrelated"}
        try:
            result = await client.get("/api/v1/gsi-history", params={"state":"Mizoram"})
            assert result.status_code == 200
            assert result.json()["data"]["mapped"] == 3486  # Public corpus, not operational jurisdiction data.
            assert (await client.get("/api/v1/gsi-history/1")).json()["data"]["history_raw"] == "NA"
            assert (await client.get("/api/v1/gsi-history/999999")).status_code == 404
            assert (await client.get("/api/v1/gsi-history", params={"state":"Atlantis"})).status_code == 422
            assert (await client.get("/api/v1/gsi-history", params={"district":"x"*101})).status_code == 422
            assert (await client.post("/api/v1/gsi-history", json={})).status_code == 405
        finally:
            app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.asyncio
async def test_unavailable_snapshot_is_explicit_and_redacted(monkeypatch):
    from src.api.v1 import gsi_history
    def missing():
        raise FileNotFoundError("secret-local-path")
    monkeypatch.setattr(gsi_history, "get_historical_inventory", missing)
    app.dependency_overrides[get_current_user] = lambda: {"id":"gsi-reader"}
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://testserver") as client:
            response = await client.get("/api/v1/gsi-history")
            assert response.status_code == 503
            assert "secret-local-path" not in response.text
    finally:
        app.dependency_overrides.pop(get_current_user, None)
