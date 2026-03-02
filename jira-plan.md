# Jira Integration Plan

## Current State

A basic Jira route exists at `apps/api/src/routes/jira.ts` using the `jira.js` SDK (`Version3Client`). It currently:
- Creates one issue per selected record
- Uses `requestContent` as the summary (truncated to 255 chars)
- Has a minimal description (User, Tool Route, Feedback, Rationale as bold key-value pairs)
- Does not set labels or any custom fields
- Reads `JIRA_PROJECT_KEY` and `JIRA_ISSUE_TYPE` from env vars

---

## Target State

### Issue type
Hard-code `Bug` (remove `JIRA_ISSUE_TYPE` env var dependency for issue type).

### Summary
```
User feedback - <rationale> - <userId>
```
Truncated to 255 chars if necessary. If `rationale` is null/empty, omit that segment gracefully (e.g. `User feedback - <userId>`).

### Description (Atlassian Document Format)
The description uses ADF headings (level 2) and paragraphs:

```
BACKGROUND
Ask PEI feedback -

QUESTION
User Prompt / Query:
<requestContent>

CURRENT ANSWER (AskPEI Output)
<responseContent>

DEFECT CLASSIFICATION
<classification> - <groupText>

SUPPORTING INFORMATION / TRACE
<traceId>

Model Version
<Model Name / AskPEI Version>

Environment
Prod

Timestamp
<requestTime>
```

"Model Version" and "Environment" are static template text (no dynamic data available yet — `<Model Name / AskPEI Version>` is a placeholder).

### Labels
```json
["askPEI", "customer_feedback"]
```

### Custom Fields (requires field ID discovery — see Step 1)
| Display Name      | Expected value   | Field type (likely) |
|-------------------|------------------|---------------------|
| Engineering Team  | `Data - Subs`    | Single/multi select  |
| Skillset          | `Data Science`   | Single/multi select  |

---

## Implementation Steps

### Step 1 — Discover custom field IDs (prerequisite)

Custom fields in Jira have opaque IDs like `customfield_10042`. We cannot hardcode them without first discovering which IDs map to "Engineering Team" and "Skillset" for the CDO project.

**Method:** Call `GET /rest/api/3/field` with Basic Auth (JIRA_EMAIL + JIRA_API_TOKEN):

```bash
curl -u "$JIRA_EMAIL:$JIRA_API_TOKEN" \
  "https://peimedia.atlassian.net/rest/api/3/field" | \
  jq '.[] | select(.name | test("Engineering|Skillset"; "i")) | {id, name, schema}'
```

This returns the `id` (e.g. `customfield_10080`) and `schema.type` (e.g. `option` or `array`) for each custom field.

**Alternative:** Hit `GET /rest/api/3/issue/{existingIssueKey}/editmeta?projectKey=CDO&issueTypeId=...` to see exactly which fields are available for Bug issues in CDO. This is more reliable as it respects field schemes per project + issue type.

Once IDs are known, they will be set as:
- Single select: `customfield_XXXXX: { value: 'Data - Subs' }`
- Multi select: `customfield_XXXXX: [{ value: 'Data - Subs' }]`

The exact format will be confirmed from the `schema.type` returned in Step 1.

---

### Step 2 — Update `apps/api/.env`

```diff
- JIRA_PROJECT_KEY=PROJ
- JIRA_ISSUE_TYPE=Task
+ JIRA_PROJECT_KEY=CDO
+ JIRA_CUSTOM_ENGINEERING_TEAM=customfield_XXXXX   # filled in after Step 1
+ JIRA_CUSTOM_SKILLSET=customfield_XXXXX           # filled in after Step 1
```

`JIRA_ISSUE_TYPE` is removed; `Bug` will be hard-coded in the route (it's not configurable in this use case).

---

### Step 3 — Rewrite `makeSummary()` in `jira.ts`

```typescript
function makeSummary(record: { rationale: string | null; userId: string }): string {
  const parts = ['User feedback']
  if (record.rationale) parts.push(record.rationale.trim())
  parts.push(record.userId)
  const full = parts.join(' - ')
  return full.length > 255 ? full.slice(0, 252) + '...' : full
}
```

---

### Step 4 — Rewrite `makeDescription()` in `jira.ts`

Replace the current minimal key-value paragraph style with a full ADF document containing H2 headings and paragraphs:

```typescript
function makeDescription(record: {
  requestContent: string
  responseContent: string
  classification: string
  groupText: string | null
  traceId: string | null
  requestTime: Date
}): object {
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
      para([record.classification, record.groupText].filter(Boolean).join(' - ')),
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
```

---

### Step 5 — Update the `createIssue` call in `jira.ts`

Add labels and custom fields to the `fields` object:

```typescript
const issue = await client.issues.createIssue({
  fields: {
    project: { key: projectKey },
    issuetype: { name: 'Bug' },
    summary: makeSummary(record),
    description: makeDescription(record) as any,
    labels: ['askPEI', 'customer_feedback'],
    [process.env.JIRA_CUSTOM_ENGINEERING_TEAM!]: { value: 'Data - Subs' },
    [process.env.JIRA_CUSTOM_SKILLSET!]: { value: 'Data Science' },
  },
})
```

Note: if the custom fields turn out to be multi-select arrays, we'll wrap the value: `[{ value: 'Data - Subs' }]`.

---

### Step 6 — Validate end-to-end

1. Select a record in the UI and click "Create Jira"
2. Verify the issue appears in the CDO board at https://peimedia.atlassian.net/jira/software/c/projects/CDO/boards/150
3. Check: issue type = Bug, summary format, description sections, labels, Engineering Team, Skillset
4. Verify `jiraIssueKey` and `jiraIssueUrl` are saved to the DB and the Records table shows the link

---

## Open Questions / Risks

| # | Question | Impact |
|---|----------|--------|
| 1 | What are the exact `customfield_XXXXX` IDs for "Engineering Team" and "Skillset" in the CDO project? | Blocks Step 5 — must be resolved in Step 1 |
| 2 | Are these fields single-select or multi-select? | Affects the value shape `{ value }` vs `[{ value }]` |
| 3 | Are "Engineering Team" and "Skillset" mandatory fields on the CDO Bug screen? | If mandatory and wrong value given, `createIssue` will fail with 400 |
| 4 | Does the `jira.js` `Version3Client` accept arbitrary custom field keys in the `fields` object? | Very likely yes (it passes through to REST API), but may need `as any` cast |
| 5 | Are the label values `askPEI` / `customer_feedback` pre-existing in Jira, or do they need to be created? | Jira auto-creates labels on first use — no action needed |

---

## Files to Change

| File | Change |
|------|--------|
| `apps/api/src/routes/jira.ts` | Rewrite `makeSummary`, `makeDescription`, update `createIssue` call |
| `apps/api/.env` | Update `JIRA_PROJECT_KEY`, add `JIRA_CUSTOM_ENGINEERING_TEAM`, `JIRA_CUSTOM_SKILLSET` |
| (no frontend changes needed) | The existing "Create Jira" button flow is unchanged |
