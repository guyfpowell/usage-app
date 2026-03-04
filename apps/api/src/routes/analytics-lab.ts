import { Router } from 'express'
import prisma from '../lib/prisma'

const router = Router()

// --- PM Module 1: Feedback Funnel by Tool Route ---
router.get('/feedback-funnel', (req, res) => {
  void (async () => {
    const rows = await prisma.$queryRaw<{
      toolRoute: string
      total_requests: number
      feedback_count: number
      classified_count: number
      jira_count: number
      feedback_rate: string
      jira_of_feedback_rate: string
    }[]>`
      SELECT
        "toolRoute",
        COUNT(*)::int AS total_requests,
        COUNT(*) FILTER (WHERE "hasFeedback" = true)::int AS feedback_count,
        COUNT(*) FILTER (WHERE "classification" != 'To be classified')::int AS classified_count,
        COUNT(*) FILTER (WHERE "jiraIssueKey" IS NOT NULL)::int AS jira_count,
        ROUND(100.0 * COUNT(*) FILTER (WHERE "hasFeedback" = true) / NULLIF(COUNT(*), 0), 1) AS feedback_rate,
        ROUND(
          100.0 * COUNT(*) FILTER (WHERE "jiraIssueKey" IS NOT NULL)
            / NULLIF(COUNT(*) FILTER (WHERE "hasFeedback" = true), 0),
          1
        ) AS jira_of_feedback_rate
      FROM "UsageRecord"
      GROUP BY "toolRoute"
      ORDER BY total_requests DESC
    `
    res.json(rows.map(r => ({
      toolRoute: r.toolRoute,
      totalRequests: Number(r.total_requests),
      feedbackCount: Number(r.feedback_count),
      classifiedCount: Number(r.classified_count),
      jiraCount: Number(r.jira_count),
      feedbackRate: r.feedback_rate !== null ? Number(r.feedback_rate) : null,
      jiraOfFeedbackRate: r.jira_of_feedback_rate !== null ? Number(r.jira_of_feedback_rate) : null,
    })))
  })().catch(err => { console.error(err); res.status(500).json({ error: 'Failed' }) })
})

// --- PM Module 2: Classification Mix Over Time (weekly, flat rows) ---
router.get('/classification-mix', (req, res) => {
  void (async () => {
    const rows = await prisma.$queryRaw<{
      week: Date
      classification: string
      count: number
    }[]>`
      SELECT
        DATE_TRUNC('week', "requestTime") AS week,
        "classification",
        COUNT(*)::int AS count
      FROM "UsageRecord"
      GROUP BY week, "classification"
      ORDER BY week DESC, count DESC
    `
    res.json(rows.map(r => ({ week: r.week, classification: r.classification, count: Number(r.count) })))
  })().catch(err => { console.error(err); res.status(500).json({ error: 'Failed' }) })
})

// --- PM Module 3: Backlog Age ---
router.get('/backlog-age', (req, res) => {
  void (async () => {
    const buckets = await prisma.$queryRaw<{ age_bucket: string; count: number }[]>`
      SELECT
        CASE
          WHEN NOW() - "requestTime" < INTERVAL '7 days'  THEN '< 1 week'
          WHEN NOW() - "requestTime" < INTERVAL '28 days' THEN '1–4 weeks'
          ELSE '> 4 weeks'
        END AS age_bucket,
        COUNT(*)::int AS count
      FROM "UsageRecord"
      WHERE "classification" = 'To be classified'
      GROUP BY age_bucket
    `
    const oldest = await prisma.$queryRaw<{ id: number; userId: string; requestTime: Date; hasFeedback: boolean }[]>`
      SELECT id, "userId", "requestTime", "hasFeedback"
      FROM "UsageRecord"
      WHERE "classification" = 'To be classified'
      ORDER BY "hasFeedback" DESC, "requestTime" ASC
      LIMIT 10
    `
    res.json({
      buckets: buckets.map(b => ({ ageBucket: b.age_bucket, count: Number(b.count) })),
      oldest: oldest.map(r => ({
        id: r.id,
        userId: r.userId,
        requestTime: r.requestTime,
        hasFeedback: r.hasFeedback,
      })),
    })
  })().catch(err => { console.error(err); res.status(500).json({ error: 'Failed' }) })
})

