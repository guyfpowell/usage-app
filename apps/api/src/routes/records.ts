import { Router } from 'express'
import { Prisma } from '@prisma/client'
import ExcelJS from 'exceljs'
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

    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet('Records')

    // Column definitions: header, key, width, wrapText
    const columns: { header: string; key: string; width: number; wrap?: boolean }[] = [
      { header: 'ID',               key: 'id',               width: 8 },
      { header: 'Trace ID',         key: 'traceId',          width: 22 },
      { header: 'User ID',          key: 'userId',           width: 28 },
      { header: 'Request Time',     key: 'requestTime',      width: 22 },
      { header: 'Tool Route',       key: 'toolRoute',        width: 28 },
      { header: 'Internal',         key: 'isInternal',       width: 10 },
      { header: 'Has Feedback',     key: 'hasFeedback',      width: 14 },
      { header: 'Feedback Value',   key: 'feedbackValue',    width: 16 },
      { header: 'Rationale',        key: 'rationale',        width: 45, wrap: true },
      { header: 'Classification',   key: 'classification',   width: 22 },
      { header: 'Notes',            key: 'groupText',        width: 30, wrap: true },
      { header: 'Ticket',           key: 'ticketText',       width: 18 },
      { header: 'Epic',             key: 'epicKey',          width: 32 },
      { header: 'TTFT (s)',         key: 'ttftSeconds',      width: 10 },
      { header: 'Customer Response',key: 'customerResponse', width: 50, wrap: true },
      { header: 'Request Content',  key: 'requestContent',   width: 60, wrap: true },
      { header: 'Response Content', key: 'responseContent',  width: 60, wrap: true },
    ]

    ws.columns = columns.map(c => ({ header: c.header, key: c.key, width: c.width }))

    // Style header row: bold, light blue background, auto-filter
    const headerRow = ws.getRow(1)
    headerRow.font = { bold: true }
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } }
    headerRow.alignment = { vertical: 'middle', wrapText: false }
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } }

    // Freeze the header row
    ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 1, topLeftCell: 'A2', activeCell: 'A2' }]

    // Excel hard limit is 32,767 characters per cell
    const cap = (s: string | null | undefined) => (s ?? '').slice(0, 32767)

    // Add data rows
    for (const r of records) {
      const row = ws.addRow({
        id: r.id,
        traceId: r.traceId ?? '',
        userId: r.userId,
        requestTime: new Date(r.requestTime).toISOString(),
        toolRoute: r.toolRoute,
        isInternal: r.isInternal ? 'Yes' : 'No',
        hasFeedback: r.hasFeedback ? 'Yes' : 'No',
        feedbackValue: r.feedbackValue ?? '',
        rationale: cap(r.rationale),
        classification: r.classification,
        groupText: cap(r.groupText),
        ticketText: r.ticketText ?? '',
        epicKey: r.epicKey && process.env.JIRA_HOST
          ? `https://${process.env.JIRA_HOST}/browse/${r.epicKey}`
          : r.epicKey ?? '',
        ttftSeconds: r.ttftSeconds ?? '',
        customerResponse: cap(r.customerResponse),
        requestContent: cap(r.requestContent),
        responseContent: cap(r.responseContent),
      })
      // Apply wrap text to designated columns
      columns.forEach((c, i) => {
        if (c.wrap) {
          row.getCell(i + 1).alignment = { wrapText: true, vertical: 'top' }
        }
      })
    }

    const date = new Date().toISOString().split('T')[0]
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename="records-${date}.xlsx"`)
    await wb.xlsx.write(res)
    res.end()
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

    const { classification, groupText, ticketText, epicKey, linkedIssueKey, customerResponse } = req.body as Record<string, string | undefined>

    const record = await prisma.usageRecord.update({
      where: { id },
      data: {
        ...(classification !== undefined && { classification }),
        ...(groupText !== undefined && { groupText }),
        ...(ticketText !== undefined && { ticketText }),
        ...(epicKey !== undefined && { epicKey }),
        ...(linkedIssueKey !== undefined && { linkedIssueKey }),
        ...(customerResponse !== undefined && { customerResponse }),
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
