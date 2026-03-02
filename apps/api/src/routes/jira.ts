import { Router } from 'express'
import { Version3Client } from 'jira.js'
import prisma from '../lib/prisma'

const router = Router()

function getClient(): Version3Client {
  const { JIRA_HOST, JIRA_EMAIL, JIRA_API_TOKEN } = process.env
  if (!JIRA_HOST || !JIRA_EMAIL || !JIRA_API_TOKEN) {
    throw new Error('Jira credentials not configured in environment')
  }
  return new Version3Client({
    host: `https://${JIRA_HOST}`,
    authentication: { basic: { email: JIRA_EMAIL, apiToken: JIRA_API_TOKEN } },
  })
}

function makeSummary(requestContent: string): string {
  const clean = requestContent.replace(/\s+/g, ' ').trim()
  return clean.length > 255 ? clean.slice(0, 252) + '...' : clean
}

function makeDescription(record: {
  userId: string
  toolRoute: string
  feedbackValue: string | null
  rationale: string | null
}) {
  const fields: { label: string; value: string }[] = [
    { label: 'User', value: record.userId },
    { label: 'Tool Route', value: record.toolRoute },
  ]
  if (record.feedbackValue) fields.push({ label: 'Feedback', value: record.feedbackValue })
  if (record.rationale) fields.push({ label: 'Rationale', value: record.rationale })

  return {
    type: 'doc',
    version: 1,
    content: fields.map(f => ({
      type: 'paragraph',
      content: [
        { type: 'text', text: `${f.label}: `, marks: [{ type: 'strong' }] },
        { type: 'text', text: f.value },
      ],
    })),
  }
}

router.post('/create', (req, res) => {
  void (async () => {
    const { ids } = req.body as { ids?: unknown }
    if (!Array.isArray(ids) || ids.length === 0) {
      res.status(400).json({ error: 'ids must be a non-empty array' })
      return
    }

    const numericIds = ids.map(Number).filter(n => !isNaN(n))

    const records = await prisma.usageRecord.findMany({
      where: { id: { in: numericIds } },
    })

    if (records.length === 0) {
      res.status(404).json({ error: 'No records found for the given ids' })
      return
    }

    let client: Version3Client
    try {
      client = getClient()
    } catch (err) {
      res.status(503).json({ error: (err as Error).message })
      return
    }

    const projectKey = process.env.JIRA_PROJECT_KEY ?? 'PROJ'
    const issueType = process.env.JIRA_ISSUE_TYPE ?? 'Task'
    const jiraHost = process.env.JIRA_HOST!

    const results: { id: number; jiraIssueKey: string; jiraIssueUrl: string }[] = []

    for (const record of records) {
      const issue = await client.issues.createIssue({
        fields: {
          project: { key: projectKey },
          summary: makeSummary(record.requestContent),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          description: makeDescription(record) as any,
          issuetype: { name: issueType },
        },
      })

      const jiraIssueKey = issue.key!
      const jiraIssueUrl = `https://${jiraHost}/browse/${jiraIssueKey}`

      await prisma.usageRecord.update({
        where: { id: record.id },
        data: { jiraIssueKey, jiraIssueUrl, ticketText: jiraIssueUrl },
      })

      results.push({ id: record.id, jiraIssueKey, jiraIssueUrl })
    }

    res.json({ created: results.length, issues: results })
  })().catch(err => {
    console.error(err)
    if (!res.headersSent) res.status(500).json({ error: 'Jira creation failed' })
  })
})

export default router