// --- PM Module 4: Power Users ---
router.get('/power-users', (req, res) => {
  void (async () => {
    const rows = await prisma.$queryRaw<{
      userId: string
      total_requests: number
      feedback_count: number
      feedback_rate: string
      jira_count: number
      no_action_count: number
    }[]>`
      SELECT
        "userId",
        COUNT(*)::int AS total_requests,
        COUNT(*) FILTER (WHERE "hasFeedback" = true)::int AS feedback_count,
        ROUND(100.0 * COUNT(*) FILTER (WHERE "hasFeedback" = true) / COUNT(*), 1) AS feedback_rate,
        COUNT(*) FILTER (WHERE "jiraIssueKey" IS NOT NULL)::int AS jira_count,
        COUNT(*) FILTER (WHERE "classification" = 'No Action')::int AS no_action_count
      FROM "UsageRecord"
      GROUP BY "userId"
      ORDER BY total_requests DESC
      LIMIT 25
    `
    res.json(rows.map(r => ({
      userId: r.userId,
      totalRequests: Number(r.total_requests),
      feedbackCount: Number(r.feedback_count),
      feedbackRate: Number(r.feedback_rate),
      jiraCount: Number(r.jira_count),
      noActionCount: Number(r.no_action_count),
    })))
  })().catch(err => { console.error(err); res.status(500).json({ error: 'Failed' }) })
})

// --- PM Module 5: Latency by Tool Route ---
router.get('/latency-by-route', (req, res) => {
  void (async () => {
    const rows = await prisma.$queryRaw<{
      toolRoute: string
      request_count: number
      p50_ttft: string | null
      p95_ttft: string | null
      avg_ttft: string | null
      feedback_rate: string
    }[]>`
      SELECT
        "toolRoute",
        COUNT(*)::int AS request_count,
        ROUND(CAST(PERCENTILE_CONT(0.5)  WITHIN GROUP (ORDER BY "ttftSeconds") AS numeric), 2) AS p50_ttft,
        ROUND(CAST(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY "ttftSeconds") AS numeric), 2) AS p95_ttft,
        ROUND(CAST(AVG("ttftSeconds") AS numeric), 2) AS avg_ttft,
        ROUND(100.0 * COUNT(*) FILTER (WHERE "hasFeedback" = true) / NULLIF(COUNT(*), 0), 1) AS feedback_rate
      FROM "UsageRecord"
      WHERE "ttftSeconds" IS NOT NULL
      GROUP BY "toolRoute"
      ORDER BY p95_ttft DESC NULLS LAST
    `
    res.json(rows.map(r => ({
      toolRoute: r.toolRoute,
      requestCount: Number(r.request_count),
      p50Ttft: r.p50_ttft !== null ? Number(r.p50_ttft) : null,
      p95Ttft: r.p95_ttft !== null ? Number(r.p95_ttft) : null,
      avgTtft: r.avg_ttft !== null ? Number(r.avg_ttft) : null,
      feedbackRate: Number(r.feedback_rate),
    })))
  })().catch(err => { console.error(err); res.status(500).json({ error: 'Failed' }) })
})

