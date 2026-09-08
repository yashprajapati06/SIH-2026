# Project and Northeast data validation — 2026-09-08

The entire project was forked from `okayyyabhishek/SIH-2026` into `yashprajapati06/SIH-2026`. This branch adds data, a validation script, an isolated browser-test configuration, dependency snapshots and test reports. Original tracked application files and tests are unchanged from commit `f024b39d2db509f09624450c3315ee5debc26098`.

## Results

| Check | Result | Scope |
| --- | --- | --- |
| Existing backend suite | **269 passed, 1 skipped** | All 270 tests collected; 36 dependency deprecation warnings; 91.24 seconds |
| Existing frontend unit suite | **94 passed** | Vitest, two workers |
| TypeScript | **Passed** | `tsc --noEmit` |
| Frontend lint | **Passed with 7 warnings** | Three hook-dependency warnings and four image-element warnings |
| Production build | **Failed** | Missing Suspense boundary around `useSearchParams`; 19 prerender paths fail |
| Existing browser suite | **9 passed, 37 failed** | All 46 desktop/mobile cases produced outcomes; an additional teardown timeout occurred at the 300-second run limit |
| Northeast data checks | **Passed** | 11,022 source rows; 11,020 coordinate points; 1,347 single-date test events; eight-state filtering and complete pagination |
| Existing secret scanner | **Passed** | 269 project files scanned after adding data and reports; generated Chromium binary directory excluded |

The local MongoDB server was community version 8.0.30, bound to `127.0.0.1:27266` with a dedicated `sih_gsi_validation` database. All nine MongoDB persistence/failure tests passed, including independent-process read/write checks. This validates local MongoDB behavior, not an Atlas deployment. The live Copernicus catalogue discovery test passed. The live AWS S3 write/read test was skipped because usable credentials were unavailable. Notification provider tests used simulated or mocked providers; real public-alert delivery was not tested.

The successful GSI test loads records only into a separate in-memory test repository and a small test application containing the real event router. The running website and its production database have not been populated with this snapshot. No model was trained and no deployment was performed.

## Failures to address

1. **Production build:** Next.js reports `useSearchParams() should be wrapped in a suspense boundary`. Affected paths include `/`, `/login`, `/risk`, `/map`, `/ledger`, `/operations` and the not-found page. Compilation succeeds before prerendering fails.
2. **Browser tests:** expected text, headings and controls are not found. For example, `auth.spec.ts` expects `OPERATIONAL AUTHENTICATION`, and consequence tests expect `Road & Asset Consequence Intelligence`. The failing cases span authentication, map, risk, consequences, operations, satellite and smoke tests. These need comparison with current rendered UI and authentication requirements; a missing locator alone does not prove that the underlying feature is absent.
3. **Browser teardown:** the run also reports `Timed out waiting 300s for the teardown for plugin setup to run`. The JSON report contains outcomes for all 46 cases; the runner itself did not exit cleanly.

Browser tests used development servers because the production build failed. The added configuration starts API port 8026 and web port 3026 with local storage and simulated notifications. It does not change the original browser assertions. See `results.json` for per-case outcomes and sanitized failure messages.

## Data findings

The [data README](../data/gsi/README.md) documents source attribution, state counts, the two quarantined coordinate records and date conventions. Historical observations and 428 study catalogue references are different datasets.

The source provides no usable slope/soil/road/drainage feature dataset for this test. With all five expected terrain/history model features absent, the actual feature builder returns `DATA_INSUFFICIENT`, as expected. This test does not demonstrate predictive accuracy. The accepted single-date records range from 2007-06-16 through 2026-07-13; zero recorded events in the preceding 30 days at the test cutoff means only that the snapshot has no such accepted records.

## Reproduce

This was a local Windows run with Python 3.12.14 and Node.js 24.19.0, not a GitHub Actions run. The existing CI file uses Python 3.11 and Node 20; those environments were not separately tested. Use Python 3.12 and Node.js with pnpm to reproduce this run. `python-tested.txt` captures installed Python versions, and `apps/web/pnpm-lock.yaml` captures the resolved frontend dependencies. Generated logs, browser binaries, virtual environments and database files are not published in this branch.

From the repository root in PowerShell:

```powershell
python -m venv .venv
& .venv/Scripts/python.exe -m pip install -r validation/python-tested.txt
& .venv/Scripts/python.exe scripts/validate_northeast_data.py

# Start a separate local MongoDB on port 27266 with its own empty dbpath first.
$env:APP_ENV = 'test'
$env:MONGODB_URI = 'mongodb://127.0.0.1:27266/sih_gsi_validation'
$env:MONGODB_DB_NAME = 'sih_gsi_validation'
$env:AWS_EC2_METADATA_DISABLED = 'true'
$env:STORAGE_BACKEND = 'local'
$env:SATELLITE_MODE = 'test'
$env:NOTIFICATION_PROVIDER = 'simulated'
& .venv/Scripts/python.exe -m pytest apps/api/tests -vv --tb=short --junitxml=test-results/backend-full.xml

Set-Location apps/web
pnpm install --frozen-lockfile --ignore-scripts
node node_modules/vitest/vitest.mjs run --maxWorkers=2 --minWorkers=1
node node_modules/typescript/bin/tsc --noEmit
node node_modules/next/dist/bin/next lint --dir src
node node_modules/next/dist/bin/next build

$env:PLAYWRIGHT_BROWSERS_PATH = '../../.playwright-browsers'
node node_modules/@playwright/test/cli.js install chromium
node node_modules/@playwright/test/cli.js test --config playwright.validation.config.ts
```

Run this in a test environment without production AWS credentials: the original `test_live_s3_storage.py` writes a temporary probe to its configured bucket when credentials are available. To exclude that live integration explicitly, add `--ignore=apps/api/tests/test_live_s3_storage.py` to pytest. Browser ports 3026 and 8026 must be free.

The report records the observed results; the added configuration is not a fix for the failed build or browser tests.
