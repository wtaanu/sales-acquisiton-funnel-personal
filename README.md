# Client Acquisition Engine

This folder now contains two implementation tracks:

1. a legacy Python MVP for local scoring experiments
2. a `Node.js scheduler` that is the preferred long-term engine

## Recommended Path

Use the `Node.js scheduler` as the primary runtime for:

- lead import
- scoring
- ZeroBounce verification
- company-level intelligence snapshots
- saved-search and watchlist operations
- account alerts
- outreach draft generation
- controlled SMTP sending of reviewed drafts
- inbox reply capture and suggested reply drafting
- weekly reporting

## Why Node.js

This project is a better fit for code-first automation than a visual orchestrator because we need:

- tighter control over deliverability-safe logic
- easier versioning
- custom retry and filtering behavior
- modular jobs that can grow with the sales process

## Node.js Layout

- `package.json` - scripts and dependencies
- `.env.example` - required environment variables
- `src-node/index.js` - scheduler entrypoint
- `src-node/cli/run-job.js` - run one job manually
- `src-node/jobs/` - scheduled job units
- `src-node/services/` - scoring, drafts, verification, Apollo, and SMTP logic
- `src-node/lib/` - sheets, csv, logging, timestamps
- `src-node/constants/` - sheet column contracts

## Scheduler Jobs

- `import-leads`
- `score-leads`
- `verify-emails`
- `build-company-intel`
- `build-enrichment-addons`
- `build-watchlists`
- `generate-account-alerts`
- `sync-crm-records`
- `build-crm-export-ready`
- `generate-drafts`
- `read-inbox-replies`
- `send-reviewed-drafts`
- `weekly-report`

## Setup

1. Install dependencies
2. Copy `.env.example` to `.env`
3. Fill Google Sheets, ZeroBounce, OpenAI, and SMTP credentials
4. Choose `APOLLO_IMPORT_MODE=csv` or `APOLLO_IMPORT_MODE=apollo`
5. Create the required sheet tabs and headers
6. Run each job manually first

## Commands

```powershell
npm install
npm run bridge
npm run bootstrap:sheets
npm run reset:scored
npm run requeue:raw
npm run run:import
npm run run:score
npm run run:verify
npm run run:intel
npm run run:enrich
npm run run:watchlists
npm run run:alerts
npm run run:crm
npm run run:crm-export
npm run run:replies
npm run run:drafts
npm run run:followups
npm run run:send
npm run run:test-email
npm run run:test-apollo
npm start
```

## Local Bridge For AI SDR Admin

AI SDR by AnutechLabs connects to this project through a local bridge API.

Start it from this folder:

```powershell
npm run bridge
```

Default URL:

```text
http://127.0.0.1:4100
```

Bridge endpoints:

- `GET /api/health` - checks bridge, SMTP readiness, and outreach draft count
- `POST /api/jobs/run` - runs approved client acquisition jobs
- `POST /api/external-drafts` - appends source-aware drafts into `Outreach Drafts`
- `POST /api/send-email` - sends through this tool's SMTP layer, or queues as draft if SMTP is not configured

The outreach queue now stores:

- `draft_source`
- `source_record_id`

Use source values such as:

- `apollo_client_acquisition`
- `ai_sdr`
- `linkedin_future`
- `meta_future`

This keeps Apollo prospects, website leads, and future social leads in one personal marketing funnel while preserving where every draft came from.

To keep the scheduler running after login without an open terminal, use:

```powershell
powershell -ExecutionPolicy Bypass -File "C:\Users\pawan\Documents\Codex\My Sales Tool\Code\scripts\register-sales-scheduler.ps1"
```

## Google Sheet Requirements

Use the tab and column structure defined in:

- `Docs/sheet-tab-mapping.md`
- `Docs/personal-funnel-os.md`
- `Docs/saved-searches-watchlists-crm.md`
- `Docs/enrichment-and-crm-exports.md`

You can create the tabs and headers automatically with:

```powershell
npm run bootstrap:sheets
```

## Reset Helpers

Use these when testing repeatedly:

```powershell
npm run reset:scored
npm run requeue:raw
```

- `reset:scored` clears `Scored Leads` and sets scored raw rows back to `ready_for_scoring`
- `requeue:raw` marks every raw row as `ready_for_scoring`

## Deliverability Note

Keep real sending manual until:

- SPF, DKIM, and DMARC are set correctly
- domain warmup is complete
- ZeroBounce rules are working
- draft quality is stable

For the send layer, only mark rows in `Outreach Drafts` as `reviewed` when you are ready for a controlled send.

For inbound reply handling, run:

```powershell
npm run run:replies
```

This reads mailbox replies and creates suggested responses in `Reply Drafts` for manual review.

Before live prospect sending, test SMTP safely with:

```powershell
npm run run:test-email
```

## Legacy Python MVP

The older Python files are still present for reference:

- `src/main.py`
- `src/scoring.py`
- `src/offers.py`
- `src/outreach.py`

They are no longer the preferred runtime path.