// --- PM Module 6: Customer Response Coverage Gap ---
router.get('/customer-response-gap', (req, res) => {
  void (async () => {
    const [summary] = await prisma.$queryRaw<{
      total_with_feedback: number
      with_response: number
    }[]>`
      SELECT
        COUNT(*)::int AS total_with_feedback,
        COUNT(*) FILTER (WHERE "customerResponse" IS NOT NULL AND "customerResponse" != '')::int AS with_response
      FROM "UsageRecord"
      WHERE "isInternal" = false AND "hasFeedback" = true
    `
    const unresponded = await prisma.$queryRaw<{
      id: number
      userId: string
      requestTime: Date
      feedbackValue: string | null
      toolRoute: string
    }[]>`
      SELECT id, "userId", "requestTime", "feedbackValue", "toolRoute"
      FROM "UsageRecord"
      WHERE "isInternal" = false
        AND "hasFeedback" = true
        AND ("customerResponse" IS NULL OR "customerResponse" = '')
      ORDER BY "requestTime" DESC
      LIMIT 20
    `
    res.json({
      totalWithFeedback: Number(summary.total_with_feedback),
      withResponse: Number(summary.with_response),
      unresponded: unresponded.map(r => ({
        id: r.id,
        userId: r.userId,
        requestTime: r.requestTime,
        feedbackValue: r.feedbackValue,
        toolRoute: r.toolRoute,
      })),
    })
  })().catch(err => { console.error(err); res.status(500).json({ error: 'Failed' }) })
})

// --- PM Module 7: Repeat Complainants ---
router.get('/repeat-complainants', (req, res) => {
  void (async () => {
    const rows = await prisma.$queryRaw<{
      userId: string
      toolRoute: string
      weeks_with_feedback: number
      total_feedback: number
    }[]>`
      SELECT
        "userId",
        "toolRoute",
        COUNT(DISTINCT DATE_TRUNC('week', "requestTime"))::int AS weeks_with_feedback,
        COUNT(*)::int AS total_feedback
      FROM "UsageRecord"
      WHERE "hasFeedback" = true
      GROUP BY "userId", "toolRoute"
      HAVING COUNT(DISTINCT DATE_TRUNC('week', "requestTime")) > 1
      ORDER BY weeks_with_feedback DESC, total_feedback DESC
      LIMIT 25
    `
    res.json(rows.map(r => ({
      userId: r.userId,
      toolRoute: r.toolRoute,
      weeksWithFeedback: Number(r.weeks_with_feedback),
      totalFeedback: Number(r.total_feedback),
    })))
  })().catch(err => { console.error(err); res.status(500).json({ error: 'Failed' }) })
})

// --- HoD Module 8: Adoption Ratio + Weekly Active Users ---
router.get('/adoption-ratio', (req, res) => {
  void (async () => {
    const rows = await prisma.$queryRaw<{
      week: Date
      internal_requests: number
      external_requests: number
      internal_users: number
      external_users: number
    }[]>`
      SELECT
        DATE_TRUNC('week', "requestTime") AS week,
        COUNT(*) FILTER (WHERE "isInternal" = true)::int  AS internal_requests,
        COUNT(*) FILTER (WHERE "isInternal" = false)::int AS external_requests,
        COUNT(DISTINCT "userId") FILTER (WHERE "isInternal" = true)::int  AS internal_users,
        COUNT(DISTINCT "userId") FILTER (WHERE "isInternal" = false)::int AS external_users
      FROM "UsageRecord"
      GROUP BY week
      ORDER BY week DESC
    `
    res.json(rows.map(r => ({
      week: r.week,
      internalRequests: Number(r.internal_requests),
      externalRequests: Number(r.external_requests),
      internalUsers: Number(r.internal_users),
      externalUsers: Number(r.external_users),
    })))
  })().catch(err => { console.error(err); res.status(500).json({ error: 'Failed' }) })
})

