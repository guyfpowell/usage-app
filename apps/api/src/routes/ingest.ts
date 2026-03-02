import { Router } from 'express'
import multer from 'multer'
import { parse } from 'fast-csv'
import { Readable } from 'stream'
import prisma from '../lib/prisma'
import { isInternalEmail } from '../lib/domains'

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
})

const router = Router()

interface CsvRow {
  [key: string]: string
}

interface ParsedRow {
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

function col(row: CsvRow, ...names: string[]): string | undefined {
  for (const name of names) {
    const val = row[name]
    if (val !== undefined && val !== '') return val
  }
  return undefined
}

function parseRow(row: CsvRow): ParsedRow | null {
  const userId = col(row, 'userId', 'user_id')
  const requestTimeStr = col(row, 'requestTime', 'request_time')
  if (!userId || !requestTimeStr) return null

  const requestTime = new Date(requestTimeStr)
  if (isNaN(requestTime.getTime())) return null

  const feedbackValue = col(row, 'feedbackValue', 'feedback_value') ?? null
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
      res.json({ inserted: 0, updated: 0 })
      return
    }

    const existing = await prisma.usageRecord.findMany({
      where: { OR: parsed.map(r => ({ userId: r.userId, requestTime: r.requestTime })) },
      select: { userId: true, requestTime: true },
    })

    const existingKeys = new Set(
      existing.map(r => `${r.userId}|${r.requestTime.toISOString()}`)
    )

    const toCreate = parsed.filter(
      r => !existingKeys.has(`${r.userId}|${r.requestTime.toISOString()}`)
    )
    const toUpdate = parsed.filter(r =>
      existingKeys.has(`${r.userId}|${r.requestTime.toISOString()}`)
    )

    if (toCreate.length > 0) {
      await prisma.usageRecord.createMany({ data: toCreate })
    }

    for (const row of toUpdate) {
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
    }

    res.json({ inserted: toCreate.length, updated: toUpdate.length })
  })().catch(err => {
    console.error(err)
    if (!res.headersSent) res.status(500).json({ error: 'Ingest failed' })
  })
})

export default router
