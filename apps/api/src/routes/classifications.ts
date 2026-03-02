import { Router } from 'express'
import prisma from '../lib/prisma'

const router = Router()

router.get('/', (req, res) => {
  void (async () => {
    const classifications = await prisma.classification.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    })
    res.json(classifications)
  })().catch(err => {
    console.error(err)
    res.status(500).json({ error: 'Failed to fetch classifications' })
  })
})

export default router
