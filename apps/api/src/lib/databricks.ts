const HOST = process.env.DATABRICKS_HOST!
const WAREHOUSE_ID = process.env.DATABRICKS_WAREHOUSE_ID!
const TOKEN = process.env.DATABRICKS_TOKEN!

const SOURCE_SQL = `
SELECT
    t.request:context.user_id::string AS user_id,
    t.request_time,
    t.trace_id,
    concat_ws('',
        transform(
            from_json(t.response, 'array<struct<delta:struct<content:string>>>'),
            x -> x.delta.content
        )
    ) AS response_content,
    from_json(t.request:messages, 'array<struct<content:string>>')[
      size(from_json(t.request:messages, 'array<struct<content:string>>')) - 1
    ].content AS request_content,
    CASE
        WHEN size(filter(t.assessments, x -> x.source.source_type != 'LLM_JUDGE')) > 0
        THEN filter(t.assessments, x -> x.source.source_type != 'LLM_JUDGE')[0].feedback.value::string
        ELSE NULL
    END AS feedback_value,
    CASE
        WHEN size(filter(t.assessments, x -> x.source.source_type != 'LLM_JUDGE')) > 0
        THEN filter(t.assessments, x -> x.source.source_type != 'LLM_JUDGE')[0].rationale::string
        ELSE NULL
    END AS rationale,
    concat_ws(' → ',
      get_json_object(get(filter(t.spans, s -> s.name = 'SupportCheck'), 0).attributes['mlflow.spanOutputs'], '$.next_node'),
      get_json_object(get(filter(t.spans, s -> s.name = 'EntityExtractionNLU'), 0).attributes['mlflow.spanOutputs'], '$.next_node'),
      CASE WHEN size(filter(t.spans, s -> s.name = 'router')) > 0 THEN 'router' END,
      coalesce(
        get_json_object(get(filter(t.spans, s -> s.name = 'router'), 0).attributes['mlflow.spanOutputs'], '$.next_node'),
        get_json_object(get(filter(t.spans, s -> s.name = 'supervisor'), 0).attributes['mlflow.spanOutputs'], '$.next_node')
      ),
      get_json_object(get(filter(t.spans, s -> s.name = 'FundRouter'), 0).attributes['mlflow.spanOutputs'], '$.next_node')
    ) AS tool_route,
    round(
      (unix_timestamp(to_timestamp(coalesce(
        get(filter(t.spans, s -> s.name = 'FinalAnswerGenie'), 0).start_time,
        get(filter(t.spans, s -> s.name = 'final_answer_genie_agent'), 0).start_time,
        get(filter(t.spans, s -> s.name = 'FinalAnswerArticle'), 0).start_time,
        get(filter(t.spans, s -> s.name = 'final_answer_article_agent'), 0).start_time,
        get(filter(t.spans, s -> s.name = 'FinalAnswerProfile'), 0).start_time,
        get(filter(t.spans, s -> s.name = 'final_answer_profile_agent'), 0).start_time,
        get(filter(t.spans, s -> s.name = 'final_answer_ranking_agent'), 0).start_time,
        get(filter(t.spans, s -> s.name = 'final_answer'), 0).start_time,
        get(filter(t.spans, s -> s.name = 'TemplateResponder'), 0).start_time
      ))) - unix_timestamp(t.request_time)),
    2) AS ttft_seconds
FROM editorial_prod.offline_copilot.traces t
LEFT JOIN editorial_prod.offline_copilot.requests_enriched r ON t.trace_id = r.trace_id
WHERE t.request:context.user_id::string NOT IN (
    "santiago.jaramillo@pei.group",
    "alex.g@pei.group",
    "charlie.m@pei.group",
    "connor.grant@pei.group",
    "donal.s@pei.group",
    "emile.messelken@pei.group",
    "filiz.gunal@pei.group",
    "harry.norton@pei.group",
    "neil.s@pei.group",
    "olly.pickard@pei.group",
    "philip.wigg@pei.group",
    "poornesh.srinivas@pei.group",
    "rahul.d@pei.group",
    "sharath.vishwanath@pei.group",
    "shivaram.subramanian@pei.group",
    "soniya.bhosale@pei.group",
    "stephanie.ko@pei.group",
    "databricks@pei.group",
    "shiyam.sundaran@pei.group",
    "admin.connor.grant@pei.group",
    "admin.philip.wigg@pei.group",
    "admin.neil.s@pei.group",
    "vivek.n@pei.group",
    "divya.pal@pei.group",
    "mursalin.larik@pei.group",
    "alan.cherian@pei.group",
    "john.anderson@pei.group",
    "oscar.hoffman@pei.group"
)
{DATE_FILTER}
ORDER BY t.request_time ASC
`

