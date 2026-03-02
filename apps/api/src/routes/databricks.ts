import { Router } from 'express'
import prisma from '../lib/prisma'
import { fetchFromDatabricks, DatabricksRow } from '../lib/databricks'
import { ParsedRow } from './ingest'
import { runUpsertPipeline } from '../lib/upsert'
import { isInternalEmail } from '../lib/domains'

const router = Router()

function mapRow(row: DatabricksRow): ParsedRow | null {
  if (!row.user_id || !row.request_time) return null

  const requestTime = new Date(row.request_time)
  if (isNaN(requestTime.getTime())) return null
  requestTime.setSeconds(0, 0)

  const feedbackValue = row.feedback_value?.trim().replace(/^["']+|["']+$/g, '').trim() || null
  const rationale = row.rationale || null

  return {
    traceId: row.trace_id || null,
    userId: row.user_id,
    requestTime,
    requestContent: row.request_content || '',
    responseContent: row.response_content || '',
    feedbackValue,
    rationale,
    toolRoute: row.tool_route || '',
    ttftSeconds: row.ttft_seconds,
    isInternal: isInternalEmail(row.user_id),
    hasFeedback: !!(feedbackValue || rationale),
  }
}

// POST /ingest/databricks — pull latest records from Databricks and upsert
router.post('/', (req, res) => {
  void (async () => {
    // Find the most recent non-rolled-back Databricks batch to determine lookback window.
    // If none exists this is the first sync — pull all data.
    const lastBatch = await prisma.uploadBatch.findFirst({
      where: { source: 'databricks', isRolledBack: false },
      orderBy: { createdAt: 'desc' },
    })

    const since = lastBatch ? lastBatch.createdAt : undefined
    const label = since
      ? `databricks-sync-since-${since.toISOString().slice(0, 10)}`
      : 'databricks-full-sync'

    console.log(since ? `Databricks: fetching since ${since.toISOString()}` : 'Databricks: full sync (first run)')

    const rows = await fetchFromDatabricks(since)
    console.log(`Databricks: received ${rows.length} rows`)

    const parsed = rows.map(mapRow).filter((r): r is ParsedRow => r !== null)

    const result = await runUpsertPipeline(parsed, label, 'databricks')
    res.json(result)
  })().catch(err => {
    console.error('Databricks ingest error:', err)
    if (!res.headersSent) res.status(500).json({ error: String(err.message ?? err) })
  })
})

export default router
