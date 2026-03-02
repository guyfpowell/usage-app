import 'dotenv/config'
import express, { Request, Response, NextFunction } from 'express'
import ingestRouter from './routes/ingest'
import recordsRouter from './routes/records'
import jiraRouter from './routes/jira'
import { loadDomains } from './lib/domains'

const app = express()

// Basic CORS for local dev
app.use((req: Request, res: Response, next: NextFunction) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS')
  res.header('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') {
    res.sendStatus(200)
    return
  }
  next()
})

app.use(express.json())
app.use('/ingest', ingestRouter)
app.use('/records', recordsRouter)
app.use('/jira', jiraRouter)

const PORT = process.env.PORT ?? 3001

async function main() {
  await loadDomains()
  app.listen(PORT, () => {
    console.log(`API listening on port ${PORT}`)
  })
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
