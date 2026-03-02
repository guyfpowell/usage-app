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

function makeSummary(record: { rationale: string | null; userId: string }): string {
  const parts = ['User feedback']
  if (record.rationale?.trim()) parts.push(record.rationale.trim())
  parts.push(record.userId)
  const full = parts.join(' - ')
  return full.length > 255 ? full.slice(0, 252) + '...' : full
}

function heading(text: string) {
  return {
    type: 'heading',
    attrs: { level: 2 },
    content: [{ type: 'text', text }],
  }
}

function para(text: string) {
  return {
    type: 'paragraph',
    content: [{ type: 'text', text: text || '—' }],
  }
}

function makeDescription(record: {
  requestContent: string
  responseContent: string
  classification: string
  groupText: string | null
  traceId: string | null
  requestTime: Date
}) {
  const classification = [record.classification, record.groupText].filter(Boolean).join(' - ')

  return {
    type: 'doc',
    version: 1,
    content: [
      heading('BACKGROUND'),
      para('Ask PEI feedback -'),
      heading('QUESTION'),
      para('User Prompt / Query:'),
      para(record.requestContent),
      heading('CURRENT ANSWER (AskPEI Output)'),
      para(record.responseContent),
      heading('DEFECT CLASSIFICATION'),
      para(classification),
      heading('SUPPORTING INFORMATION / TRACE'),
      para(record.traceId ?? '—'),
      heading('Model Version'),
      para('<Model Name / AskPEI Version>'),
      heading('Environment'),
      para('Prod'),
      heading('Timestamp'),
      para(record.requestTime.toISOString()),
    ],
  }
}

// Discovery endpoint — call GET /jira/fields once credentials are configured
// to find the customfield IDs for Engineering Team and Skillset
router.get('/fields', (req, res) => {
  void (async () => {
    const client = getClient()
    const projectKey = process.env.JIRA_PROJECT_KEY ?? 'CDO'
    const { search } = req.query as { search?: string }

    const { JIRA_HOST, JIRA_EMAIL, JIRA_API_TOKEN } = process.env
    const auth = Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString('base64')
    const baseUrl = `https://${JIRA_HOST}`

    // Step 1: get issue types for the project
    const typesResp = await fetch(
      `${baseUrl}/rest/api/3/issue/createmeta/${projectKey}/issuetypes`,
      { headers: { Authorization: `Basic ${auth}`, Accept: 'application/json' } }
    )
    const typesData = await typesResp.json() as { issueTypes?: { id: string; name: string }[] }

    if ((req.query as Record<string, string>).debug === '1') {
      res.json({ status: typesResp.status, typesData })
      return
    }

    const issueTypes = typesData.issueTypes ?? []
    const bugType = issueTypes.find(t => /bug/i.test(t.name)) ?? issueTypes[0]
    if (!bugType?.id) { res.json([]); return }

    // Step 2: get fields for that issue type
    const fieldsResp = await fetch(
      `${baseUrl}/rest/api/3/issue/createmeta/${projectKey}/issuetypes/${bugType.id}`,
      { headers: { Authorization: `Basic ${auth}`, Accept: 'application/json' } }
    )
    const fieldsData = await fieldsResp.json() as { fields?: { fieldId: string; name: string; schema?: { type: string } }[] }
    const fields = fieldsData.fields ?? []

    const list = search
      ? fields.filter(f => new RegExp(search, 'i').test(f.name ?? ''))
      : fields

    res.json(list.map(f => ({ id: f.fieldId, name: f.name, type: f.schema?.type })))
  })().catch(err => {
    console.error(err)
    if (!res.headersSent) res.status(500).json({ error: (err as Error).message })
  })
})

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

    const projectKey = process.env.JIRA_PROJECT_KEY ?? 'CDO'
    const jiraHost = process.env.JIRA_HOST!
    const engineeringTeamField = process.env.JIRA_CUSTOM_ENGINEERING_TEAM
    const skillsetField = process.env.JIRA_CUSTOM_SKILLSET

    const results: { id: number; jiraIssueKey: string; jiraIssueUrl: string }[] = []

    for (const record of records) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fields: Record<string, any> = {
        project: { key: projectKey },
        issuetype: { name: 'Bug' },
        summary: makeSummary(record),
        description: makeDescription(record),
        labels: ['askPEI', 'customer_feedback'],
      }

      if (engineeringTeamField && engineeringTeamField !== 'customfield_XXXXX') {
        fields[engineeringTeamField] = { value: 'Data - Subs' }
      }
      if (skillsetField && skillsetField !== 'customfield_XXXXX') {
        fields[skillsetField] = [{ value: 'Data Science' }]
      }

      const issue = await client.issues.createIssue({ fields })

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
