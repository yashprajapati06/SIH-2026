# Northeast GSI data snapshot

This folder contains historical data for all eight Northeast states. It supplies the chatbot and the separate **GSI historical landslides** overlay on `/map`. It does not import these reference rows as operational events. [Map layer and coordinate flags](../../docs/GSI_HISTORICAL_MAP.md).

| File | Format | Contents |
| --- | --- | --- |
| `northeast_inventory.json.gz` | Gzip-compressed UTF-8 JSON | 11,022 extracted inventory rows, original history strings, coordinates, source PDF page and provenance |
| `report_catalogue.json` | UTF-8 JSON | 428 study references with titles, study type, field season and report links |

Study references are not individual landslide events. The catalogue does not include the full text or terrain layers from every linked study.

## Sources

- Catalogue: [GSI Bhusanket statewise reports](https://bhusanket.gsi.gov.in/statewiseLandslideReport.html), [catalogue payload](https://bhusanket.gsi.gov.in/json/LandslideReport/LandslideReport.json).
- Inventory: user-supplied `landslide_report.pdf`, labelled GSI Bhusanket Landslide Inventory (Field validated). Its SHA-256 is `3ec13c41230ef7436b7169f6a828e38db429e4c2b5aa054de51821423af5ce2a`.
- Snapshot validation date: 2026-09-08. This is a prepared extraction, not a continuously updated feed. No new field verification was performed.
- Uncompressed inventory JSON SHA-256: `1f3e261371264dfabe3694811f6e9886d4950443e3d752289b6f9933d493665d`.

Source names and page references are retained. GSI remains the source of the underlying information; the project does not claim ownership or certification of it.

## Validated coverage

| State | Source rows | Coordinate points | Single-date test events |
| --- | ---: | ---: | ---: |
| Arunachal Pradesh | 1,220 | 1,220 | 30 |
| Assam | 857 | 856 | 155 |
| Manipur | 1,631 | 1,631 | 39 |
| Meghalaya | 1,051 | 1,051 | 168 |
| Mizoram | 3,487 | 3,486 | 807 |
| Nagaland | 1,902 | 1,902 | 83 |
| Sikkim | 777 | 777 | 55 |
| Tripura | 97 | 97 | 10 |
| **Total** | **11,022** | **11,020** | **1,347** |

The first Assam record is explicitly checked to prevent a header-offset export error. Two source rows remain in the raw inventory but are excluded from map/event outputs: `ASM/WKA/83C09/2016/34` has missing coordinates, and `MZ/AIZ/84A14/2015/70` has a negative latitude inconsistent with this regional extraction. Neither value is silently repaired.

The date parser accepts one complete date only. It preserves ranges, approximate dates and unresolved histories in the raw data. Of the coordinate points, 9,673 remain historical map records without a usable single event day. For the 1,347 test events, midnight IST is an explicitly labelled day-level test convention, not a measured occurrence time. Historical district names use temporary test aliases; they are not validated current administrative IDs.

## Run the data validation

From the repository root, with the API requirements installed:

```sh
python scripts/validate_northeast_data.py
```

This reads the compressed file directly, checks its checksum, validates actual project schemas, creates an isolated in-memory repository, and exercises the real event-list router with an injected test identity. It checks duplicates, required event dates, state filters and every pagination page. Existing authorization tests are a separate suite.

Outputs are generated under `test-results/northeast/`: eight state GeoJSON files and `validation_report.json`. Generated GeoJSON uses longitude then latitude. Coordinate checks do not establish accurate field locations or membership in state/district boundary polygons.

To read the source in Python:

```python
import gzip, json
with gzip.open("data/gsi/northeast_inventory.json.gz", "rt", encoding="utf-8") as source:
    records = json.load(source)["records"]
```

## What this supports next

The website now renders a labelled historical-inventory overlay with state/district filters and a separate flagged-coordinate list. Production event import still needs reviewed date handling and mappings to the website's current districts. Slope geometry/angle, road distance, drainage, soil permeability and current observations must come from separately documented sources before evaluating the risk model. Displaying these historical records does not train the model, validate forecasts or issue public alerts.

See [test results and reproduction instructions](../../validation/README.md).