// --- HoD Module 9: Actionable Feedback Rate ---
router.get('/actionable-feedback', (req, res) => {
  void (async () => {
    const type = req.query.type as string | undefined
    const whereClause = type === 'internal'
      ? prisma.$queryRaw<{ week: Date; feedback_count: number; jira_count: number; jira_rate: string | null }[]>`
          SELECT DATE_TRUNC('week', "requestTime") AS week,
            COUNT(*) FILTER (WHERE "hasFeedback" = true)::int AS feedback_count,
            COUNT(*) FILTER (WHERE "jiraIssueKey" IS NOT NULL)::int AS jira_count,
            ROUND(100.0 * COUNT(*) FILTER (WHERE "jiraIssueKey" IS NOT NULL) / NULLIF(COUNT(*) FILTER (WHERE "hasFeedback" = true), 0), 1) AS jira_rate
          FROM "UsageRecord" WHERE "isInternal" = true GROUP BY week ORDER BY week DESC`
      : type === 'external'
      ? prisma.$queryRaw<{ week: Date; feedback_count: number; jira_count: number; jira_rate: string | null }[]>`
          SELECT DATE_TRUNC('week', "requestTime") AS week,
            COUNT(*) FILTER (WHERE "hasFeedback" = true)::int AS feedback_count,
            COUNT(*) FILTER (WHERE "jiraIssueKey" IS NOT NULL)::int AS jira_count,
            ROUND(100.0 * COUNT(*) FILTER (WHERE "jiraIssueKey" IS NOT NULL) / NULLIF(COUNT(*) FILTER (WHERE "hasFeedback" = true), 0), 1) AS jira_rate
          FROM "UsageRecord" WHERE "isInternal" = false GROUP BY week ORDER BY week DESC`
      : prisma.$queryRaw<{ week: Date; feedback_count: number; jira_count: number; jira_rate: string | null }[]>`
          SELECT DATE_TRUNC('week', "requestTime") AS week,
            COUNT(*) FILTER (WHERE "hasFeedback" = true)::int AS feedback_count,
            COUNT(*) FILTER (WHERE "jiraIssueKey" IS NOT NULL)::int AS jira_count,
            ROUND(100.0 * COUNT(*) FILTER (WHERE "jiraIssueKey" IS NOT NULL) / NULLIF(COUNT(*) FILTER (WHERE "hasFeedback" = true), 0), 1) AS jira_rate
          FROM "UsageRecord" GROUP BY week ORDER BY week DESC`

    const overallQuery = type === 'internal'
      ? prisma.$queryRaw<{ total_jira: number }[]>`SELECT COUNT(*) FILTER (WHERE "jiraIssueKey" IS NOT NULL)::int AS total_jira FROM "UsageRecord" WHERE "isInternal" = true`
      : type === 'external'
      ? prisma.$queryRaw<{ total_jira: number }[]>`SELECT COUNT(*) FILTER (WHERE "jiraIssueKey" IS NOT NULL)::int AS total_jira FROM "UsageRecord" WHERE "isInternal" = false`
      : prisma.$queryRaw<{ total_jira: number }[]>`SELECT COUNT(*) FILTER (WHERE "jiraIssueKey" IS NOT NULL)::int AS total_jira FROM "UsageRecord"`

    const [rows, overallRows] = await Promise.all([whereClause, overallQuery])
    const overall = overallRows[0]
    res.json({
      weeks: rows.map(r => ({
        week: r.week,
        feedbackCount: Number(r.feedback_count),
        jiraCount: Number(r.jira_count),
        jiraRate: r.jira_rate !== null ? Number(r.jira_rate) : null,
      })),
      totalJira: Number(overall.total_jira),
    })
  })().catch(err => { console.error(err); res.status(500).json({ error: 'Failed' }) })
})

// --- HoD Module 10: Route Investment vs Usage Return ---
router.get('/route-investment', (req, res) => {
  void (async () => {
    const rows = await prisma.$queryRaw<{
      toolRoute: string
      request_count: number
      distinct_users: number
      feedback_count: number
      feedback_rate: string
    }[]>`
      SELECT
        "toolRoute",
        COUNT(*)::int AS request_count,
        COUNT(DISTINCT "userId")::int AS distinct_users,
        COUNT(*) FILTER (WHERE "hasFeedback" = true)::int AS feedback_count,
        ROUND(100.0 * COUNT(*) FILTER (WHERE "hasFeedback" = true) / NULLIF(COUNT(*), 0), 1) AS feedback_rate
      FROM "UsageRecord"
      GROUP BY "toolRoute"
      ORDER BY request_count DESC
    `
    res.json(rows.map(r => ({
      toolRoute: r.toolRoute,
      requestCount: Number(r.request_count),
      distinctUsers: Number(r.distinct_users),
      feedbackCount: Number(r.feedback_count),
      feedbackRate: Number(r.feedback_rate),
    })))
  })().catch(err => { console.error(err); res.status(500).json({ error: 'Failed' }) })
})

