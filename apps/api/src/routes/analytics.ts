import { Router } from 'express'
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

// GET /analytics/weekly — weekly usage count + avg ttftSeconds
router.get('/weekly', (req, res) => {
  void (async () => {
    const rows = await prisma.$queryRaw<WeeklyRow[]>`
      SELECT
        DATE_TRUNC('week', "requestTime") AS week,
        COUNT(*)::int                     AS count,
        AVG("ttftSeconds")                AS avg_ttft
      FROM "UsageRecord"
      GROUP BY week
      ORDER BY week DESC
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

// GET /analytics/feedback-by-route — hasFeedback=true count grouped by toolRoute desc
router.get('/feedback-by-route', (req, res) => {
  void (async () => {
    const rows = await prisma.$queryRaw<FeedbackByRouteRow[]>`
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
