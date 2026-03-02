# Claude Code CLI Instructions

## Build in Existing Folder: /Users/guy-pei/code/personal/usage

Generated: 2026-03-02T09:43:53.854007 UTC

------------------------------------------------------------------------

# ✅ Starting Assumptions

-   Claude CLI is already installed
-   You want to build directly inside:

/Users/guy-pei/code/personal/usage

-   This is a test app (lightweight, clean architecture, well-supported
    libraries only)

Stack:

-   Next.js (React frontend)
-   Node + Express (API)
-   PostgreSQL (Docker)
-   Prisma ORM
-   fast-csv
-   jira.js
-   Docker (database only)

------------------------------------------------------------------------

# 1️⃣ Navigate to Your Project Folder

``` bash
cd /Users/guy-pei/code/personal/usage
git init
```

------------------------------------------------------------------------

# 2️⃣ Start Claude in This Folder

``` bash
claude
```

Claude will now operate relative to:

/Users/guy-pei/code/personal/usage

------------------------------------------------------------------------

# 3️⃣ Scaffold the Monorepo

Paste this prompt into Claude:

------------------------------------------------------------------------

## 🧠 Prompt 1 -- Initialise Monorepo Here

Create a TypeScript monorepo IN THIS CURRENT FOLDER with:

-   pnpm workspaces at root
-   apps/api (Express + Prisma)
-   apps/web (Next.js App Router)
-   docker-compose.yml with Postgres 16
-   Strict TypeScript
-   Minimal ESLint
-   No unnecessary abstraction
-   Production-ready structure but lightweight

Do NOT create a nested folder. Build everything relative to this
directory.

------------------------------------------------------------------------

Then run:

``` bash
pnpm install
```

------------------------------------------------------------------------

# 4️⃣ Add Prisma Schema

Run Claude again:

``` bash
claude
```

------------------------------------------------------------------------

## 🧠 Prompt 2 -- Prisma Models

Create Prisma schema with:

UsageRecord: - traceId - userId - requestTime - requestContent -
responseContent - feedbackValue - rationale - toolRoute - ttftSeconds -
isInternal (boolean) - hasFeedback (boolean) - classification default
"To be classified" - groupText - ticketText - jiraIssueKey -
jiraIssueUrl - unique constraint (userId, requestTime)

InternalDomain: - domain unique

Classification: - name unique - isActive

Add indexes: - toolRoute - isInternal - hasFeedback

------------------------------------------------------------------------

Then:

``` bash
docker compose up -d db
pnpm prisma migrate dev
```

------------------------------------------------------------------------

# 5️⃣ CSV Ingest Endpoint

Open Claude again.

------------------------------------------------------------------------

## 🧠 Prompt 3 -- CSV Upload Route

Create Express route:

POST /ingest/csv

Requirements:

-   multer for file upload
-   fast-csv streaming parser
-   Load InternalDomain from DB
-   isInternal = email endsWith any domain
-   hasFeedback = feedbackValue OR rationale not null
-   Upsert on (userId, requestTime)
-   DO NOT overwrite classification, groupText, ticketText
-   Return: inserted count updated count

Use Prisma client properly.

------------------------------------------------------------------------

------------------------------------------------------------------------

# 6️⃣ Records API

## 🧠 Prompt 4 -- Records Routes

Create:

GET /records Filters: - internal/external - hasFeedback - toolRoute -
ISO week filter

PATCH /records/:id Update: - classification - groupText - ticketText

------------------------------------------------------------------------

# 7️⃣ Jira Integration

Add environment variables in apps/api/.env

    DATABASE_URL=postgresql://app:app@localhost:5432/usage
    JIRA_HOST=your-domain.atlassian.net
    JIRA_EMAIL=...
    JIRA_API_TOKEN=...
    JIRA_PROJECT_KEY=...
    JIRA_ISSUE_TYPE=Task

------------------------------------------------------------------------

## 🧠 Prompt 5 -- Jira Creation Route

Create:

POST /jira/create

Input: array of UsageRecord IDs

For each record: - Create Jira issue using jira.js - Summary from
requestContent - Description includes: userId toolRoute feedbackValue
rationale - Store: jiraIssueKey jiraIssueUrl - Automatically update
ticketText with URL

Return created issue details.

------------------------------------------------------------------------

# 8️⃣ Analytics

## 🧠 Prompt 6 -- Analytics Endpoints

Create:

GET /analytics/weekly - Weekly usage count - Weekly avg ttftSeconds

GET /analytics/overall - Overall avg ttftSeconds

GET /analytics/feedback-by-route - Count hasFeedback true grouped by
toolRoute - Order descending

Use raw SQL via Prisma.

------------------------------------------------------------------------

# 9️⃣ Frontend (Next.js)

Open Claude again.

------------------------------------------------------------------------

## 🧠 Prompt 7 -- Build UI

Create pages:

/upload - Drag & drop CSV - Call /ingest/csv - Show inserted vs updated

/records - Table using TanStack Table - Filters: internal/external
hasFeedback toolRoute week - Editable: classification (dropdown from DB)
groupText ticketText - Bulk select → Create Jira

/analytics - Weekly usage table - Avg TTFT overall - Feedback by
toolRoute

Use: - React Query - Minimal Tailwind - No heavy UI frameworks

------------------------------------------------------------------------

# 🔁 Recommended Claude Workflow

Work incrementally:

1.  Generate one feature
2.  Run it
3.  Fix errors
4.  Ask Claude to modify specific files only
5.  Avoid full repo regeneration

------------------------------------------------------------------------

# 🚀 Start Dev

In separate terminals:

API:

``` bash
pnpm --filter api dev
```

Web:

``` bash
pnpm --filter web dev
```

------------------------------------------------------------------------

# Future Improvements

-   Authentication
-   Role-based access
-   Background job queue for Jira
-   CSV schema validation via zod
-   Logging (pino)
-   Tests (vitest)

------------------------------------------------------------------------

End of Instructions for: /Users/guy-pei/code/personal/usage
