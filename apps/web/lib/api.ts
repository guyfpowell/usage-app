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
  epicKey: string | null
  linkedIssueKey: string | null
  createdAt: string
  updatedAt: string
}

export interface JiraEpic {
  key: string
  summary: string
}

export interface JiraIssue {
  key: string
  summary: string
  issueType: string
  status: string
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
  hasJira?: boolean
  toolRoute?: string
  userId?: string
  feedbackValue?: string
  week?: string
  dateFrom?: string  // YYYY-MM-DD
  dateTo?: string    // YYYY-MM-DD (inclusive)
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
  return apiFetch<{ inserted: number; updated: number; batchId: number | null }>('/ingest/csv', {
    method: 'POST',
    body: form,
  })
}

export function getRecords(filters: RecordFilters = {}) {
  const params = new URLSearchParams()
  if (filters.type) params.set('type', filters.type)
  if (filters.hasFeedback !== undefined) params.set('hasFeedback', String(filters.hasFeedback))
  if (filters.hasJira !== undefined) params.set('hasJira', String(filters.hasJira))
  if (filters.toolRoute) params.set('toolRoute', filters.toolRoute)
  if (filters.userId) params.set('userId', filters.userId)
  if (filters.feedbackValue) params.set('feedbackValue', filters.feedbackValue)
  if (filters.week) params.set('week', filters.week)
  if (filters.dateFrom) params.set('dateFrom', filters.dateFrom)
  if (filters.dateTo) params.set('dateTo', filters.dateTo)
  if (filters.page) params.set('page', String(filters.page))
  if (filters.pageSize) params.set('pageSize', String(filters.pageSize))
  return apiFetch<RecordsResponse>(`/records?${params}`)
}

export function patchRecord(
  id: number,
  data: Partial<Pick<UsageRecord, 'classification' | 'groupText' | 'ticketText' | 'epicKey' | 'linkedIssueKey'>>
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

export function getExportUrl(filters: RecordFilters = {}) {
  const params = new URLSearchParams()
  if (filters.type) params.set('type', filters.type)
  if (filters.hasFeedback !== undefined) params.set('hasFeedback', String(filters.hasFeedback))
  if (filters.hasJira !== undefined) params.set('hasJira', String(filters.hasJira))
  if (filters.toolRoute) params.set('toolRoute', filters.toolRoute)
  if (filters.userId) params.set('userId', filters.userId)
  if (filters.feedbackValue) params.set('feedbackValue', filters.feedbackValue)
  if (filters.week) params.set('week', filters.week)
  if (filters.dateFrom) params.set('dateFrom', filters.dateFrom)
  if (filters.dateTo) params.set('dateTo', filters.dateTo)
  return `${BASE}/records/export?${params}`
}

export function getClassifications() {
  return apiFetch<Classification[]>('/classifications')
}

export function getUsers() {
  return apiFetch<string[]>('/records/users')
}

export function getFeedbackValues() {
  return apiFetch<string[]>('/records/feedback-values')
}

export function getEpics() {
  return apiFetch<JiraEpic[]>('/jira/epics')
}

export function getCustomerFeedbackIssues() {
  return apiFetch<JiraIssue[]>('/jira/customer-feedback-issues')
}

export function getWeeklyAnalytics(type?: 'internal' | 'external') {
  const params = type ? `?type=${type}` : ''
  return apiFetch<WeeklyRow[]>(`/analytics/weekly${params}`)
}

export function getOverallAnalytics() {
  return apiFetch<{ avgTtftSeconds: number | null }>('/analytics/overall')
}

export function getFeedbackByRoute(feedbackValue?: string) {
  const params = feedbackValue ? `?feedbackValue=${encodeURIComponent(feedbackValue)}` : ''
  return apiFetch<FeedbackByRouteRow[]>(`/analytics/feedback-by-route${params}`)
}

export interface UploadBatch {
  id: number
  filename: string
  insertedCount: number
  updatedCount: number
  isRolledBack: boolean
  createdAt: string
}

export function getBatches() {
  return apiFetch<UploadBatch[]>('/batches')
}

export function rollbackBatch(id: number) {
  return apiFetch<{ deleted: number; restored: number }>(`/batches/${id}/rollback`, {
    method: 'POST',
  })
}