// --- HoD Module 12: Classification Throughput ---
router.get('/classification-throughput', (req, res) => {
  void (async () => {
    const rows = await prisma.$queryRaw<{
      week: Date
      ingested: number
      still_unclassified: number
      classified_this_week: number
    }[]>`
      SELECT
        DATE_TRUNC('week', "createdAt") AS week,
        COUNT(*)::int AS ingested,
        COUNT(*) FILTER (WHERE "classification" = 'To be classified')::int AS still_unclassified,
        COUNT(*) FILTER (WHERE "classification" != 'To be classified')::int AS classified_this_week
      FROM "UsageRecord"
      GROUP BY week
      ORDER BY week DESC
    `
    res.json(rows.map(r => ({
      week: r.week,
      ingested: Number(r.ingested),
      stillUnclassified: Number(r.still_unclassified),
      classifiedThisWeek: Number(r.classified_this_week),
    })))
  })().catch(err => { console.error(err); res.status(500).json({ error: 'Failed' }) })
})

// --- HoD Module 13: Data Quality Score ---
router.get('/data-quality', (req, res) => {
  void (async () => {
    const [row] = await prisma.$queryRaw<{
      total: number
      long_request: number
      long_response: number
      no_trace_id: number
      no_ttft: number
      no_feedback_value_but_has_feedback: number
    }[]>`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE LENGTH("requestContent")  > 10000)::int AS long_request,
        COUNT(*) FILTER (WHERE LENGTH("responseContent") > 10000)::int AS long_response,
        COUNT(*) FILTER (WHERE "traceId" IS NULL)::int AS no_trace_id,
        COUNT(*) FILTER (WHERE "ttftSeconds" IS NULL)::int AS no_ttft,
        COUNT(*) FILTER (WHERE "hasFeedback" = true AND "feedbackValue" IS NULL)::int AS no_feedback_value_but_has_feedback
      FROM "UsageRecord"
    `
    res.json({
      total: Number(row.total),
      longRequest: Number(row.long_request),
      longResponse: Number(row.long_response),
      noTraceId: Number(row.no_trace_id),
      noTtft: Number(row.no_ttft),
      noFeedbackValueButHasFeedback: Number(row.no_feedback_value_but_has_feedback),
    })
  })().catch(err => { console.error(err); res.status(500).json({ error: 'Failed' }) })
})

// --- Exec Module 14: Net Satisfaction Trend ---
router.get('/net-satisfaction', (req, res) => {
  void (async () => {
    const rows = await prisma.$queryRaw<{
      week: Date
      feedbackValue: string | null
      count: number
    }[]>`
      SELECT
        DATE_TRUNC('week', "requestTime") AS week,
        "feedbackValue",
        COUNT(*)::int AS count
      FROM "UsageRecord"
      WHERE "hasFeedback" = true
      GROUP BY week, "feedbackValue"
      ORDER BY week DESC, count DESC
    `
    // Group by week
    const byWeek: Record<string, { week: string; breakdown: Record<string, number>; total: number }> = {}
    for (const r of rows) {
      const key = r.week.toISOString()
      if (!byWeek[key]) byWeek[key] = { week: key, breakdown: {}, total: 0 }
      const label = r.feedbackValue ?? '(none)'
      byWeek[key].breakdown[label] = Number(r.count)
      byWeek[key].total += Number(r.count)
    }
    res.json(Object.values(byWeek).sort((a, b) => b.week.localeCompare(a.week)))
  })().catch(err => { console.error(err); res.status(500).json({ error: 'Failed' }) })
})

