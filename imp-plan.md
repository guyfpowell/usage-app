# Implementation Plan

Each phase ends with: update README → commit → push.
Stop between phases for review/testing before proceeding.

---

## Phase 0 — Bootstrap

**Goal:** Working monorepo skeleton with Postgres running.

**Files to create:**
- `package.json` — pnpm workspaces root (`apps/*`)
- `pnpm-workspace.yaml`
- `tsconfig.json` — strict base config
- `.eslintrc.js` — minimal TypeScript ESLint
- `.gitignore`
- `docker-compose.yml` — Postgres 16, port 5432
- `apps/api/package.json` — Express, Prisma, fast-csv, multer, jira.js
- `apps/api/tsconfig.json`
- `apps/web/package.json` — Next.js 14, React Query, Tailwind, TanStack Table
- `apps/web/tsconfig.json`

**Commands to run:**
```bash
pnpm install
docker compose up -d db
```

**Done when:** `pnpm install` succeeds; `docker compose up -d db` starts Postgres.

---

## Phase 1 — Data Layer

**Goal:** All DB models migrated and visible in Postgres.

**Files to create:**
- `apps/api/prisma/schema.prisma` — `UsageRecord`, `InternalDomain`, `Classification`
- Initial migration via `prisma migrate dev`

**Key schema details:**
- `UsageRecord` unique on `(userId, requestTime)`; indexes on `toolRoute`, `isInternal`, `hasFeedback`; `classification` defaults to `"To be classified"`
- `InternalDomain` — unique domain strings
- `Classification` — unique name, isActive boolean

**Commands to run:**
```bash
pnpm --filter api exec prisma migrate dev --name init
```

**Done when:** Migration runs clean; all three tables exist in Postgres.

---

## Phase 2 — API Core

**Goal:** CSV upload and records CRUD working.

**Files to create:**
- `apps/api/src/index.ts` — Express app entry point
- `apps/api/src/lib/prisma.ts` — Prisma client singleton
- `apps/api/src/routes/ingest.ts` — `POST /ingest/csv`
- `apps/api/src/routes/records.ts` — `GET /records`, `PATCH /records/:id`
- `apps/api/.env` — `DATABASE_URL`

**Ingest logic:**
- multer receives file → fast-csv streams rows
- Load `InternalDomain` from DB on startup, cache in memory
- Derive `isInternal` (email domain match), `hasFeedback` (feedbackValue or rationale non-null)
- Upsert on `(userId, requestTime)` — never overwrite `classification`, `groupText`, `ticketText`
- Return `{ inserted, updated }`

**Records logic:**
- `GET /records` — paginated; filters: `internal/external`, `hasFeedback`, `toolRoute`, ISO week
- `PATCH /records/:id` — update `classification`, `groupText`, `ticketText` only

**Done when:** CSV upload returns correct counts; PATCH persists correctly.

---

## Phase 3 — Jira Integration

**Goal:** Create Jira issues from records and write back keys.

**Files to create/update:**
- `apps/api/src/routes/jira.ts` — `POST /jira/create`
- `apps/api/.env` — add Jira env vars

**Logic:**
- Accept array of `UsageRecord` IDs
- For each: create Jira issue via `jira.js` (summary from `requestContent`; description includes `userId`, `toolRoute`, `feedbackValue`, `rationale`)
- Write back `jiraIssueKey`, `jiraIssueUrl`, `ticketText` to record
- Return list of created issue details

**Done when:** Issues appear in Jira project; keys stored in DB.

---

## Phase 4 — Analytics API

**Goal:** Three aggregated metrics endpoints.

**Files to create:**
- `apps/api/src/routes/analytics.ts`
  - `GET /analytics/weekly` — weekly count + avg `ttftSeconds`
  - `GET /analytics/overall` — overall avg `ttftSeconds`
  - `GET /analytics/feedback-by-route` — `hasFeedback=true` count by `toolRoute` descending

**Done when:** All three endpoints return correct data.

---

## Phase 5 — Frontend

**Goal:** Three working UI pages backed by the API.

**Files to create:**
- `apps/web/app/upload/page.tsx` — drag & drop CSV, show `inserted`/`updated`
- `apps/web/app/records/page.tsx` — TanStack Table, filters, inline edit, bulk Jira create
- `apps/web/app/analytics/page.tsx` — weekly table, avg TTFT card, feedback by route
- `apps/web/lib/api.ts` — typed fetch helpers
- `apps/web/app/layout.tsx` — React Query provider, Tailwind base

**Done when:** All pages render; end-to-end flow works from CSV upload to Jira creation.

---

## Phase 6 — Hardening (out of scope for now)

Auth, job queues, Zod validation, structured logging, test coverage.
