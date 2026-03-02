const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

export interface UsageRecord {
  id: number
  traceId: string | null
  userId: string
  requestTime: string
  requestContent: string
  responseContent: string
  feedbackValue: string | null
  rationale: string | null
  toolRoute: string
  ttftSeconds: number | null
  isInternal: boolean
  hasFeedback: boolean
  classification: string
  groupText: string | null
  ticketText: string | null
  jiraIssueKey: string | null
  jiraIssueUrl: string | null
  createdAt: string
  updatedAt: string
}

export interface RecordsResponse {
  total: number
  page: number
  pageSize: number
  records: UsageRecord[]
}

export interface RecordFilters {
  type?: 'internal' | 'external'
  hasFeedback?: boolean
  toolRoute?: string
  week?: string
  page?: number
  pageSize?: number
}

export interface Classification {
  id: number
  name: string
  isActive: boolean
}

export interface WeeklyRow {
  week: string
  count: number
  avgTtftSeconds: number | null
}

export interface FeedbackByRouteRow {
  toolRoute: string
  count: number
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, init)
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`${res.status}: ${text}`)
  }
  return res.json() as Promise<T>
}

export function uploadCsv(file: File) {
  const form = new FormData()
  form.append('file', file)
  return apiFetch<{ inserted: number; updated: number }>('/ingest/csv', {
    method: 'POST',
    body: form,
  })
}

export function getRecords(filters: RecordFilters = {}) {
  const params = new URLSearchParams()
  if (filters.type) params.set('type', filters.type)
  if (filters.hasFeedback !== undefined) params.set('hasFeedback', String(filters.hasFeedback))
  if (filters.toolRoute) params.set('toolRoute', filters.toolRoute)
  if (filters.week) params.set('week', filters.week)
  if (filters.page) params.set('page', String(filters.page))
  if (filters.pageSize) params.set('pageSize', String(filters.pageSize))
  return apiFetch<RecordsResponse>(`/records?${params}`)
}

export function patchRecord(
  id: number,
  data: Partial<Pick<UsageRecord, 'classification' | 'groupText' | 'ticketText'>>
) {
  return apiFetch<UsageRecord>(`/records/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
}

export function createJiraIssues(ids: number[]) {
  return apiFetch<{
    created: number
    issues: { id: number; jiraIssueKey: string; jiraIssueUrl: string }[]
  }>('/jira/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids }),
  })
}

export function getClassifications() {
  return apiFetch<Classification[]>('/classifications')
}

export function getWeeklyAnalytics(type?: 'internal' | 'external') {
  const params = type ? `?type=${type}` : ''
  return apiFetch<WeeklyRow[]>(`/analytics/weekly${params}`)
}

export function getOverallAnalytics() {
  return apiFetch<{ avgTtftSeconds: number | null }>('/analytics/overall')
}

export function getFeedbackByRoute() {
  return apiFetch<FeedbackByRouteRow[]>('/analytics/feedback-by-route')
}