// --- Exec Module 15: Retention Cohorts ---
router.get('/retention-cohorts', (req, res) => {
  void (async () => {
    const rows = await prisma.$queryRaw<{
      cohort_week: Date
      cohort_size: number
      retained_4w: number
      retained_8w: number
    }[]>`
      WITH first_seen AS (
        SELECT "userId", MIN(DATE_TRUNC('week', "requestTime")) AS cohort_week
        FROM "UsageRecord"
        WHERE "isInternal" = false
        GROUP BY "userId"
      ),
      activity AS (
        SELECT DISTINCT "userId", DATE_TRUNC('week', "requestTime") AS activity_week
        FROM "UsageRecord"
        WHERE "isInternal" = false
      )
      SELECT
        fs.cohort_week,
        COUNT(DISTINCT fs."userId")::int AS cohort_size,
        COUNT(DISTINCT a4."userId")::int AS retained_4w,
        COUNT(DISTINCT a8."userId")::int AS retained_8w
      FROM first_seen fs
      LEFT JOIN activity a4
        ON fs."userId" = a4."userId"
        AND a4.activity_week >= fs.cohort_week + INTERVAL '4 weeks'
        AND a4.activity_week <  fs.cohort_week + INTERVAL '8 weeks'
      LEFT JOIN activity a8
        ON fs."userId" = a8."userId"
        AND a8.activity_week >= fs.cohort_week + INTERVAL '8 weeks'
        AND a8.activity_week <  fs.cohort_week + INTERVAL '12 weeks'
      GROUP BY fs.cohort_week
      ORDER BY fs.cohort_week DESC
    `
    res.json(rows.map(r => ({
      cohortWeek: r.cohort_week,
      cohortSize: Number(r.cohort_size),
      retained4w: Number(r.retained_4w),
      retained8w: Number(r.retained_8w),
    })))
  })().catch(err => { console.error(err); res.status(500).json({ error: 'Failed' }) })
})

// --- Exec Module 16: Cumulative Value via Jira ---
router.get('/jira-delivered', (req, res) => {
  void (async () => {
    const rows = await prisma.$queryRaw<{ classification: string; count: number }[]>`
      SELECT "classification", COUNT(*)::int AS count
      FROM "UsageRecord"
      WHERE "jiraIssueKey" IS NOT NULL
      GROUP BY "classification"
      ORDER BY count DESC
    `
    const [totals] = await prisma.$queryRaw<{ total_with_jira: number; total_records: number }[]>`
      SELECT
        COUNT(*) FILTER (WHERE "jiraIssueKey" IS NOT NULL)::int AS total_with_jira,
        COUNT(*)::int AS total_records
      FROM "UsageRecord"
    `
    res.json({
      byClassification: rows.map(r => ({ classification: r.classification, count: Number(r.count) })),
      totalWithJira: Number(totals.total_with_jira),
      totalRecords: Number(totals.total_records),
    })
  })().catch(err => { console.error(err); res.status(500).json({ error: 'Failed' }) })
})

// --- Exec Module 17: Feature Request Clustering ---
router.get('/feature-clusters', (req, res) => {
  void (async () => {
    const rows = await prisma.$queryRaw<{
      toolRoute: string
      epicKey: string | null
      count: number
      distinct_users: number
    }[]>`
      SELECT
        "toolRoute",
        "epicKey",
        COUNT(*)::int AS count,
        COUNT(DISTINCT "userId")::int AS distinct_users
      FROM "UsageRecord"
      WHERE "classification" = 'New feature request'
      GROUP BY "toolRoute", "epicKey"
      ORDER BY count DESC
    `
    res.json(rows.map(r => ({
      toolRoute: r.toolRoute,
      epicKey: r.epicKey,
      count: Number(r.count),
      distinctUsers: Number(r.distinct_users),
    })))
  })().catch(err => { console.error(err); res.status(500).json({ error: 'Failed' }) })
})

