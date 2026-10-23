import { PrismaClient } from '@prisma/client'

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  throw new Error('Set DATABASE_URL in the environment before running this maintenance script.')
}
if (process.env.ALLOW_MUTATING_MAINTENANCE_SCRIPT !== 'true') {
  throw new Error('This script deletes duplicate team rows. Set ALLOW_MUTATING_MAINTENANCE_SCRIPT=true only after reviewing the target database and taking a backup.')
}

const db = new PrismaClient({ datasources: { db: { url: databaseUrl } } })

async function main() {
  const dups = await db.$queryRawUnsafe<{ code: string; cnt: bigint }[]>(
    'SELECT code, COUNT(*) AS cnt FROM "Team" GROUP BY code HAVING COUNT(*) > 1'
  )
  console.log('Duplicate codes:', dups.map(d => ({ code: d.code, count: String(d.cnt) })))

  for (const duplicate of dups) {
    const kept = await db.$queryRawUnsafe<{ id: string }[]>(
      'SELECT min(id) AS id FROM "Team" WHERE code = $1 GROUP BY code',
      duplicate.code
    )
    if (kept.length > 0) {
      await db.$executeRawUnsafe(
        'DELETE FROM "Team" WHERE code = $1 AND id != $2',
        duplicate.code,
        kept[0].id
      )
      console.log('Fixed duplicates for ' + duplicate.code + ', kept ' + kept[0].id)
    }
  }

  console.log('Done')
}

main()
  .catch((error) => {
    console.error('Duplicate cleanup failed:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await db.$disconnect()
  })
