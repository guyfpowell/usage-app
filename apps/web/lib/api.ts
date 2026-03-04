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
  customerResponse: string | null
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
  classification?: string
  notClassification?: string
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
  if (filters.classification) params.set('classification', filters.classification)
  if (filters.notClassification) params.set('notClassification', filters.notClassification)
  if (filters.week) params.set('week', filters.week)
  if (filters.dateFrom) params.set('dateFrom', filters.dateFrom)
  if (filters.dateTo) params.set('dateTo', filters.dateTo)
  if (filters.page) params.set('page', String(filters.page))
  if (filters.pageSize) params.set('pageSize', String(filters.pageSize))
  return apiFetch<RecordsResponse>(`/records?${params}`)
}

export function getNewFeedbackCount() {
  return apiFetch<{ count: number }>('/records/new-feedback-count')
}

export function patchRecord(
  id: number,
  data: Partial<Pick<UsageRecord, 'classification' | 'groupText' | 'ticketText' | 'epicKey' | 'linkedIssueKey' | 'customerResponse'>>
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
  if (filters.notClassification) params.set('notClassification', filters.notClassification)
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
  source: string
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

export function syncDatabricks() {
  return apiFetch<{ inserted: number; updated: number; batchId: number }>('/ingest/databricks', {
    method: 'POST',
  })
}

// ── Analytics Lab ─────────────────────────────────────────────────────────────

export interface FeedbackFunnelRow {
  toolRoute: string
  totalRequests: number
  feedbackCount: number
  classifiedCount: number
  jiraCount: number
  feedbackRate: number | null
  jiraOfFeedbackRate: number | null
}

export interface ClassificationMixRow {
  week: string
  classification: string
  count: number
}

export interface BacklogAgeData {
  buckets: { ageBucket: string; count: number }[]
  oldest: { id: number; userId: string; requestTime: string; hasFeedback: boolean }[]
}

export interface PowerUserRow {
  userId: string
  totalRequests: number
  feedbackCount: number
  feedbackRate: number
  jiraCount: number
  noActionCount: number
}

export interface LatencyByRouteRow {
  toolRoute: string
  requestCount: number
  p50Ttft: number | null
  p95Ttft: number | null
  avgTtft: number | null
  feedbackRate: number
}

export interface CustomerResponseGapData {
  totalWithFeedback: number
  withResponse: number
  unresponded: { id: number; userId: string; requestTime: string; feedbackValue: string | null; toolRoute: string }[]
}

export interface RepeatComplainantRow {
  userId: string
  toolRoute: string
  weeksWithFeedback: number
  totalFeedback: number
}

export interface AdoptionRatioRow {
  week: string
  internalRequests: number
  externalRequests: number
  internalUsers: number
  externalUsers: number
}

export interface ActionableFeedbackData {
  weeks: { week: string; feedbackCount: number; jiraCount: number; jiraRate: number | null }[]
  totalJira: number
}

export interface RouteInvestmentRow {
  toolRoute: string
  requestCount: number
  distinctUsers: number
  feedbackCount: number
  feedbackRate: number
}

export interface ClassificationThroughputRow {
  week: string
  ingested: number
  stillUnclassified: number
  classifiedThisWeek: number
}

export interface DataQualityData {
  total: number
  longRequest: number
  longResponse: number
  noTraceId: number
  noTtft: number
  noFeedbackValueButHasFeedback: number
}

export interface NetSatisfactionRow {
  week: string
  breakdown: Record<string, number>
  total: number
}

export interface RetentionCohortRow {
  cohortWeek: string
  cohortSize: number
  retained4w: number
  retained8w: number
}

export interface JiraDeliveredData {
  byClassification: { classification: string; count: number }[]
  totalWithJira: number
  totalRecords: number
}

export interface FeatureClusterRow {
  toolRoute: string
  epicKey: string | null
  count: number
  distinctUsers: number
}

export interface SpeedOfResponseData {
  recordsWithJira: number
  avgDaysToIngestion: number | null
  p50Days: number | null
  p90Days: number | null
  note: string
}

export interface TtftScaleRow {
  week: string
  requestCount: number
  p50Ttft: number | null
  p95Ttft: number | null
}

export interface IcebergRow {
  week: string
  totalRequests: number
  feedbackCount: number
  feedbackRate: number | null
}

export const lab = {
  feedbackFunnel: () => apiFetch<FeedbackFunnelRow[]>('/analytics-lab/feedback-funnel'),
  classificationMix: () => apiFetch<ClassificationMixRow[]>('/analytics-lab/classification-mix'),
  backlogAge: () => apiFetch<BacklogAgeData>('/analytics-lab/backlog-age'),
  powerUsers: () => apiFetch<PowerUserRow[]>('/analytics-lab/power-users'),
  latencyByRoute: () => apiFetch<LatencyByRouteRow[]>('/analytics-lab/latency-by-route'),
  customerResponseGap: () => apiFetch<CustomerResponseGapData>('/analytics-lab/customer-response-gap'),
  repeatComplainants: () => apiFetch<RepeatComplainantRow[]>('/analytics-lab/repeat-complainants'),
  adoptionRatio: () => apiFetch<AdoptionRatioRow[]>('/analytics-lab/adoption-ratio'),
  actionableFeedback: (type?: 'internal' | 'external') => apiFetch<ActionableFeedbackData>(`/analytics-lab/actionable-feedback${type ? `?type=${type}` : ''}`),
  routeInvestment: () => apiFetch<RouteInvestmentRow[]>('/analytics-lab/route-investment'),
  classificationThroughput: () => apiFetch<ClassificationThroughputRow[]>('/analytics-lab/classification-throughput'),
  dataQuality: () => apiFetch<DataQualityData>('/analytics-lab/data-quality'),
  netSatisfaction: () => apiFetch<NetSatisfactionRow[]>('/analytics-lab/net-satisfaction'),
  retentionCohorts: () => apiFetch<RetentionCohortRow[]>('/analytics-lab/retention-cohorts'),
  jiraDelivered: () => apiFetch<JiraDeliveredData>('/analytics-lab/jira-delivered'),
  featureClusters: () => apiFetch<FeatureClusterRow[]>('/analytics-lab/feature-clusters'),
  speedOfResponse: () => apiFetch<SpeedOfResponseData>('/analytics-lab/speed-of-response'),
  ttftScale: () => apiFetch<TtftScaleRow[]>('/analytics-lab/ttft-scale'),
  iceberg: () => apiFetch<IcebergRow[]>('/analytics-lab/iceberg'),
}
