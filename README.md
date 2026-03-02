# Usage App

An internal tool for ingesting, reviewing, classifying, and acting on Claude AI usage records.

## What it does

- Upload usage CSVs and stream them into Postgres via an upsert pipeline; roll back any upload to undo inserts and restore previous state
- Browse and filter records (internal vs external, feedback status, Jira ticket status, tool route, user, date range)
- Classify records, add notes, link to an existing Jira epic or customer-feedback issue inline
- Bulk-create Jira bugs from selected records with automatic key write-back; classification set as a label
- Export filtered records to Excel
- View weekly analytics: usage counts (including zero-usage weeks), avg TTFT, feedback breakdown by tool route (filterable by feedback value)

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
JIRA_PROJECT_KEY=CDO
JIRA_CUSTOM_ENGINEERING_TEAM=customfield_10178
JIRA_CUSTOM_SKILLSET=customfield_10333
```

## API Routes

| Method | Route | Description |
|---|---|---|
| `POST` | `/ingest/csv` | Upload and parse a CSV of usage records |
| `GET` | `/records` | List records with filters |
| `GET` | `/records/export` | Download filtered records as Excel |
| `PATCH` | `/records/:id` | Update classification, groupText, epicKey, linkedIssueKey |
| `GET` | `/batches` | List upload batches |
| `POST` | `/batches/:id/rollback` | Roll back an upload batch |
| `GET` | `/jira/epics` | Active askPEI-labelled epics |
| `GET` | `/jira/customer-feedback-issues` | Open bugs/stories with customer_feedback label |
| `POST` | `/jira/create` | Create Jira bugs from record IDs |
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