// --- Exec Module 18: Speed of Response (limited — no jiraCreatedAt) ---
router.get('/speed-of-response', (req, res) => {
  void (async () => {
    // No jiraCreatedAt stored yet; return time from requestTime to record creation as a proxy
    const [summary] = await prisma.$queryRaw<{
      records_with_jira: number
      avg_days_to_creation: string | null
      p50_days: string | null
      p90_days: string | null
    }[]>`
      SELECT
        COUNT(*)::int AS records_with_jira,
        ROUND(CAST(AVG(EXTRACT(EPOCH FROM ("createdAt" - "requestTime")) / 86400) AS numeric), 1) AS avg_days_to_creation,
        ROUND(CAST(PERCENTILE_CONT(0.5)  WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM ("createdAt" - "requestTime")) / 86400) AS numeric), 1) AS p50_days,
        ROUND(CAST(PERCENTILE_CONT(0.9)  WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM ("createdAt" - "requestTime")) / 86400) AS numeric), 1) AS p90_days
      FROM "UsageRecord"
      WHERE "jiraIssueKey" IS NOT NULL
    `
    res.json({
      recordsWithJira: Number(summary.records_with_jira),
      avgDaysToIngestion: summary.avg_days_to_creation !== null ? Number(summary.avg_days_to_creation) : null,
      p50Days: summary.p50_days !== null ? Number(summary.p50_days) : null,
      p90Days: summary.p90_days !== null ? Number(summary.p90_days) : null,
      note: 'Uses requestTime→ingest time as proxy. Add jiraCreatedAt field for true time-to-action.',
    })
  })().catch(err => { console.error(err); res.status(500).json({ error: 'Failed' }) })
})

// --- Exec Module 19: TTFT at Scale ---
router.get('/ttft-scale', (req, res) => {
  void (async () => {
    const rows = await prisma.$queryRaw<{
      week: Date
      request_count: number
      p50_ttft: string | null
      p95_ttft: string | null
    }[]>`
      SELECT
        DATE_TRUNC('week', "requestTime") AS week,
        COUNT(*)::int AS request_count,
        ROUND(CAST(PERCENTILE_CONT(0.5)  WITHIN GROUP (ORDER BY "ttftSeconds") AS numeric), 2) AS p50_ttft,
        ROUND(CAST(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY "ttftSeconds") AS numeric), 2) AS p95_ttft
      FROM "UsageRecord"
      WHERE "ttftSeconds" IS NOT NULL
      GROUP BY week
      ORDER BY week DESC
    `
    res.json(rows.map(r => ({
      week: r.week,
      requestCount: Number(r.request_count),
      p50Ttft: r.p50_ttft !== null ? Number(r.p50_ttft) : null,
      p95Ttft: r.p95_ttft !== null ? Number(r.p95_ttft) : null,
    })))
  })().catch(err => { console.error(err); res.status(500).json({ error: 'Failed' }) })
})

// --- Exec Module 20: Iceberg Metric ---
router.get('/iceberg', (req, res) => {
  void (async () => {
    const rows = await prisma.$queryRaw<{
      week: Date
      total_requests: number
      feedback_count: number
      feedback_rate: string
    }[]>`
      SELECT
        DATE_TRUNC('week', "requestTime") AS week,
        COUNT(*)::int AS total_requests,
        COUNT(*) FILTER (WHERE "hasFeedback" = true)::int AS feedback_count,
        ROUND(100.0 * COUNT(*) FILTER (WHERE "hasFeedback" = true) / NULLIF(COUNT(*), 0), 1) AS feedback_rate
      FROM "UsageRecord"
      GROUP BY week
      ORDER BY week DESC
    `
    res.json(rows.map(r => ({
      week: r.week,
      totalRequests: Number(r.total_requests),
      feedbackCount: Number(r.feedback_count),
      feedbackRate: r.feedback_rate !== null ? Number(r.feedback_rate) : null,
    })))
  })().catch(err => { console.error(err); res.status(500).json({ error: 'Failed' }) })
})

export default router
