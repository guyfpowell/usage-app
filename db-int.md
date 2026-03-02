# Databricks Integration — Investigation & Plan

## Overview

Replace the manual CSV export → upload workflow with a **"Get Latest" button** in the app.
Clicking it will query Azure Databricks directly, pull new usage records since the last ingest,
and run them through the existing upsert + batch-tracking pipeline.
No fully automated schedule is required at this stage.

---

## How It Would Work (End-to-End)

```
[User clicks "Get Latest"]
        │
        ▼
API: POST /ingest/databricks
        │
        ├─ Determine date range: records since last successful ingest (or configurable lookback window)
        │
        ├─ Execute SQL against Databricks SQL Warehouse via REST API
        │
        ├─ Map result rows → ParsedRow (same shape as CSV rows today)
        │
        └─ Feed into existing upsert + UploadBatch pipeline
                │
                └─ Return { inserted, updated, batchId } — same as CSV upload
```

The Upload page already shows batch history and supports rollback, so Databricks pulls
will appear there automatically alongside manual CSV uploads.

---

## Connection Approach

Databricks exposes a **Statement Execution REST API** — no special driver or SDK required.

```
POST https://{workspace-url}/api/2.0/sql/statements
Authorization: Bearer {personal_access_token}
Body: { "warehouse_id": "...", "statement": "SELECT ...", "wait_timeout": "30s" }
```

Results come back as JSON with column metadata + rows. This is the simplest path from Node.js
and avoids adding a native JDBC/ODBC dependency.

---

## Confirmed Configuration

| Item | Value |
|---|---|
| Workspace URL | `https://adb-81631168259822.2.azuredatabricks.net` |
| Warehouse ID | `c9323cf3e23f2d0f` |
| Token | Set in `apps/api/.env` as `DATABRICKS_TOKEN` |
| Source table | `editorial_prod.offline_copilot.traces` |

---

## Confirmed SQL Query

The source query is confirmed. It queries `editorial_prod.offline_copilot.traces` with a LEFT JOIN
to `editorial_prod.offline_copilot.requests_enriched`.

For the integration, we'll add a date filter parameter:
```sql
AND t.request_time > TIMESTAMP('{lastIngestTime}')
```

### Column Mapping (fully confirmed)

| Databricks column | App field | Notes |
|---|---|---|
| `user_id` | `userId` | Direct |
| `request_time` | `requestTime` | Direct |
| `trace_id` | `traceId` | Direct |
| `request_content` | `requestContent` | Last message extracted via JSON |
| `response_content` | `responseContent` | Concatenated delta content |
| `feedback_value` | `feedbackValue` | Human assessments only (non-LLM_JUDGE) |
| `rationale` | `rationale` | Human assessments only |
| `tool_route` | `toolRoute` | Span-based routing path |
| `ttft_seconds` | `ttftSeconds` | Calculated from span start times |

All 9 required fields map cleanly — no gaps.

### Exclusion list
The source query already excludes internal/dev users via a WHERE NOT IN list.
The app's `isInternalEmail` domain logic will still run on the results to set the `isInternal` flag
for any remaining `@pei.group` emails.

### Pagination
The Databricks Statement Execution API returns results in chunks (default 10,000 rows per chunk).
The implementation will handle `next_chunk_index` to page through large result sets automatically.

---

## My Tasks (Implementation)

| # | Task |
|---|------|
| 1 | Add `DATABRICKS_HOST`, `DATABRICKS_WAREHOUSE_ID` env vars to `.env` (token already added) |
| 2 | Write `apps/api/src/lib/databricks.ts` — REST API wrapper with pagination support |
| 3 | Write column mapper: Databricks row → `ParsedRow` |
| 4 | Add `POST /ingest/databricks` route — determines lookback window, calls Databricks, feeds into existing upsert pipeline |
| 5 | Register new route in `apps/api/src/index.ts` |
| 6 | Add "Get Latest from Databricks" button to Upload page |
| 7 | Show pending/result state (same pattern as CSV upload) |
| 8 | Update `README.md` with new env vars and endpoint |

---

## One Remaining Decision (For You)

**Date range / lookback strategy — how should "Get Latest" decide what to fetch?**

- **Option A — Since last ingest (recommended):** fetch records where `request_time > createdAt` of the
  most recent non-rolled-back `UploadBatch`. Falls back to 30 days if no prior batch exists.
  Pro: never misses records, no duplication pressure (upsert handles it anyway).

- **Option B — Fixed rolling window:** always fetch the last N days (e.g. 14).
  Pro: simpler, self-healing if a pull fails. Con: re-processes older records each time (upsert handles it, just slower).

- **Option C — User picks date range in UI:** date pickers on the Upload page.
  Pro: full control. Con: more UI work.

Confirm which you'd prefer and I'll start building.

---

## Open Questions (Resolved)

- ~~Workspace URL~~ ✓
- ~~Warehouse ID~~ ✓
- ~~Access token~~ ✓
- ~~SQL query and column mapping~~ ✓
- Date range strategy — **pending your decision above**
