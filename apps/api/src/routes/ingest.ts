import { Router } from 'express'
import multer from 'multer'
import { parse } from 'fast-csv'
import { Readable } from 'stream'
import { isInternalEmail, loadDomains } from '../lib/domains'
import { runUpsertPipeline } from '../lib/upsert'

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
})

const router = Router()

export interface CsvRow {
  [key: string]: string
}

export interface ParsedRow {
  traceId: string | null
  userId: string
  requestTime: Date
  requestContent: string
  responseContent: string
  feedbackValue: string | null
  rationale: string | null
  toolRoute: string
  ttftSeconds: number | null
  isInternal: boolean
  hasFeedback: boolean
}

export function col(row: CsvRow, ...names: string[]): string | undefined {
  for (const name of names) {
    const val = row[name]
    if (val !== undefined && val !== '') return val
  }
  return undefined
}

/** Parses a date string in either ISO format or DD/MM/YYYY HH:MM format.
 *  Seconds are always truncated so both formats match on the same key. */
export function parseRequestTime(raw: string): Date | null {
  // DD/MM/YYYY HH:MM  or  DD/MM/YYYY HH:MM:SS
  const ddmmMatch = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{2}:\d{2}(?::\d{2})?)$/)
  if (ddmmMatch) {
    const [, dd, mm, yyyy, time] = ddmmMatch
    const d = new Date(`${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}T${time}`)
    if (isNaN(d.getTime())) return null
    d.setSeconds(0, 0)
    return d
  }
  const d = new Date(raw)
  if (isNaN(d.getTime())) return null
  d.setSeconds(0, 0)
  return d
}

export function parseRow(row: CsvRow): ParsedRow | null {
  const userId = col(row, 'userId', 'user_id')
  const requestTimeStr = col(row, 'requestTime', 'request_time')
  if (!userId || !requestTimeStr) return null

  const requestTime = parseRequestTime(requestTimeStr)
  if (!requestTime) return null

  const rawFeedback = col(row, 'feedbackValue', 'feedback_value')
  const feedbackValue = rawFeedback ? rawFeedback.trim().replace(/^["']+|["']+$/g, '').trim() || null : null
  const rationale = col(row, 'rationale') ?? null
  const ttftRaw = col(row, 'ttftSeconds', 'ttft_seconds', 'ttft')
  const ttft = ttftRaw ? parseFloat(ttftRaw) : null

  return {
    traceId: col(row, 'traceId', 'trace_id') ?? null,
    userId,
    requestTime,
    requestContent: col(row, 'requestContent', 'request_content') ?? '',
    responseContent: col(row, 'responseContent', 'response_content') ?? '',
    feedbackValue,
    rationale,
    toolRoute: col(row, 'toolRoute', 'tool_route') ?? '',
    ttftSeconds: ttft !== null && !isNaN(ttft) ? ttft : null,
    isInternal: isInternalEmail(userId),
    hasFeedback: !!(feedbackValue || rationale),
  }
}

router.post('/csv', upload.single('file'), (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: 'No file provided' })
    return
  }

  const file = req.file

  void (async () => {
    // Reload domain cache so isInternal is correct even if seed ran after startup
    await loadDomains()

    const rawRows: CsvRow[] = []

    await new Promise<void>((resolve, reject) => {
      Readable.from(file.buffer)
        .pipe(parse({ headers: true, trim: true }))
        .on('data', (row: CsvRow) => rawRows.push(row))
        .on('error', reject)
        .on('end', resolve)
    })

    const parsed = rawRows
      .map(parseRow)
      .filter((r): r is ParsedRow => r !== null)

    if (parsed.length === 0) {
      res.json({ inserted: 0, updated: 0, batchId: null })
      return
    }

    const result = await runUpsertPipeline(parsed, file.originalname, 'csv')
    res.json(result)
  })().catch(err => {
    console.error(err)
    if (!res.headersSent) res.status(500).json({ error: 'Ingest failed' })
  })
})

export default router
