import { Router } from 'express'
import { Prisma } from '@prisma/client'
import * as XLSX from 'xlsx'
import prisma from '../lib/prisma'

const router = Router()

router.get('/', (req, res) => {
  void (async () => {
    const {
      type,
      hasFeedback,
      hasJira,
      toolRoute,
      userId,
      feedbackValue,
      week,
      dateFrom,
      dateTo,
      page = '1',
      pageSize = '50',
    } = req.query as Record<string, string>

    const where: Prisma.UsageRecordWhereInput = {}

    if (type === 'internal') where.isInternal = true
    else if (type === 'external') where.isInternal = false

    if (hasFeedback === 'true') where.hasFeedback = true
    else if (hasFeedback === 'false') where.hasFeedback = false

    if (hasJira === 'true') where.jiraIssueKey = { not: null }
    else if (hasJira === 'false') where.jiraIssueKey = null

    if (toolRoute) where.toolRoute = toolRoute
    if (userId) where.userId = userId
    if (feedbackValue) where.feedbackValue = feedbackValue

    if (week) {
      try {
        const { start, end } = parseIsoWeek(week)
        where.requestTime = { gte: start, lt: end }
      } catch {
        res.status(400).json({ error: 'Invalid week format. Use YYYY-WNN' })
        return
      }
    }

    if (dateFrom || dateTo) {
      where.requestTime = parseDateRange(dateFrom, dateTo)
    }

    const pageNum = Math.max(1, parseInt(page) || 1)
    const size = Math.min(200, Math.max(1, parseInt(pageSize) || 50))

    const [total, records] = await Promise.all([
      prisma.usageRecord.count({ where }),
      prisma.usageRecord.findMany({
        where,
        orderBy: { requestTime: 'desc' },
        skip: (pageNum - 1) * size,
        take: size,
      }),
    ])

    res.json({ total, page: pageNum, pageSize: size, records })
  })().catch(err => {
    console.error(err)
    res.status(500).json({ error: 'Failed to fetch records' })
  })
})

