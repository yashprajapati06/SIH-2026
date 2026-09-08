# Landslide knowledge assistant

Open **Surveillance & GIS → Landslide Assistant**, or `/chatbot`, after signing in. The assistant searches the entire included public historical inventory, study catalogue and reviewed explanatory articles. It provides evidence links and source-record details with each supported answer.

## Available knowledge

- 11,022 extracted GSI historical rows across Arunachal Pradesh, Assam, Manipur, Meghalaya, Mizoram, Nagaland, Sikkim and Tripura.
- 428 GSI study catalogue references, including titles, project type, field season and PDF links. Full study PDF text is not indexed.
- Eight reviewed English/Hinglish articles explaining landslides, causes, movement types, safety, warning signs, data provenance, model limitations and the community verification workflow. General facts cite USGS; safety summaries cite NIDM.

The corpus lives in `data/gsi/northeast_inventory.json.gz`, `report_catalogue.json` and `knowledge.json`. It is loaded and indexed on first use, independent of the current working directory. `CHATBOT_DATA_DIR` can explicitly select this directory. Docker copies it into the API image and mounts it read-only in Compose.

## Examples

```text
How many landslide records are in Assam?
Which state has the most landslide records?
Which district in Assam has the most landslide records?
Find GSI studies for Sikkim
Assam landslides 2024
ASM/HKN/83D07/2020/2
Landslide kyu hoti hai?
What data does the model need?
```

The state, source and answer-language filters narrow a question. A follow-up such as “How many records are there?” can reuse a named location from one of the last four user questions. Explicit state filters take precedence; conflicting state names prompt the user to change the filter.

## How answers work

This is a **local retrieval chatbot**, not a newly trained generative model. It needs no external AI API key. A bounded query router handles dataset summaries, comparisons, location/year searches, general explanations and requests the data cannot support. An inverted index searches whitelisted public fields. Counts are computed over all matching rows rather than only the five records displayed as evidence. Results are deterministic; broad conversational reasoning and arbitrary questions outside this knowledge base are not supported.

Historical rows, report catalogue metadata and general guidance remain distinct evidence types. The assistant does not use the website's hardcoded demo forecast values as current evidence. It does not read private citizen submissions, accounts, audit trails or operational records. It cannot send alerts, approve actions, inspect an uploaded photo, certify a safe route or make a live landslide prediction.

The inventory retains missing/approximate/multiple dates and original district labels. A year query matches the published history, excluding years that appear only in an inventory identifier. Two suspect coordinate rows remain searchable with clear flags, without exposing their coordinates as valid map points. A larger row count is not proof of greater current/future risk. No search result is not proof that no landslide occurred.

## API and access

Both endpoints require the existing active-user authentication. Every active role can search this deliberately public reference corpus; no privileged repository methods are exposed.

- `GET /api/v1/chatbot/coverage`: dataset counts, states, snapshot date and mode.
- `POST /api/v1/chatbot/query`: `{ "message": "Assam landslides", "language": "auto", "state": null, "source": "auto", "previous_questions": [] }`.

Messages are limited to 1,000 characters, context to four previous questions and requests to 30 per minute per account per API process, using the project's existing rate limiter. Distributed rate limiting across multiple server instances is not provided by this implementation. Missing or invalid corpus files produce a controlled 503 rather than invented answers. An unavailable service preserves the user's question for retry.

The UI keeps a bounded conversation in component memory only; refresh or Clear chat removes it. Queries are not sent to a third-party model. React renders answers/source text as text, and citation links use a small HTTPS hostname allowlist. Query text and document contents are never executed.

## Local run

Use the existing API dependencies, frontend dependencies and a dedicated local MongoDB. Example PowerShell configuration for the preview tested here:

```powershell
# Repository root; first start your local MongoDB on port 27266.
$env:APP_ENV = 'test'
$env:PERSISTENCE_BACKEND = 'in_memory'
$env:MONGODB_URI = 'mongodb://127.0.0.1:27266/sih_chatbot_demo'
$env:MONGODB_DB_NAME = 'sih_chatbot_demo'
$env:STORAGE_BACKEND = 'local'
$env:NOTIFICATION_PROVIDER = 'simulated'
$env:SATELLITE_MODE = 'test'
$env:AWS_EC2_METADATA_DISABLED = 'true'
$env:CORS_ORIGINS = 'http://127.0.0.1:3036'
python -m uvicorn src.main:app --app-dir apps/api --host 127.0.0.1 --port 8036
```

In a second terminal, from `apps/web`:

```powershell
$env:NEXT_PUBLIC_API_URL = 'http://127.0.0.1:8036'
$env:NEXT_STANDALONE = '0'
pnpm install --frozen-lockfile --ignore-scripts
pnpm build
node node_modules/next/dist/bin/next start --hostname 127.0.0.1 -p 3036
```

Visit `http://127.0.0.1:3036/chatbot`. Existing development accounts are for this local test environment. No production credentials or live alert delivery are required.

The shared analytics provider now has a Suspense boundary so prerendering succeeds. `NEXT_STANDALONE=0` selects a standard Next.js server build for Windows environments without symbolic-link privileges. Docker's default standalone output remains enabled. The Windows standalone packaging attempt hit an OS `EPERM` restriction; standalone Docker packaging was not independently validated in this run.

## Validation

Observed local checks: 290 backend tests passed, one live AWS S3 test skipped; all 98 frontend unit tests passed; all four chatbot browser tests passed on desktop/mobile; TypeScript, lint (seven pre-existing warnings) and standard production build passed. New chatbot tests cover all eight state totals, complete-corpus indexing, source citations, year parsing, flagged coordinates, missing knowledge, unsupported/live questions, authentication, rate limiting, error/retry handling and safe rendering. The pre-existing 46-test browser suite was not rerun as part of this feature check.

Re-run the focused checks with the servers above running:

```powershell
python -m pytest apps/api/tests/test_chatbot.py -q
# From apps/web:
node node_modules/vitest/vitest.mjs run tests/unit/chatbot.test.tsx
$env:PLAYWRIGHT_BROWSERS_PATH = '../../.playwright-browsers'
node node_modules/@playwright/test/cli.js test --config playwright.chatbot.config.ts
```

## Updating the knowledge

Edit reviewed explanatory articles with supporting source URLs in `knowledge.json`. For inventory changes, validate the replacement extraction, update the checksum and corpus-specific expected counts, then rerun the GSI validation and chatbot tests before release. Restart the API to rebuild its cache. Adding files alone does not train an AI model or update a running cache. Future support for complete report text or an LLM requires a separately reviewed ingestion/retrieval layer; neither is claimed here.
