'use client'

import { useQuery } from '@tanstack/react-query'
import { BarChart as ReBarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts'
import { lab } from '@/lib/api'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtWeek(w: string) {
  return new Date(w).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

function pct(n: number | null) {
  return n === null ? 'n/a' : `${n.toFixed(1)}%`
}

function secs(n: number | null) {
  return n === null ? 'n/a' : `${n.toFixed(2)}s`
}

// ── Shared UI ─────────────────────────────────────────────────────────────────

function Card({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-200">
        <h3 className="text-base font-semibold text-gray-900">{title}</h3>
        <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>
      </div>
      {children}
    </div>
  )
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th className={`px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wider ${right ? 'text-right' : 'text-left'}`}>
      {children}
    </th>
  )
}

function Td({ children, right, mono }: { children: React.ReactNode; right?: boolean; mono?: boolean }) {
  return (
    <td className={`px-4 py-2.5 text-sm text-gray-700 ${right ? 'text-right' : ''} ${mono ? 'font-mono text-xs' : ''}`}>
      {children}
    </td>
  )
}

function EmptyRow({ cols }: { cols: number }) {
  return (
    <tr>
      <td colSpan={cols} className="px-4 py-8 text-center text-gray-400 text-sm">No data</td>
    </tr>
  )
}

function StatBadge({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-gray-50 rounded-lg px-4 py-3 flex flex-col">
      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</span>
      <span className="text-2xl font-bold text-gray-900 mt-1">{value}</span>
      {sub && <span className="text-xs text-gray-400 mt-0.5">{sub}</span>}
    </div>
  )
}

function SectionHeader({ number, title, subtitle }: { number: string; title: string; subtitle: string }) {
  return (
    <div className="flex items-start gap-4 mb-6">
      <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shrink-0 mt-1">
        <span className="text-white font-bold text-sm">{number}</span>
      </div>
      <div>
        <h2 className="text-xl font-bold text-gray-900">{title}</h2>
        <p className="text-sm text-gray-500 mt-0.5 italic">{subtitle}</p>
      </div>
    </div>
  )
}

// ── Module 1: Feedback Funnel ─────────────────────────────────────────────────

function FeedbackFunnel() {
  const { data, isLoading } = useQuery({ queryKey: ['lab/feedback-funnel'], queryFn: lab.feedbackFunnel })
  const chartData = (data ?? []).slice(0, 12).map(r => ({
    name: r.toolRoute,
    'Total Requests': r.totalRequests,
    'With Feedback': r.feedbackCount,
    'Jira Raised': r.jiraCount,
  }))
  return (
    <Card title="1. Feedback Funnel by Tool Route" subtitle="Which tools generate complaints, and are they turning into fixes?">
      {!isLoading && chartData.length > 0 && (
        <div className="px-5 pt-5 pb-2">
          <ResponsiveContainer width="100%" height={280}>
            <ReBarChart data={chartData} barCategoryGap="25%">
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-25} textAnchor="end" height={60} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Total Requests" fill="#0ea5e9" radius={[3, 3, 0, 0]} />
              <Bar dataKey="With Feedback" fill="#f97316" radius={[3, 3, 0, 0]} />
              <Bar dataKey="Jira Raised" fill="#10b981" radius={[3, 3, 0, 0]} />
            </ReBarChart>
          </ResponsiveContainer>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <Th>Tool Route</Th>
              <Th right>Requests</Th>
              <Th right>Feedback</Th>
              <Th right>Feedback %</Th>
              <Th right>Classified</Th>
              <Th right>Jira raised</Th>
              <Th right>Jira / Feedback %</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? <EmptyRow cols={7} /> : data?.length ? data.map((r, i) => (
              <tr key={i} className="hover:bg-gray-50">
                <Td mono>{r.toolRoute}</Td>
                <Td right>{r.totalRequests.toLocaleString()}</Td>
                <Td right>{r.feedbackCount}</Td>
                <Td right>{pct(r.feedbackRate)}</Td>
                <Td right>{r.classifiedCount}</Td>
                <Td right>{r.jiraCount}</Td>
                <Td right>{pct(r.jiraOfFeedbackRate)}</Td>
              </tr>
            )) : <EmptyRow cols={7} />}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

// ── Module 2: Classification Mix ──────────────────────────────────────────────

function ClassificationMix() {
  const { data, isLoading } = useQuery({ queryKey: ['lab/classification-mix'], queryFn: lab.classificationMix })

  // Pivot: week → classification → count
  const weeks = Array.from(new Set(data?.map(r => r.week) ?? [])).slice(0, 12)
  const classifications = Array.from(new Set(data?.map(r => r.classification) ?? []))
  const lookup = new Map(data?.map(r => [`${r.week}|${r.classification}`, r.count]))

  return (
    <Card title="2. Classification Mix Over Time" subtitle="Are bugs trending down as feature requests grow?">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <Th>Week</Th>
              {classifications.map(c => <Th key={c} right>{c}</Th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? <EmptyRow cols={classifications.length + 1} /> : weeks.length ? weeks.map((w, i) => (
              <tr key={i} className="hover:bg-gray-50">
                <Td>{fmtWeek(w)}</Td>
                {classifications.map(c => (
                  <Td key={c} right>{lookup.get(`${w}|${c}`) ?? 0}</Td>
                ))}
              </tr>
            )) : <EmptyRow cols={classifications.length + 1} />}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

// ── Module 3: Backlog Age ─────────────────────────────────────────────────────

function BacklogAge() {
  const { data, isLoading } = useQuery({ queryKey: ['lab/backlog-age'], queryFn: lab.backlogAge })
  const total = data?.buckets.reduce((s, b) => s + b.count, 0) ?? 0
  return (
    <Card title="3. Unclassified Backlog Age" subtitle="How long does feedback sit unreviewed?">
      <div className="p-5 space-y-4">
        <div className="grid grid-cols-3 gap-3">
          {isLoading ? null : (data?.buckets ?? []).map(b => (
            <StatBadge key={b.ageBucket} label={b.ageBucket} value={String(b.count)} sub={`of ${total} total`} />
          ))}
        </div>
        {(data?.oldest?.length ?? 0) > 0 && (
          <>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mt-2">Oldest unreviewed (feedback-first)</p>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50">
                  <tr><Th>ID</Th><Th>User</Th><Th>Request time</Th><Th right>Has feedback</Th></tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data!.oldest.map(r => (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <Td>{r.id}</Td>
                      <Td mono>{r.userId}</Td>
                      <Td>{new Date(r.requestTime).toLocaleDateString()}</Td>
                      <Td right>{r.hasFeedback ? '✓' : '—'}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </Card>
  )
}

// ── Module 4: Power Users ─────────────────────────────────────────────────────

function PowerUsers() {
  const { data, isLoading } = useQuery({ queryKey: ['lab/power-users'], queryFn: lab.powerUsers })
  return (
    <Card title="4. Power User Identification" subtitle="Who drives most usage and feedback? Signal-to-noise ratio per user.">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <Th>User ID</Th>
              <Th right>Requests</Th>
              <Th right>Feedback</Th>
              <Th right>Feedback %</Th>
              <Th right>Jira raised</Th>
              <Th right>No Action</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? <EmptyRow cols={6} /> : data?.length ? data.map((r, i) => (
              <tr key={i} className="hover:bg-gray-50">
                <Td mono>{r.userId}</Td>
                <Td right>{r.totalRequests.toLocaleString()}</Td>
                <Td right>{r.feedbackCount}</Td>
                <Td right>{pct(r.feedbackRate)}</Td>
                <Td right>{r.jiraCount}</Td>
                <Td right>{r.noActionCount}</Td>
              </tr>
            )) : <EmptyRow cols={6} />}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

// ── Module 5: Latency by Route ────────────────────────────────────────────────

function LatencyByRoute() {
  const { data, isLoading } = useQuery({ queryKey: ['lab/latency-by-route'], queryFn: lab.latencyByRoute })
  const chartData = (data ?? []).slice(0, 12).map(r => ({
    name: r.toolRoute,
    'p50 (s)': r.p50Ttft ?? 0,
    'p95 (s)': r.p95Ttft ?? 0,
  }))
  return (
    <Card title="5. Latency Degradation by Tool Route" subtitle="Is TTFT getting worse on specific routes as usage grows?">
      {!isLoading && chartData.length > 0 && (
        <div className="px-5 pt-5 pb-2">
          <ResponsiveContainer width="100%" height={280}>
            <ReBarChart data={chartData} barCategoryGap="25%">
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-25} textAnchor="end" height={60} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${v}s`} />
              <Tooltip formatter={(v: number) => [`${v.toFixed(2)}s`]} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="p50 (s)" fill="#3b82f6" radius={[3, 3, 0, 0]} />
              <Bar dataKey="p95 (s)" fill="#f43f5e" radius={[3, 3, 0, 0]} />
            </ReBarChart>
          </ResponsiveContainer>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <Th>Tool Route</Th>
              <Th right>Requests</Th>
              <Th right>p50 TTFT</Th>
              <Th right>p95 TTFT</Th>
              <Th right>Avg TTFT</Th>
              <Th right>Feedback %</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? <EmptyRow cols={6} /> : data?.length ? data.map((r, i) => (
              <tr key={i} className="hover:bg-gray-50">
                <Td mono>{r.toolRoute}</Td>
                <Td right>{r.requestCount.toLocaleString()}</Td>
                <Td right>{secs(r.p50Ttft)}</Td>
                <Td right>{secs(r.p95Ttft)}</Td>
                <Td right>{secs(r.avgTtft)}</Td>
                <Td right>{pct(r.feedbackRate)}</Td>
              </tr>
            )) : <EmptyRow cols={6} />}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

// ── Module 6: Customer Response Gap ──────────────────────────────────────────

function CustomerResponseGap() {
  const { data, isLoading } = useQuery({ queryKey: ['lab/customer-response-gap'], queryFn: lab.customerResponseGap })
  const coveragePct = data && data.totalWithFeedback > 0
    ? ((data.withResponse / data.totalWithFeedback) * 100).toFixed(1)
    : null
  return (
    <Card title="6. Customer Response Coverage" subtitle="What fraction of external users who left feedback have received a response?">
      <div className="p-5 space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <StatBadge label="External with feedback" value={isLoading ? '…' : String(data?.totalWithFeedback ?? 0)} />
          <StatBadge label="Responded" value={isLoading ? '…' : String(data?.withResponse ?? 0)} />
          <StatBadge label="Coverage" value={isLoading ? '…' : coveragePct ? `${coveragePct}%` : 'n/a'} sub="target: 100%" />
        </div>
        {(data?.unresponded?.length ?? 0) > 0 && (
          <>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mt-2">Unresponded (most recent first)</p>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50">
                  <tr><Th>ID</Th><Th>User</Th><Th>Route</Th><Th>Feedback value</Th><Th>Date</Th></tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data!.unresponded.map(r => (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <Td>{r.id}</Td>
                      <Td mono>{r.userId}</Td>
                      <Td mono>{r.toolRoute}</Td>
                      <Td>{r.feedbackValue ?? '—'}</Td>
                      <Td>{new Date(r.requestTime).toLocaleDateString()}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </Card>
  )
}

// ── Module 7: Repeat Complainants ─────────────────────────────────────────────

function RepeatComplainants() {
  const { data, isLoading } = useQuery({ queryKey: ['lab/repeat-complainants'], queryFn: lab.repeatComplainants })
  const chartData = (data ?? []).slice(0, 15).map(r => ({
    name: `${r.userId.length > 14 ? r.userId.slice(0, 13) + '…' : r.userId} · ${r.toolRoute.split('/').filter(Boolean).pop() ?? r.toolRoute}`,
    'Distinct weeks': r.weeksWithFeedback,
    'Total feedback': r.totalFeedback,
  }))
  return (
    <Card title="7. Repeat Complainants on Same Route" subtitle="Users hitting the same wall repeatedly — strongest signal to escalate.">
      {!isLoading && chartData.length > 0 && (
        <div className="px-5 pt-5 pb-2">
          <ResponsiveContainer width="100%" height={256}>
            <ReBarChart data={chartData} barCategoryGap="25%">
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-25} textAnchor="end" height={60} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Distinct weeks" fill="#f43f5e" radius={[3, 3, 0, 0]} />
              <Bar dataKey="Total feedback" fill="#f97316" radius={[3, 3, 0, 0]} />
            </ReBarChart>
          </ResponsiveContainer>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <Th>User ID</Th>
              <Th>Tool Route</Th>
              <Th right>Distinct weeks</Th>
              <Th right>Total feedback</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? <EmptyRow cols={4} /> : data?.length ? data.map((r, i) => (
              <tr key={i} className="hover:bg-gray-50">
                <Td mono>{r.userId}</Td>
                <Td mono>{r.toolRoute}</Td>
                <Td right>{r.weeksWithFeedback}</Td>
                <Td right>{r.totalFeedback}</Td>
              </tr>
            )) : (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400 text-sm">No repeat complainants — good sign!</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

// ── Module 8: Adoption Ratio ──────────────────────────────────────────────────

function AdoptionRatio() {
  const { data, isLoading } = useQuery({ queryKey: ['lab/adoption-ratio'], queryFn: lab.adoptionRatio })
  return (
    <Card title="8. Internal vs External Adoption Over Time" subtitle="Is external usage growing faster than internal?">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <Th>Week</Th>
              <Th right>Int. requests</Th>
              <Th right>Ext. requests</Th>
              <Th right>Int. WAU</Th>
              <Th right>Ext. WAU</Th>
              <Th right>Ext. %</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? <EmptyRow cols={6} /> : data?.length ? data.map((r, i) => {
              const total = r.internalRequests + r.externalRequests
              const extPct = total > 0 ? ((r.externalRequests / total) * 100).toFixed(1) : 'n/a'
              return (
                <tr key={i} className="hover:bg-gray-50">
                  <Td>{fmtWeek(r.week)}</Td>
                  <Td right>{r.internalRequests.toLocaleString()}</Td>
                  <Td right>{r.externalRequests.toLocaleString()}</Td>
                  <Td right>{r.internalUsers}</Td>
                  <Td right>{r.externalUsers}</Td>
                  <Td right>{extPct !== 'n/a' ? `${extPct}%` : 'n/a'}</Td>
                </tr>
              )
            }) : <EmptyRow cols={6} />}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

// ── Module 10: Route Investment ───────────────────────────────────────────────

function RouteInvestment() {
  const { data, isLoading } = useQuery({ queryKey: ['lab/route-investment'], queryFn: lab.routeInvestment })
  return (
    <Card title="10. Tool Route Investment vs Usage Return" subtitle="Which capabilities are heavily used and which were built but ignored?">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <Th>Tool Route</Th>
              <Th right>Requests</Th>
              <Th right>Distinct users</Th>
              <Th right>Req / user</Th>
              <Th right>Feedback</Th>
              <Th right>Feedback %</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? <EmptyRow cols={6} /> : data?.length ? data.map((r, i) => (
              <tr key={i} className="hover:bg-gray-50">
                <Td mono>{r.toolRoute}</Td>
                <Td right>{r.requestCount.toLocaleString()}</Td>
                <Td right>{r.distinctUsers}</Td>
                <Td right>{r.distinctUsers > 0 ? (r.requestCount / r.distinctUsers).toFixed(1) : '—'}</Td>
                <Td right>{r.feedbackCount}</Td>
                <Td right>{pct(r.feedbackRate)}</Td>
              </tr>
            )) : <EmptyRow cols={6} />}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

// ── Module 11: Weekly Active Users (shares data with Module 8) ────────────────

function WeeklyActiveUsers() {
  const { data, isLoading } = useQuery({ queryKey: ['lab/adoption-ratio'], queryFn: lab.adoptionRatio })
  const chartData = (data ?? []).slice().reverse().map(r => ({
    week: fmtWeek(r.week),
    'Internal': r.internalUsers,
    'External': r.externalUsers,
  }))
  return (
    <Card title="11. Weekly Active Users" subtitle="Is the product retaining users week-over-week?">
      {!isLoading && chartData.length > 0 && (
        <div className="px-5 pt-5 pb-2">
          <ResponsiveContainer width="100%" height={280}>
            <ReBarChart data={chartData} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
              <XAxis dataKey="week" tick={{ fontSize: 10 }} angle={-25} textAnchor="end" height={60} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Internal" stackId="a" fill="#0ea5e9" />
              <Bar dataKey="External" stackId="a" fill="#8b5cf6" radius={[3, 3, 0, 0]} />
            </ReBarChart>
          </ResponsiveContainer>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <Th>Week</Th>
              <Th right>Internal WAU</Th>
              <Th right>External WAU</Th>
              <Th right>Total WAU</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? <EmptyRow cols={4} /> : data?.length ? data.map((r, i) => (
              <tr key={i} className="hover:bg-gray-50">
                <Td>{fmtWeek(r.week)}</Td>
                <Td right>{r.internalUsers}</Td>
                <Td right>{r.externalUsers}</Td>
                <Td right>{r.internalUsers + r.externalUsers}</Td>
              </tr>
            )) : <EmptyRow cols={4} />}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

// ── Module 12: Classification Throughput ──────────────────────────────────────

function ClassificationThroughput() {
  const { data, isLoading } = useQuery({ queryKey: ['lab/classification-throughput'], queryFn: lab.classificationThroughput })
  return (
    <Card title="12. Classification Throughput vs Backlog" subtitle="Is the team keeping up with incoming records?">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <Th>Week ingested</Th>
              <Th right>New records</Th>
              <Th right>Now classified</Th>
              <Th right>Still unclassified</Th>
              <Th right>Classified %</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? <EmptyRow cols={5} /> : data?.length ? data.map((r, i) => {
              const classifiedPct = r.ingested > 0 ? ((r.classifiedThisWeek / r.ingested) * 100).toFixed(1) : 'n/a'
              return (
                <tr key={i} className="hover:bg-gray-50">
                  <Td>{fmtWeek(r.week)}</Td>
                  <Td right>{r.ingested}</Td>
                  <Td right>{r.classifiedThisWeek}</Td>
                  <Td right>{r.stillUnclassified}</Td>
                  <Td right>{classifiedPct !== 'n/a' ? `${classifiedPct}%` : 'n/a'}</Td>
                </tr>
              )
            }) : <EmptyRow cols={5} />}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

// ── Module 13: Data Quality Score ─────────────────────────────────────────────

function DataQuality() {
  const { data, isLoading } = useQuery({ queryKey: ['lab/data-quality'], queryFn: lab.dataQuality })
  const items = data ? [
    { label: 'Long requests (>10k chars)', value: data.longRequest, sub: `${data.total > 0 ? ((data.longRequest / data.total) * 100).toFixed(1) : 0}% of total` },
    { label: 'Long responses (>10k chars)', value: data.longResponse, sub: `${data.total > 0 ? ((data.longResponse / data.total) * 100).toFixed(1) : 0}% of total` },
    { label: 'Missing trace ID', value: data.noTraceId, sub: 'harder to debug' },
    { label: 'Missing TTFT', value: data.noTtft, sub: 'monitoring gap' },
    { label: 'Feedback but no feedbackValue', value: data.noFeedbackValueButHasFeedback, sub: 'classification gap' },
  ] : []
  return (
    <Card title="13. Data Quality Score" subtitle="How clean is what's coming from Databricks?">
      <div className="p-5">
        {isLoading ? <p className="text-gray-400 text-sm">Loading…</p> : (
          <>
            <p className="text-xs text-gray-500 mb-4">Total records: <span className="font-semibold text-gray-900">{data?.total.toLocaleString()}</span></p>
            <div className="grid grid-cols-2 gap-3">
              {items.map(item => (
                <StatBadge key={item.label} label={item.label} value={String(item.value)} sub={item.sub} />
              ))}
            </div>
          </>
        )}
      </div>
    </Card>
  )
}

// ── Module 14: Net Satisfaction Trend ─────────────────────────────────────────

function NetSatisfaction() {
  const { data, isLoading } = useQuery({ queryKey: ['lab/net-satisfaction'], queryFn: lab.netSatisfaction })
  const allValues = Array.from(new Set(data?.flatMap(r => Object.keys(r.breakdown)) ?? []))
  return (
    <Card title="14. Net Satisfaction Trend (NST)" subtitle="Weekly feedback breakdown by value — identify positive vs negative to compute NST.">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <Th>Week</Th>
              {allValues.map(v => <Th key={v} right>{v}</Th>)}
              <Th right>Total</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? <EmptyRow cols={allValues.length + 2} /> : data?.length ? data.map((r, i) => (
              <tr key={i} className="hover:bg-gray-50">
                <Td>{fmtWeek(r.week)}</Td>
                {allValues.map(v => <Td key={v} right>{r.breakdown[v] ?? 0}</Td>)}
                <Td right>{r.total}</Td>
              </tr>
            )) : <EmptyRow cols={allValues.length + 2} />}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

// ── Module 15: Retention Cohorts ──────────────────────────────────────────────

function RetentionCohorts() {
  const { data, isLoading } = useQuery({ queryKey: ['lab/retention-cohorts'], queryFn: lab.retentionCohorts })
  return (
    <Card title="15. External User Retention Cohorts" subtitle="Are new external users sticking around 4 and 8 weeks later?">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <Th>Cohort week</Th>
              <Th right>Cohort size</Th>
              <Th right>Retained @ 4w</Th>
              <Th right>4w rate</Th>
              <Th right>Retained @ 8w</Th>
              <Th right>8w rate</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? <EmptyRow cols={6} /> : data?.length ? data.map((r, i) => (
              <tr key={i} className="hover:bg-gray-50">
                <Td>{fmtWeek(r.cohortWeek)}</Td>
                <Td right>{r.cohortSize}</Td>
                <Td right>{r.retained4w}</Td>
                <Td right>{r.cohortSize > 0 ? `${((r.retained4w / r.cohortSize) * 100).toFixed(0)}%` : 'n/a'}</Td>
                <Td right>{r.retained8w}</Td>
                <Td right>{r.cohortSize > 0 ? `${((r.retained8w / r.cohortSize) * 100).toFixed(0)}%` : 'n/a'}</Td>
              </tr>
            )) : <EmptyRow cols={6} />}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

// ── Module 16: Jira Delivered ─────────────────────────────────────────────────

function JiraDelivered() {
  const { data, isLoading } = useQuery({ queryKey: ['lab/jira-delivered'], queryFn: lab.jiraDelivered })
  return (
    <Card title="16. Cumulative Value Delivered via Jira" subtitle="How many customer-reported issues have been formally acknowledged and acted on?">
      <div className="p-5 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <StatBadge label="Total Jira issues raised" value={isLoading ? '…' : String(data?.totalWithJira ?? 0)} />
          <StatBadge label="Total records" value={isLoading ? '…' : String(data?.totalRecords ?? 0)} sub="records processed" />
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr><Th>Classification</Th><Th right>Jira issues raised</Th></tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? <EmptyRow cols={2} /> : data?.byClassification.length ? data.byClassification.map((r, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <Td>{r.classification}</Td>
                  <Td right>{r.count}</Td>
                </tr>
              )) : <EmptyRow cols={2} />}
            </tbody>
          </table>
        </div>
      </div>
    </Card>
  )
}

// ── Module 17: Feature Clusters ───────────────────────────────────────────────

function FeatureClusters() {
  const { data, isLoading } = useQuery({ queryKey: ['lab/feature-clusters'], queryFn: lab.featureClusters })
  return (
    <Card title="17. Strategic Signal: Feature Request Clustering" subtitle="What are customers actually asking for that hasn't been built or roadmapped?">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <Th>Tool Route</Th>
              <Th>Epic</Th>
              <Th right>Requests</Th>
              <Th right>Users</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? <EmptyRow cols={4} /> : data?.length ? data.map((r, i) => (
              <tr key={i} className={`hover:bg-gray-50 ${!r.epicKey ? 'bg-amber-50' : ''}`}>
                <Td mono>{r.toolRoute}</Td>
                <Td>
                  {r.epicKey
                    ? <span className="font-mono text-xs">{r.epicKey}</span>
                    : <span className="text-amber-600 text-xs font-medium">Not roadmapped</span>}
                </Td>
                <Td right>{r.count}</Td>
                <Td right>{r.distinctUsers}</Td>
              </tr>
            )) : (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400 text-sm">No feature requests classified yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

// ── Module 18: Speed of Response ──────────────────────────────────────────────

function SpeedOfResponse() {
  const { data, isLoading } = useQuery({ queryKey: ['lab/speed-of-response'], queryFn: lab.speedOfResponse })
  return (
    <Card title="18. Speed of Response to Customer Pain" subtitle="How quickly does a negative feedback record become a Jira ticket?">
      <div className="p-5 space-y-4">
        {data?.note && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-xs text-amber-800">
            ⚠️ {data.note}
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <StatBadge label="Records with Jira" value={isLoading ? '…' : String(data?.recordsWithJira ?? 0)} />
          <StatBadge label="Avg days (request → ingest)" value={isLoading ? '…' : data?.avgDaysToIngestion != null ? `${data.avgDaysToIngestion}d` : 'n/a'} />
          <StatBadge label="p50 days" value={isLoading ? '…' : data?.p50Days != null ? `${data.p50Days}d` : 'n/a'} />
          <StatBadge label="p90 days" value={isLoading ? '…' : data?.p90Days != null ? `${data.p90Days}d` : 'n/a'} />
        </div>
      </div>
    </Card>
  )
}

// ── Module 19: TTFT at Scale ──────────────────────────────────────────────────

function TtftScale() {
  const { data, isLoading } = useQuery({ queryKey: ['lab/ttft-scale'], queryFn: lab.ttftScale })
  const chartData = (data ?? []).slice().reverse().map(r => ({
    week: fmtWeek(r.week),
    'p50 TTFT (s)': r.p50Ttft ?? 0,
    'p95 TTFT (s)': r.p95Ttft ?? 0,
  }))
  return (
    <Card title="19. AI Reliability: TTFT at Scale" subtitle="Is response speed holding up as adoption grows? A stable p95 under growing load is a confidence signal.">
      {!isLoading && chartData.length > 0 && (
        <div className="px-5 pt-5 pb-2">
          <ResponsiveContainer width="100%" height={280}>
            <ReBarChart data={chartData} barCategoryGap="25%">
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
              <XAxis dataKey="week" tick={{ fontSize: 10 }} angle={-25} textAnchor="end" height={60} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${v}s`} />
              <Tooltip formatter={(v: number) => [`${v.toFixed(2)}s`]} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="p50 TTFT (s)" fill="#0ea5e9" radius={[3, 3, 0, 0]} />
              <Bar dataKey="p95 TTFT (s)" fill="#f43f5e" radius={[3, 3, 0, 0]} />
            </ReBarChart>
          </ResponsiveContainer>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <Th>Week</Th>
              <Th right>Requests</Th>
              <Th right>p50 TTFT</Th>
              <Th right>p95 TTFT</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? <EmptyRow cols={4} /> : data?.length ? data.map((r, i) => (
              <tr key={i} className="hover:bg-gray-50">
                <Td>{fmtWeek(r.week)}</Td>
                <Td right>{r.requestCount.toLocaleString()}</Td>
                <Td right>{secs(r.p50Ttft)}</Td>
                <Td right>{secs(r.p95Ttft)}</Td>
              </tr>
            )) : <EmptyRow cols={4} />}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

// ── Module 20: Iceberg Metric ─────────────────────────────────────────────────

function IcebergMetric() {
  const { data, isLoading } = useQuery({ queryKey: ['lab/iceberg'], queryFn: lab.iceberg })
  return (
    <Card title="20. The Iceberg Metric: Feedback Rate" subtitle="A declining feedback rate can mean happier users — or users who've stopped bothering to report.">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <Th>Week</Th>
              <Th right>Total requests</Th>
              <Th right>With feedback</Th>
              <Th right>Feedback rate</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? <EmptyRow cols={4} /> : data?.length ? data.map((r, i) => (
              <tr key={i} className="hover:bg-gray-50">
                <Td>{fmtWeek(r.week)}</Td>
                <Td right>{r.totalRequests.toLocaleString()}</Td>
                <Td right>{r.feedbackCount}</Td>
                <Td right>{pct(r.feedbackRate)}</Td>
              </tr>
            )) : <EmptyRow cols={4} />}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AnalyticsLabPage() {
  return (
    <div className="space-y-12">
      <div>
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-2xl font-bold text-gray-900">Analytics Lab</h1>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
            Test — pick what you like
          </span>
        </div>
        <p className="text-sm text-gray-500">All 20 analytics ideas from analytics-ideas.md, in three lenses. Remove the modules you don&apos;t want after review.</p>
      </div>

      {/* ── Section 1: Product Manager ─────────────────────────────────────── */}
      <section>
        <SectionHeader
          number="PM"
          title="Product Manager's Lens"
          subtitle='"Is the product getting better?"'
        />
        <div className="space-y-6">
          <FeedbackFunnel />
          <ClassificationMix />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <BacklogAge />
            <RepeatComplainants />
          </div>
          <PowerUsers />
          <LatencyByRoute />
          <CustomerResponseGap />
        </div>
      </section>

      {/* ── Section 2: Head of Department ─────────────────────────────────── */}
      <section>
        <SectionHeader
          number="HoD"
          title="Head of Department's Lens"
          subtitle='"Is this investment working?"'
        />
        <div className="space-y-6">
          <AdoptionRatio />
          <WeeklyActiveUsers />
          <RouteInvestment />
          <ClassificationThroughput />
          <DataQuality />
        </div>
      </section>

      {/* ── Section 3: Executive / Board ───────────────────────────────────── */}
      <section>
        <SectionHeader
          number="Exec"
          title="Executive / Board Lens"
          subtitle='"Is AskPEI delivering value and are we ahead of the problem?"'
        />
        <div className="space-y-6">
          <NetSatisfaction />
          <RetentionCohorts />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <JiraDelivered />
            <SpeedOfResponse />
          </div>
          <FeatureClusters />
          <TtftScale />
          <IcebergMetric />
        </div>
      </section>
    </div>
  )
}
