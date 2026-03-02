import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Internal domains
  const domains = ['pei.group', 'peimedia.com']
  await prisma.internalDomain.createMany({
    data: domains.map(domain => ({ domain })),
    skipDuplicates: true,
  })
  console.log(`✓ Seeded internal domains: ${domains.join(', ')}`)

  // Backfill isInternal for records already in the DB
  const updated = await prisma.$executeRaw`
    UPDATE "UsageRecord"
    SET "isInternal" = true
    WHERE "userId" ILIKE '%@pei.group'
       OR "userId" ILIKE '%@peimedia.com'
  `
  console.log(`✓ Backfilled isInternal=true on ${updated} existing records`)

  // Classifications
  const classifications = [
    'AskPEI Bug',
    'Roadmap item',
    'New feature request',
    'Data issue',
    'Data expansion',
    'To be classified',
    'No Action',
  ]
  await prisma.classification.createMany({
    data: classifications.map(name => ({ name, isActive: true })),
    skipDuplicates: true,
  })
  console.log(`✓ Seeded ${classifications.length} classifications`)
}

main()
  .catch(err => { console.error(err); process.exit(1) })
  .finally(() => prisma.$disconnect())
