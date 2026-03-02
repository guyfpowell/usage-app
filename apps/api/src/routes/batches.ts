import { Router } from 'express'
import prisma from '../lib/prisma'

const router = Router()

// GET /batches — list recent upload batches
router.get('/', (req, res) => {
  void (async () => {
    const batches = await prisma.uploadBatch.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
    res.json(batches)
  })().catch(err => {
    console.error(err)
    res.status(500).json({ error: 'Failed to fetch batches' })
  })
})

// POST /batches/:id/rollback — undo an upload batch
router.post('/:id/rollback', (req, res) => {
  void (async () => {
    const id = parseInt(req.params.id)
    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid id' })
      return
    }

    const batch = await prisma.uploadBatch.findUnique({
      where: { id },
      include: { records: true },
    })

    if (!batch) {
      res.status(404).json({ error: 'Batch not found' })
      return
    }

    if (batch.isRolledBack) {
      res.status(409).json({ error: 'Batch has already been rolled back' })
      return
    }

    const inserted = batch.records.filter(r => r.action === 'inserted').map(r => r.recordId)
    const updated = batch.records.filter(r => r.action === 'updated')

    // Delete inserted records
    if (inserted.length > 0) {
      await prisma.usageRecord.deleteMany({ where: { id: { in: inserted } } })
    }

    // Restore updated records to their previous state
    for (const batchRecord of updated) {
      const prev = batchRecord.previousState as {
        traceId: string | null
        requestContent: string
        responseContent: string
        feedbackValue: string | null
        rationale: string | null
        toolRoute: string
        ttftSeconds: number | null
        isInternal: boolean
        hasFeedback: boolean
      }
      if (!prev) continue
      await prisma.usageRecord.update({
        where: { id: batchRecord.recordId },
        data: {
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
      })
    }

    await prisma.uploadBatch.update({
      where: { id },
      data: { isRolledBack: true },
    })

    res.json({ deleted: inserted.length, restored: updated.length })
  })().catch(err => {
    console.error(err)
    res.status(500).json({ error: 'Rollback failed' })
  })
})

export default router
