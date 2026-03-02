import prisma from './prisma'
import { ParsedRow } from '../routes/ingest'

export interface UpsertResult {
  inserted: number
  updated: number
  batchId: number
}

/** Deduplicate, upsert into UsageRecord, and record a batch with full rollback snapshots.
 *  Only ingest-owned fields are written — user fields (classification, notes, epic, etc.) are never touched. */
export async function runUpsertPipeline(
  rows: ParsedRow[],
  batchFilename: string,
  batchSource: 'csv' | 'databricks'
): Promise<UpsertResult> {
  if (rows.length === 0) {
    const batch = await prisma.uploadBatch.create({
      data: { filename: batchFilename, source: batchSource, insertedCount: 0, updatedCount: 0 },
    })
    return { inserted: 0, updated: 0, batchId: batch.id }
  }

  // Deduplicate within the incoming rows (last row wins)
  const dedupMap = new Map<string, ParsedRow>()
  for (const row of rows) {
    dedupMap.set(`${row.userId}|${row.requestTime.toISOString()}`, row)
  }
  const unique = Array.from(dedupMap.values())

  const existing = await prisma.usageRecord.findMany({
    where: { OR: unique.map(r => ({ userId: r.userId, requestTime: r.requestTime })) },
  })

  const existingKeys = new Set(existing.map(r => `${r.userId}|${r.requestTime.toISOString()}`))

  const toCreate = unique.filter(r => !existingKeys.has(`${r.userId}|${r.requestTime.toISOString()}`))
  const toUpdate = unique.filter(r => existingKeys.has(`${r.userId}|${r.requestTime.toISOString()}`))

  const batch = await prisma.uploadBatch.create({
    data: { filename: batchFilename, source: batchSource, insertedCount: 0, updatedCount: 0 },
  })

  if (toCreate.length > 0) {
    await prisma.usageRecord.createMany({ data: toCreate })
    const created = await prisma.usageRecord.findMany({
      where: { OR: toCreate.map(r => ({ userId: r.userId, requestTime: r.requestTime })) },
      select: { id: true },
    })
    await prisma.uploadBatchRecord.createMany({
      data: created.map(r => ({ batchId: batch.id, recordId: r.id, action: 'inserted' })),
    })
  }

  for (const row of toUpdate) {
    const prev = existing.find(
      e => e.userId === row.userId && e.requestTime.toISOString() === row.requestTime.toISOString()
    )
    await prisma.usageRecord.update({
      where: { userId_requestTime: { userId: row.userId, requestTime: row.requestTime } },
      data: {
        traceId: row.traceId,
        requestContent: row.requestContent,
        responseContent: row.responseContent,
        feedbackValue: row.feedbackValue,
        rationale: row.rationale,
        toolRoute: row.toolRoute,
        ttftSeconds: row.ttftSeconds,
        isInternal: row.isInternal,
        hasFeedback: row.hasFeedback,
      },
    })
    if (prev) {
      await prisma.uploadBatchRecord.create({
        data: {
          batchId: batch.id,
          recordId: prev.id,
          action: 'updated',
          previousState: {
            traceId: prev.traceId,
            requestContent: prev.requestContent,
            responseContent: prev.responseContent,
            feedbackValue: prev.feedbackValue,
            rationale: prev.rationale,
            toolRoute: prev.toolRoute,
            ttftSeconds: prev.ttftSeconds,
            isInternal: prev.isInternal,
            hasFeedback: prev.hasFeedback,
          },
        },
      })
    }
  }

  await prisma.uploadBatch.update({
    where: { id: batch.id },
    data: { insertedCount: toCreate.length, updatedCount: toUpdate.length },
  })

  return { inserted: toCreate.length, updated: toUpdate.length, batchId: batch.id }
}
