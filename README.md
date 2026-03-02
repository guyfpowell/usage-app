# Usage App

An internal tool for ingesting, reviewing, classifying, and acting on Claude AI usage records.

## What it does

- Upload usage CSVs and stream them into Postgres via an upsert pipeline
- Browse and filter records (internal vs external, feedback status, tool route, date range)
- Classify records and add group/ticket text inline
- Bulk-create Jira issues from selected records with automatic key write-back
- View weekly analytics: usage counts (including zero-usage weeks), avg TTFT, feedback breakdown by tool route

## Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js (App Router) + Tailwind CSS |
| API | Node.js + Express |
| Database | PostgreSQL 16 (Docker) |
| ORM | Prisma |
| CSV parsing | fast-csv |
| Jira client | jira.js |
| Package manager | pnpm (monorepo workspaces) |
| Testing | Vitest + React Testing Library |

## Project Structure

```
/
├── apps/
│   ├── api/          # Express API + Prisma
│   └── web/          # Next.js frontend
├── docker-compose.yml
├── pnpm-workspace.yaml
├── plan.md           # Phased implementation plan
└── README.md
```

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm
- Docker

### Setup

```bash
# Install dependencies
pnpm install

# Start Postgres
docker compose up -d db

# Run migrations
pnpm prisma migrate dev

# Start API (port 3001)
pnpm --filter api dev

# Start Web (port 3000)
pnpm --filter web dev
```

### Environment Variables

Create `apps/api/.env`:

```env
DATABASE_URL=postgresql://app:app@localhost:5432/usage
JIRA_HOST=your-domain.atlassian.net
JIRA_EMAIL=your@email.com
JIRA_API_TOKEN=your-api-token
JIRA_PROJECT_KEY=PROJ
JIRA_ISSUE_TYPE=Task
```

## API Routes

| Method | Route | Description |
|---|---|---|
| `POST` | `/ingest/csv` | Upload and parse a CSV of usage records |
| `GET` | `/records` | List records with filters |
| `PATCH` | `/records/:id` | Update classification, groupText, ticketText |
| `POST` | `/jira/create` | Create Jira issues from record IDs |
| `GET` | `/analytics/weekly` | Weekly usage count + avg TTFT |
| `GET` | `/analytics/overall` | Overall avg TTFT |
| `GET` | `/analytics/feedback-by-route` | Feedback count grouped by tool route |

## Running Tests

```bash
# API tests
pnpm --filter api test

# Web tests
pnpm --filter web test
```

## Implementation Plan

See [plan.md](plan.md) for the full phased implementation plan with Claude prompts for each phase.

## Status

| Phase | Status |
|---|---|
| Phase 0 — Bootstrap | ✅ Done |
| Phase 1 — Data Layer | ✅ Done |
| Phase 2 — API Core | ✅ Done |
| Phase 3 — Jira Integration | ✅ Done |
| Phase 4 — Analytics API | ✅ Done |
| Phase 5 — Frontend | ✅ Done |
| Phase 6 — Hardening | ⬜ Out of scope |
