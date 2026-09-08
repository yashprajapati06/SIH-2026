# GSI historical map layer

Open `/map` and use **GSI historical landslides**. This separate reference layer loads all eight Northeast states by default. **GSI History** in Map Layers toggles the purple points. The data is a snapshot checked on 8 September 2026, not a live alert feed.

- **11,022 source records**, of which **11,020 are plotted** and **2 are flagged**.
- GSI state and historical-district selectors filter only this layer; operational jurisdiction filters remain separate.
- Click a point or choose **Browse mapped records → View details** to read the published location, material, movement, history, coordinates and source PDF page.
- Choose **2 flagged coordinates** with all states selected to inspect the excluded records. No corrected coordinates or replacement points are invented.
- The table pages through all matching mapped records, 20 at a time. The map renders the full matching point set using a Leaflet canvas.
- On a source error, markers are cleared and **Retry GSI data** is offered. Operational data and historical data have independent loading/error states.

| State | Source records | Plotted | Flagged |
| --- | ---: | ---: | ---: |
| Arunachal Pradesh | 1,220 | 1,220 | 0 |
| Assam | 857 | 856 | 1 |
| Manipur | 1,631 | 1,631 | 0 |
| Meghalaya | 1,051 | 1,051 | 0 |
| Mizoram | 3,487 | 3,486 | 1 |
| Nagaland | 1,902 | 1,902 | 0 |
| Sikkim | 777 | 777 | 0 |
| Tripura | 97 | 97 | 0 |

Flagged source records:

- Serial **410**, `ASM/WKA/83C09/2016/34`: latitude and longitude are missing.
- Serial **22139**, `MZ/AIZ/84A14/2015/70`: published latitude **-23.736217**, longitude **92.796936**; flagged as inconsistent with this Northeast extraction. The negative latitude is preserved for review.

Coordinate validity here means the existing reviewed coordinate flag plus finite-number and WGS 84 range checks. It does not establish survey accuracy or membership in current administrative boundaries. Historical district names are displayed as published. Raw history strings remain unchanged; years in slide IDs are never interpreted as occurrence dates.

## Data and API

The layer reads `data/gsi/northeast_inventory.json.gz`, verifies the decompressed SHA-256 and caches the validated inventory in memory. It uses `GSI_DATA_DIR`, then `CHATBOT_DATA_DIR`, or locates the checked-in corpus. Existing API Docker packaging already includes this directory. [Source provenance](../data/gsi/README.md).

- `GET /api/v1/gsi-history?state=Assam&district=Hailakandi`: filtered point coordinates, counts, available districts and flagged rows.
- `GET /api/v1/gsi-history/1`: full public reference record and provenance, keyed by original inventory serial.

Both endpoints require an active authenticated account, as does the public-reference chatbot API. This intentionally public corpus is available across all eight states. These endpoints do not read jurisdiction-restricted operational stores. Existing `/map` citizen-role restrictions remain in place. There are no write/import routes, operational events, notifications, model training or automatic warnings introduced by this layer.

## Reproduce checks

Validation completed on 9 September 2026:

- Full API suite: **308 passed, 1 skipped**, including all 18 historical-layer cases. The existing live S3 test skips without credentials.
- Frontend unit suite: **98 passed** across 14 files.
- Historical-layer browser checks: **4 passed** across desktop and mobile runs, against the production build and the local API.
- Next.js production build, TypeScript checks and `git diff --check` passed. Existing lint/deprecation/test-environment warnings remain.

From the repository root, using the API environment:

```sh
python -m pytest apps/api/tests/test_gsi_history.py -q
```

With the local API on port 8036 and the website on port 3036, from `apps/web`:

```sh
node node_modules/@playwright/test/cli.js test --config playwright.gsi.config.ts
```

The browser tests verify all eight state counts, canvas rendering, layer toggle, district filtering, record details, both flagged records and error/retry behavior on desktop and mobile. No marker is created from a flagged row. API tests check authentication, invalid filters, missing records, checksum rejection, unique IDs, source-date preservation and the complete source counts. A standard Next.js production build with `NEXT_STANDALONE=0`, including type checking and lint, passed on Windows; seven existing lint warnings remain. Test runs do not certify geological accuracy or prediction performance.
