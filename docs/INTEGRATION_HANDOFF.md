# Chatbot and GSI Spatial Map: integration handoff

Updated 9 September 2026. Both repositories below use **main** as the sharing branch.

| Repository | What to use it for |
| --- | --- |
| [yashprajapati06/SIH-2026](https://github.com/yashprajapati06/SIH-2026) | Main Next.js/FastAPI website, GSI map and data, `/chatbot` page, floating-widget integration |
| [yashprajapati06/sentinel-landslide-chatbot](https://github.com/yashprajapati06/sentinel-landslide-chatbot) | Standalone floating chat UI, readable answers and source details inside chat, English/Hinglish handling, Python service |

The website is derived from [okayyyabhishek/SIH-2026](https://github.com/okayyyabhishek/SIH-2026). This handoff updates Yash's fork; it does not change the friend's original repository or deploy a public website.

## Bring the website changes into the original checkout

For a fresh copy:

```sh
git clone https://github.com/yashprajapati06/SIH-2026.git
```

For an existing checkout with the same SIH history, integrate on a branch and review the merged changes:

```sh
git switch -c integrate/sentinel-gsi-chatbot
git fetch https://github.com/yashprajapati06/SIH-2026.git main
git merge FETCH_HEAD
```

The feature history is `54d4f36` (GSI corpus and validation), `95a4e51` (full-page assistant), `38a2147` (floating widget integration), and `59d1b55` (historical map). The map depends on the included corpus and shared API code; copying only the `/map` page is insufficient. Existing deployments should use their own API, database, storage and authentication configuration.

## GSI map

The existing main API serves the new read-only `/api/v1/gsi-history` endpoints. No extra map service is required. Keep `data/gsi/northeast_inventory.json.gz` in the repository; it is already included in the API Docker packaging. `GSI_DATA_DIR` can select a different directory containing this same validated snapshot. The original downloaded PDF is not required at runtime.

Set `NEXT_PUBLIC_API_URL` to the main API origin before building the frontend. Sign in and open `/map` → **GSI historical landslides**. All eight states load by default: 11,022 records, 11,020 mapped points and two separately flagged coordinate records. State/district filters, map-point details and the flagged-record list are included. [Full map details and checks](GSI_HISTORICAL_MAP.md).

## Floating chatbot

Clone the separate chatbot repository and follow its [README](https://github.com/yashprajapati06/sentinel-landslide-chatbot#run-locally). It uses Python 3.12+ and needs no AI API key. Run it locally on port 8046, or host it as a separate HTTPS Python service.

For local testing, the main website defaults to `http://127.0.0.1:8046`. For deployment, configure the service's actual HTTPS origin **before rebuilding the main frontend**:

```env
NEXT_PUBLIC_CHATBOT_URL=https://YOUR-CHATBOT-HOST
```

`FloatingAssistant.tsx` is already mounted through `AppProviders.tsx`; it loads the service's `/static/embed.js`. Do not add a second embed script to this SIH website. For another website, use the standalone repository's embed instructions. GitHub stores the code; the Python service needs a running host.

The standalone chatbot's main branch includes the readable inline-data update and the English-language fix (`60754f0`). Its endpoint and UI are separate from the original full-page `/chatbot` implementation. [Main website assistant setup](LANDSLIDE_CHATBOT.md).

## Acceptance checks

1. Open `/map`; verify all eight state options, 11,020 mapped points and two flagged records.
2. Filter a state and district, then open a point's details. Check that flagged coordinates stay off the map.
3. Start the standalone chatbot; open **Ask Sentinel** on the main website. Ask `How many landslide records are in Assam?` and check that the reply is English and details open inside the chat.
4. Rebuild and run the checks documented in both repositories after integrating into the target checkout. The source feature passed 308 API tests (one existing live-S3 skip), 98 frontend unit tests and four map browser checks; the production build passed. These results precede any changes made in the friend's checkout.

## Current scope

The GSI layer contains historical reference data, not live warnings or a trained prediction model. Community report submission, officer verification and report detail pages already exist, but **verified community reports are not yet connected to automatic map points**. That additional connection is not included in this handoff. No public alerts are sent by the chatbot or historical map.
