import { Router } from 'express'
import multer from 'multer'
import { parse } from 'fast-csv'
import { Readable } from 'stream'
import prisma from '../lib/prisma'
import { isInternalEmail, loadDomains } from '../lib/domains'

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

    // Deduplicate within the CSV itself (last row wins for duplicate keys)
    const dedupMap = new Map<string, ParsedRow>()
    for (const row of parsed) {
      dedupMap.set(`${row.userId}|${row.requestTime.toISOString()}`, row)
    }
    const unique = Array.from(dedupMap.values())

    const existing = await prisma.usageRecord.findMany({
      where: { OR: unique.map(r => ({ userId: r.userId, requestTime: r.requestTime })) },
    })

    const existingKeys = new Set(
      existing.map(r => `${r.userId}|${r.requestTime.toISOString()}`)
    )

    const toCreate = unique.filter(
      r => !existingKeys.has(`${r.userId}|${r.requestTime.toISOString()}`)
    )
    const toUpdate = unique.filter(r =>
      existingKeys.has(`${r.userId}|${r.requestTime.toISOString()}`)
    )

    // Create batch record
    const batch = await prisma.uploadBatch.create({
      data: { filename: file.originalname, insertedCount: 0, updatedCount: 0 },
    })

    if (toCreate.length > 0) {
      await prisma.usageRecord.createMany({ data: toCreate })
      // Fetch IDs of newly created records
      const created = await prisma.usageRecord.findMany({
        where: { OR: toCreate.map(r => ({ userId: r.userId, requestTime: r.requestTime })) },
        select: { id: true },
      })
      await prisma.uploadBatchRecord.createMany({
        data: created.map(r => ({ batchId: batch.id, recordId: r.id, action: 'inserted' })),
      })
    }

    for (const row of toUpdate) {
      const prev = existing.find(
        e => e.userId === row.userId && e.requestTime.toISOString() === row.requestTime.toISOString()
      )
      await prisma.usageRecord.update({
        where: { userId_requestTime: { userId: row.userId, requestTime: row.requestTime } },
        data: {
          traceId: row.traceId,
          requestContent: row.requestContent,
          responseContent: row.responseContent,
          feedbackValue: row.feedbackValue,
          rationale: row.rationale,
          toolRoute: row.toolRoute,
          ttftSeconds: row.ttftSeconds,
          isInternal: row.isInternal,
          hasFeedback: row.hasFeedback,
        },
      })
      if (prev) {
        await prisma.uploadBatchRecord.create({
          data: {
            batchId: batch.id,
            recordId: prev.id,
            action: 'updated',
            previousState: {
              traceId: prev.traceId,
              requestContent: prev.requestContent,
              responseContent: prev.responseContent,
              feedbackValue: prev.feedbackValue,
              rationale: prev.rationale,
              toolRoute: prev.toolRoute,
              ttftSeconds: prev.ttftSeconds,
              isInternal: prev.isInternal,
              hasFeedback: prev.hasFeedback,
            },
          },
        })
      }
    }

    await prisma.uploadBatch.update({
      where: { id: batch.id },
      data: { insertedCount: toCreate.length, updatedCount: toUpdate.length },
    })

    res.json({ inserted: toCreate.length, updated: toUpdate.length, batchId: batch.id })
  })().catch(err => {
    console.error(err)
    if (!res.headersSent) res.status(500).json({ error: 'Ingest failed' })
  })
})

export default router
