# Usage App — Implementation Plan

**Stack:** Next.js · Express · PostgreSQL · Prisma · fast-csv · jira.js · Docker
**Monorepo root:** `/Users/guy-pei/code/personal/usage`
**Updated:** 2026-03-02

---

## Overview

A lightweight internal tool for ingesting, reviewing, and acting on Claude AI usage records. Users upload CSVs, browse and classify records, trigger Jira ticket creation, and view analytics.

---

## Phase Dependency Graph

```
Phase 0 — Bootstrap
    └── Phase 1 — Data Layer
            └── Phase 2 — API Core
                    ├── Phase 3 — Jira Integration
                    ├── Phase 4 — Analytics API
                    └── Phase 5 — Frontend
                                    └── Phase 6 — Hardening
```

---

## Phase 0 — Project Bootstrap

**Goal:** Initialise the monorepo, install tooling, wire up Docker.

**Steps:**
1. `git init` (already done)
2. Scaffold pnpm monorepo with workspaces
3. Add `docker-compose.yml` with Postgres 16
4. Configure root `tsconfig`, `.eslintrc`, `.gitignore`
5. Run `pnpm install`

**Claude Prompt:**
```
Create a TypeScript monorepo IN THIS CURRENT FOLDER with:
- pnpm workspaces at root
- apps/api (Express + Prisma)
- apps/web (Next.js App Router)
- docker-compose.yml with Postgres 16
- Strict TypeScript
- Minimal ESLint
- No unnecessary abstraction
- Production-ready structure but lightweight

Do NOT create a nested folder. Build everything relative to this directory.
```

**Commands:**
```bash
pnpm install
```

**Done when:** `pnpm install` completes; `docker compose up -d db` starts Postgres.

---

## Phase 1 — Data Layer

**Goal:** Define all database models, indexes, and seed reference data.

**Depends on:** Phase 0

**Models:**

| Model | Key Fields |
|---|---|
| `UsageRecord` | traceId, userId, requestTime, requestContent, responseContent, feedbackValue, rationale, toolRoute, ttftSeconds, isInternal, hasFeedback, classification (default "To be classified"), groupText, ticketText, jiraIssueKey, jiraIssueUrl |
| `InternalDomain` | domain (unique) |
| `Classification` | name (unique), isActive |

**Constraints & Indexes:**
- Unique constraint: `(userId, requestTime)` on `UsageRecord`
- Indexes: `toolRoute`, `isInternal`, `hasFeedback`

**Claude Prompt:**
```
Create Prisma schema with:

UsageRecord: traceId, userId, requestTime, requestContent,
responseContent, feedbackValue, rationale, toolRoute, ttftSeconds,
isInternal (boolean), hasFeedback (boolean), classification default
"To be classified", groupText, ticketText, jiraIssueKey, jiraIssueUrl,
unique constraint (userId, requestTime)

InternalDomain: domain unique

Classification: name unique, isActive

Add indexes: toolRoute, isInternal, hasFeedback
```

**Commands:**
```bash
docker compose up -d db
pnpm prisma migrate dev
```

**Done when:** Migration runs clean; all tables visible in Postgres.

---

## Phase 2 — API Core

**Goal:** CSV ingestion and records CRUD endpoints.

**Depends on:** Phase 1

### 2a — CSV Ingest Endpoint

**Route:** `POST /ingest/csv`

**Logic:**
- `multer` receives the uploaded file
- `fast-csv` streams and parses rows
- Load `InternalDomain` list from DB at startup, cache in memory
- Derive `isInternal` — email ends with any known domain
- Derive `hasFeedback` — `feedbackValue` OR `rationale` is non-null
- **Upsert** on `(userId, requestTime)` — never overwrite `classification`, `groupText`, `ticketText`
- Return `{ inserted, updated }` counts

**Claude Prompt:**
```
Create Express route POST /ingest/csv:
- multer for file upload
- fast-csv streaming parser
- Load InternalDomain from DB
- isInternal = email endsWith any domain
- hasFeedback = feedbackValue OR rationale not null
- Upsert on (userId, requestTime)
- DO NOT overwrite classification, groupText, ticketText
- Return: inserted count, updated count
Use Prisma client properly.
```

### 2b — Records API

**Routes:**
- `GET /records` — paginated list; filters: `internal/external`, `hasFeedback`, `toolRoute`, ISO week
- `PATCH /records/:id` — update `classification`, `groupText`, `ticketText`