export interface DatabricksRow {
  user_id: string
  request_time: string
  trace_id: string | null
  request_content: string | null
  response_content: string | null
  feedback_value: string | null
  rationale: string | null
  tool_route: string | null
  ttft_seconds: number | null
}

interface StatementResponse {
  statement_id: string
  status: { state: string; error?: { message: string } }
  manifest?: { schema: { columns: { name: string }[] } }
  result?: {
    chunk_index: number
    next_chunk_index?: number
    row_count: number
    data_array?: string[][]
  }
}

async function apiRequest<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${HOST}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Databricks API error ${res.status}: ${text}`)
  }
  return res.json() as Promise<T>
}

function buildSql(since?: Date): string {
  const dateFilter = since
    ? `AND t.request_time > TIMESTAMP('${since.toISOString().replace('T', ' ').replace('Z', '')}')`
    : ''
  return SOURCE_SQL.replace('{DATE_FILTER}', dateFilter)
}

function rowsToObjects(columns: string[], data: string[][]): DatabricksRow[] {
  return data.map(row => {
    const obj: Record<string, unknown> = {}
    columns.forEach((col, i) => { obj[col] = row[i] ?? null })
    return {
      user_id: obj.user_id as string,
      request_time: obj.request_time as string,
      trace_id: obj.trace_id as string | null,
      request_content: obj.request_content as string | null,
      response_content: obj.response_content as string | null,
      feedback_value: obj.feedback_value as string | null,
      rationale: obj.rationale as string | null,
      tool_route: obj.tool_route as string | null,
      ttft_seconds: obj.ttft_seconds != null ? parseFloat(obj.ttft_seconds as string) : null,
    }
  })
}

export async function fetchFromDatabricks(since?: Date): Promise<DatabricksRow[]> {
  const statement = buildSql(since)

  // Submit statement
  const submitted = await apiRequest<StatementResponse>('/api/2.0/sql/statements', {
    warehouse_id: WAREHOUSE_ID,
    statement,
    wait_timeout: '50s',
    disposition: 'INLINE',
    format: 'JSON_ARRAY',
  })

  if (submitted.status.state === 'FAILED') {
    throw new Error(`Databricks query failed: ${submitted.status.error?.message}`)
  }

  // Poll if still running
  let result = submitted
  while (result.status.state === 'RUNNING' || result.status.state === 'PENDING') {
    await new Promise(r => setTimeout(r, 2000))
    result = await apiRequest<StatementResponse>(`/api/2.0/sql/statements/${result.statement_id}`)
    if (result.status.state === 'FAILED') {
      throw new Error(`Databricks query failed: ${result.status.error?.message}`)
    }
  }

  if (!result.manifest || !result.result) return []

  const columns = result.manifest.schema.columns.map(c => c.name)
  const allRows: DatabricksRow[] = []

  // First chunk
  allRows.push(...rowsToObjects(columns, result.result.data_array ?? []))

  // Additional chunks if paginated
  let nextChunk = result.result.next_chunk_index
  while (nextChunk !== undefined) {
    const chunk = await apiRequest<{ data_array?: string[][]; next_chunk_index?: number }>(
      `/api/2.0/sql/statements/${result.statement_id}/result/chunks/${nextChunk}`
    )
    allRows.push(...rowsToObjects(columns, chunk.data_array ?? []))
    nextChunk = chunk.next_chunk_index
  }

  return allRows
}