// GET /records/export — download all matching records as Excel (same filters, no pagination)
router.get('/export', (req, res) => {
  void (async () => {
    const {
      type,
      hasFeedback,
      hasJira,
      toolRoute,
      userId,
      feedbackValue,
      week,
      dateFrom,
      dateTo,
    } = req.query as Record<string, string>

    const where: Prisma.UsageRecordWhereInput = {}

    if (type === 'internal') where.isInternal = true
    else if (type === 'external') where.isInternal = false

    if (hasFeedback === 'true') where.hasFeedback = true
    else if (hasFeedback === 'false') where.hasFeedback = false

    if (hasJira === 'true') where.jiraIssueKey = { not: null }
    else if (hasJira === 'false') where.jiraIssueKey = null

    if (toolRoute) where.toolRoute = toolRoute
    if (userId) where.userId = userId
    if (feedbackValue) where.feedbackValue = feedbackValue

    if (week) {
      try {
        const { start, end } = parseIsoWeek(week)
        where.requestTime = { gte: start, lt: end }
      } catch {
        res.status(400).json({ error: 'Invalid week format. Use YYYY-WNN' })
        return
      }
    }

    if (dateFrom || dateTo) {
      where.requestTime = parseDateRange(dateFrom, dateTo)
    }

    const records = await prisma.usageRecord.findMany({
      where,
      orderBy: { requestTime: 'desc' },
    })

    const rows = records.map(r => ({
      ID: r.id,
      'Trace ID': r.traceId ?? '',
      'User ID': r.userId,
      'Request Time': new Date(r.requestTime).toISOString(),
      'Tool Route': r.toolRoute,
      Internal: r.isInternal ? 'Yes' : 'No',
      'Has Feedback': r.hasFeedback ? 'Yes' : 'No',
      'Feedback Value': r.feedbackValue ?? '',
      Rationale: r.rationale ?? '',
      Classification: r.classification,
      Notes: r.groupText ?? '',
      Ticket: r.ticketText ?? '',
      Epic: r.epicKey && process.env.JIRA_HOST
        ? `https://${process.env.JIRA_HOST}/browse/${r.epicKey}`
        : r.epicKey ?? '',
      'TTFT (s)': r.ttftSeconds ?? '',
      'Request Content': r.requestContent,
      'Response Content': r.responseContent,
    }))

    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(rows)
    XLSX.utils.book_append_sheet(wb, ws, 'Records')

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
    const date = new Date().toISOString().split('T')[0]

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename="records-${date}.xlsx"`)
    res.send(buf)
  })().catch(err => {
    console.error(err)
    res.status(500).json({ error: 'Export failed' })
  })
})

router.patch('/:id', (req, res) => {
  void (async () => {
    const id = parseInt(req.params.id)
    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid id' })
      return
    }

    const { classification, groupText, ticketText, epicKey, linkedIssueKey } = req.body as Record<string, string | undefined>

    const record = await prisma.usageRecord.update({
      where: { id },
      data: {
        ...(classification !== undefined && { classification }),
        ...(groupText !== undefined && { groupText }),
        ...(ticketText !== undefined && { ticketText }),
        ...(epicKey !== undefined && { epicKey }),
        ...(linkedIssueKey !== undefined && { linkedIssueKey }),
      },
    })

    res.json(record)
  })().catch(err => {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2025'
    ) {
      res.status(404).json({ error: 'Record not found' })
    } else {
      console.error(err)
      res.status(500).json({ error: 'Update failed' })
    }
  })
})

/** Returns a half-open [gte, lt) range suitable for a Prisma requestTime filter.
 *  dateTo is made inclusive by advancing to the start of the next UTC day. */
export function parseDateRange(
  dateFrom?: string,
  dateTo?: string
): { gte?: Date; lt?: Date } {
  const range: { gte?: Date; lt?: Date } = {}
  if (dateFrom) range.gte = new Date(dateFrom)
  if (dateTo) {
    const end = new Date(dateTo)
    end.setUTCDate(end.getUTCDate() + 1)
    range.lt = end
  }
  return range
}

router.get('/users', (req, res) => {
  void (async () => {
    const users = await prisma.usageRecord.findMany({
      select: { userId: true },
      distinct: ['userId'],
      orderBy: { userId: 'asc' },
    })
    res.json(users.map(u => u.userId))
  })().catch(err => {
    console.error(err)
    res.status(500).json({ error: 'Failed to fetch users' })
  })
})

router.get('/feedback-values', (req, res) => {
  void (async () => {
    const rows = await prisma.usageRecord.findMany({
      select: { feedbackValue: true },
      distinct: ['feedbackValue'],
      where: { feedbackValue: { not: null } },
      orderBy: { feedbackValue: 'asc' },
    })
    res.json(rows.map(r => r.feedbackValue as string))
  })().catch(err => {
    console.error(err)
    res.status(500).json({ error: 'Failed to fetch feedback values' })
  })
})

export function parseIsoWeek(week: string): { start: Date; end: Date } {
  const match = week.match(/^(\d{4})-W(\d{1,2})$/)
  if (!match) throw new Error(`Invalid ISO week: ${week}`)

  const year = parseInt(match[1])
  const weekNum = parseInt(match[2])

  // Jan 4 is always in ISO week 1
  const jan4 = new Date(Date.UTC(year, 0, 4))
  const dow = jan4.getUTCDay() || 7 // 1=Mon … 7=Sun

  const weekStart = new Date(jan4)
  weekStart.setUTCDate(jan4.getUTCDate() - (dow - 1) + (weekNum - 1) * 7)

  const weekEnd = new Date(weekStart)
  weekEnd.setUTCDate(weekStart.getUTCDate() + 7)

  return { start: weekStart, end: weekEnd }
}

export default router