**Claude Prompt:**
```
Create:
GET /records — filters: internal/external, hasFeedback, toolRoute, ISO week filter
PATCH /records/:id — update: classification, groupText, ticketText
```

**Done when:** CSV upload returns correct counts; record edits persist correctly.

---

## Phase 3 — Jira Integration

**Goal:** Create Jira issues from selected usage records and write back keys.

**Depends on:** Phase 2

**Environment variables** in `apps/api/.env`:
```
DATABASE_URL=postgresql://app:app@localhost:5432/usage
JIRA_HOST=your-domain.atlassian.net
JIRA_EMAIL=...
JIRA_API_TOKEN=...
JIRA_PROJECT_KEY=...
JIRA_ISSUE_TYPE=Task
```

**Route:** `POST /jira/create`

**Logic:**
- Accept array of `UsageRecord` IDs
- For each record, create a Jira issue via `jira.js`:
  - Summary: derived from `requestContent`
  - Description: `userId`, `toolRoute`, `feedbackValue`, `rationale`
- Write back `jiraIssueKey`, `jiraIssueUrl`, and `ticketText` (URL) to the record
- Return list of created issue details

**Claude Prompt:**
```
Create POST /jira/create:
Input: array of UsageRecord IDs
For each record:
- Create Jira issue using jira.js
- Summary from requestContent
- Description includes: userId, toolRoute, feedbackValue, rationale
- Store: jiraIssueKey, jiraIssueUrl
- Automatically update ticketText with URL
Return created issue details.
```

**Done when:** Jira issues appear in the configured project with correct fields; keys are stored in the DB.

---

## Phase 4 — Analytics API

**Goal:** Expose aggregated metrics endpoints for the frontend.

**Depends on:** Phase 2

**Routes:**

| Endpoint | Returns |
|---|---|
| `GET /analytics/weekly` | Weekly usage count + avg `ttftSeconds` |
| `GET /analytics/overall` | Overall avg `ttftSeconds` |
| `GET /analytics/feedback-by-route` | `hasFeedback=true` count grouped by `toolRoute`, descending |

**Claude Prompt:**
```
Create:
GET /analytics/weekly — weekly usage count, weekly avg ttftSeconds
GET /analytics/overall — overall avg ttftSeconds
GET /analytics/feedback-by-route — count hasFeedback true grouped by toolRoute, order descending
Use raw SQL via Prisma.
```

**Done when:** All three endpoints return data that matches the DB state.

---

## Phase 5 — Frontend (Next.js)

**Goal:** Build the three core UI pages backed by the API.

**Depends on:** Phase 2, Phase 3, Phase 4

**Pages:**

| Route | Description |
|---|---|
| `/upload` | Drag & drop CSV upload; displays inserted vs updated counts |
| `/records` | TanStack Table with filters, inline editing, bulk Jira creation |
| `/analytics` | Weekly usage table, avg TTFT card, feedback-by-route breakdown |

**Tech choices:**
- React Query for all data fetching and mutations
- Minimal Tailwind (no heavy component libraries)
- TanStack Table for records view
- Classification dropdown populated from `GET /classifications`

**Claude Prompt:**
```
Create pages:
/upload — Drag & drop CSV, call /ingest/csv, show inserted vs updated
/records — TanStack Table, filters: internal/external hasFeedback toolRoute week,
  editable: classification (dropdown from DB) groupText ticketText,
  bulk select → Create Jira
/analytics — Weekly usage table, avg TTFT overall, feedback by toolRoute
Use: React Query, minimal Tailwind, no heavy UI frameworks.
```

**Done when:** All three pages render; data flows end-to-end from upload through to Jira creation.

---

## Phase 6 — Hardening & Future Work

**Goal:** Production readiness (deferred; out of scope for initial build).

- Authentication & role-based access control
- Background job queue for Jira (BullMQ or similar)
- CSV schema validation via Zod before DB insert
- Structured logging (pino)
- Test coverage (vitest)

---

## Dev Workflow

```bash
# Start Postgres
docker compose up -d db

# Start API (port 3001)
pnpm --filter api dev

# Start Web (port 3000)
pnpm --filter web dev
```

**Incremental rule:** Generate one phase at a time. Run it. Fix errors. Then move to the next phase. Avoid full-repo regeneration.
