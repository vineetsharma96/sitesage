# SiteSage prototype

The interface retains SiteSage's navy, blue and safety-status colours. Flashform inspired the oversized type, serif accents, spacing and landing-page composition. Existing operational routes remain available.

The supplied presentation describes an edge-first construction safety concept: camera feeds → person/PPE detection → configured risk rules → evidence → human review. The dashboard and camera feeds are simulated. The prototype does not demonstrate production computer vision, RTSP ingestion or measured detection performance.

## TinyFish safety research

Open `/research`, or follow the research link from an incident drawer. Select head protection, restricted crane zones, or fall protection. The server supplies a fixed OSHA source and a task-specific goal to the TinyFish Agent API. The browser receives SSE progress and a structured brief. The brief can be downloaded as JSON. Source-derived content needs human verification; these US sources do not establish Indian regulatory applicability.

Sample mode is explicitly labelled and does not call the provider. Live mode sends only the selected public topic. It never sends camera feeds, worker data or incident identifiers.

### Configuration

Copy `.env.example` to `.env` and set `TINYFISH_API_KEY` server-side. Restart the development server after changing the key. For Vercel, configure this same environment variable in the project and redeploy. Never use a `PUBLIC_` prefix for credentials.

The earlier source contained a hardcoded API key. It has been moved out of code into ignored local configuration. Rotate the exposed key in TinyFish; removing it from the current file does not remove it from Git history.

The endpoint accepts same-origin JSON requests and fixed topics. It includes a timeout and a process-local limit of five requests per client in ten minutes. This is a local hackathon safeguard, not distributed abuse prevention. A public production deployment requires authentication and a durable rate limiter. A disconnected browser does not guarantee provider-side cancellation: inspect the TinyFish dashboard before retrying an interrupted run.

API documentation: https://docs.tinyfish.ai/quick-start

## TinyFish incident context (updated presentation)

The latest deck calls for Search weather advisories, Fetch rule text, per-site caching, persisted incident context, fail-open delivery and daily source monitors. These now extend the existing Agent/SSE safety research; that workflow and its samples/downloads remain intact.

Open `/context` or an incident drawer. Dashboard-created simulated alerts are inserted before the context request begins. The browser posts only an incident ID, topic and original severity to `/api/incident-context`. IDs remain in SiteSage storage; TinyFish receives only the public source URL or site-level search query. The demo context site is explicitly New Delhi, not an inferred location from the camera scene.

Search uses the official IMD domain with a date/freshness filter. Fetch reads up to three returned official pages and the selected existing OSHA source. Weather caches for 15 minutes; rules cache for 24 hours. Concurrent requests share in-flight work. Sources, extracted text, advisory candidate types, original/recommended priorities and fetch times are stored with each incident. PostgreSQL is used when `DATABASE_URL` is set; local development otherwise writes ignored `.data/context.json`. A Vercel deployment requires PostgreSQL rather than an ephemeral file store.

Weather types are keyword candidates, not verified active warnings. The UI requires a human to confirm location and validity before accepting suggested escalation. Acceptance is persisted; original severity remains available. Context never downgrades an alert. Each provider call has a 12-second timeout; failures return partial/unavailable context while evidence and the original alert remain accessible. Refresh uses the existing caches rather than forcing more provider calls.

Native daily TinyFish Monitors are implemented but not registered automatically. Set `DATABASE_URL`, `SITESAGE_PUBLIC_URL` (public HTTPS), and a random `TINYFISH_WEBHOOK_SECRET` in server configuration alongside the existing API key. Run `npm run tinyfish:monitors` to register three existing rule sources and one official weather/advisory search at 07:00 Asia/Kolkata. This command creates recurring external monitors; run it only when you intend to enable them. Registered IDs are saved so subsequent setup skips duplicates. If creation times out or saving fails, inspect the TinyFish dashboard before rerunning to avoid an orphan/duplicate monitor.

Scheduled callbacks authenticate via a secret token and registered monitor ID. Content hashes identify changes, keep the last 20 change records and refresh the rule cache. `/context` shows registration status and last checks. Localhost cannot receive scheduled callbacks. The original web automation research still handles dynamic source reading; there is no claim of production CV, FastAPI ingestion or Indian regulatory applicability. This implementation extends the current Astro backend; the deck's production FastAPI pipeline can call the same context API once implemented.

API contracts: https://docs.tinyfish.ai/search-api/reference, https://docs.tinyfish.ai/fetch-api/reference, https://docs.tinyfish.ai/monitor/api-reference.

Production requires authenticated users and a distributed limiter; the current prototype uses same-origin requests and per-process rate limits. Human review records currently record an acceptance timestamp, not an authenticated reviewer identity.

## Validation

Run `npm test` for stream, endpoint, enrichment, caching, fail-open, review and monitor contract tests; run `npm run build` for the Astro/Vercel build. The context workflow was checked in Chrome at 1440 px and 390 px, including source rendering, human-approved priority, JSON download and the preserved research sample. A live TinyFish incident context run returned weather sources plus rule text and saved them locally. PostgreSQL persistence and scheduled callbacks require deployment configuration and were not exercised against a live database or registered monitor.

## HackIIITD submission context

The latest supplied deck identifies Neural Builds, Hack IIIT Delhi and four team members. It describes an edge computer-vision pipeline with a separate TinyFish context service; external context enriches events rather than replacing camera detection.

Event source: https://unstop.com/hackathons/hackiiitd-esya26-indraprastha-institute-of-information-technology-iiit-delhi-1761212
Style reference: https://www.flshfrm.com/?ref=onepagelove
