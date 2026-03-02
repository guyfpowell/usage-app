import { Router } from 'express'
import { Prisma } from '@prisma/client'
import prisma from '../lib/prisma'

const router = Router()

interface WeeklyRow {
  week: Date
  count: number
  avg_ttft: string | null
}

interface OverallRow {
  avg_ttft: string | null
}

interface FeedbackByRouteRow {
  toolRoute: string
  count: number
}

// GET /analytics/weekly?type=internal|external — weekly usage count + avg ttftSeconds
router.get('/weekly', (req, res) => {
  void (async () => {
    const { type } = req.query as { type?: string }

    const typeFilter =
      type === 'internal' ? Prisma.sql`WHERE "isInternal" = true` :
      type === 'external' ? Prisma.sql`WHERE "isInternal" = false` :
      Prisma.sql``

    const rows = await prisma.$queryRaw<WeeklyRow[]>`
      WITH date_range AS (
        SELECT
          DATE_TRUNC('week', MIN("requestTime")) AS first_week,
          DATE_TRUNC('week', NOW())              AS last_week
        FROM "UsageRecord"
        ${typeFilter}
      ),
      weeks AS (
        SELECT generate_series(first_week, last_week, '1 week'::interval) AS week
        FROM date_range
      ),
      agg AS (
        SELECT
          DATE_TRUNC('week', "requestTime") AS week,
          COUNT(*)::int                     AS count,
          AVG("ttftSeconds")                AS avg_ttft
        FROM "UsageRecord"
        ${typeFilter}
        GROUP BY week
      )
      SELECT
        w.week,
        COALESCE(a.count, 0)::int AS count,
        a.avg_ttft
      FROM weeks w
      LEFT JOIN agg a ON a.week = w.week
      ORDER BY w.week DESC
    `

    res.json(
      rows.map(r => ({
        week: r.week,
        count: r.count,
        avgTtftSeconds: r.avg_ttft !== null ? Number(r.avg_ttft) : null,
      }))
    )
  })().catch(err => {
    console.error(err)
    res.status(500).json({ error: 'Failed to fetch weekly analytics' })
  })
})

// GET /analytics/overall — overall avg ttftSeconds
router.get('/overall', (req, res) => {
  void (async () => {
    const [row] = await prisma.$queryRaw<OverallRow[]>`
      SELECT AVG("ttftSeconds") AS avg_ttft
      FROM "UsageRecord"
    `

    res.json({
      avgTtftSeconds: row?.avg_ttft !== null ? Number(row?.avg_ttft) : null,
    })
  })().catch(err => {
    console.error(err)
    res.status(500).json({ error: 'Failed to fetch overall analytics' })
  })
})

// GET /analytics/feedback-by-route?feedbackValue=x — count grouped by toolRoute desc
router.get('/feedback-by-route', (req, res) => {
  void (async () => {
    const { feedbackValue } = req.query as { feedbackValue?: string }

    const rows = feedbackValue
      ? await prisma.$queryRaw<FeedbackByRouteRow[]>`
          SELECT "toolRoute", COUNT(*)::int AS count
          FROM "UsageRecord"
          WHERE "feedbackValue" = ${feedbackValue}
          GROUP BY "toolRoute"
          ORDER BY count DESC
        `
      : await prisma.$queryRaw<FeedbackByRouteRow[]>`
          SELECT "toolRoute", COUNT(*)::int AS count
          FROM "UsageRecord"
          WHERE "hasFeedback" = true
          GROUP BY "toolRoute"
          ORDER BY count DESC
        `

    res.json(rows)
  })().catch(err => {
    console.error(err)
    res.status(500).json({ error: 'Failed to fetch feedback-by-route analytics' })
  })
})

export default router
