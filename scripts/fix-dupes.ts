import { PrismaClient } from '@prisma/client'
if (!process.env.DATABASE_URL) throw new Error('Set DATABASE_URL before running this maintenance script.');
if (process.env.ALLOW_MUTATING_MAINTENANCE_SCRIPT !== 'true') throw new Error('Set ALLOW_MUTATING_MAINTENANCE_SCRIPT=true after reviewing the target database.');
const db = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL! } }
})
async function main() {
  const dups = await db.$queryRawUnsafe<{code: string, cnt: bigint}[]>(`SELECT code, COUNT(*) as cnt FROM "Team" GROUP BY code HAVING COUNT(*) > 1`)
  console.log('Duplicate codes:', dups)
  for (const d of dups) {
    const kept = await db.$queryRawUnsafe<{id: string}[]>('SELECT min(id) as id FROM "Team" WHERE code = $1 GROUP BY code', d.code)
    if (kept.length > 0) {
      await db.$executeRawUnsafe('DELETE FROM "Team" WHERE code = $1 AND id != $2', d.code, kept[0].id)
      console.log(`Fixed duplicates for ${d.code}, kept ${kept[0].id}`)
    }
  }
  console.log('Done')
  await db.$disconnect()
}
main().catch(console.error)
