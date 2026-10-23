import { PrismaClient } from '@prisma/client'
if (!process.env.DATABASE_URL) throw new Error('Set DATABASE_URL in the environment before running this script');
const db = new PrismaClient()
async function main() {
  const dups = await db.$queryRawUnsafe<{code: string, cnt: bigint}[]>(`SELECT code, COUNT(*) as cnt FROM "Team" GROUP BY code HAVING COUNT(*) > 1`)
  console.log('Duplicate codes:', dups)
  for (const d of dups) {
    const kept = await db.$queryRawUnsafe<{id: string}[]>(`SELECT min(id) as id FROM "Team" WHERE code = '${d.code}' GROUP BY code`)
    if (kept.length > 0) {
      await db.$executeRawUnsafe(`DELETE FROM "Team" WHERE code = '${d.code}' AND id != '${kept[0].id}'`)
      console.log(`Fixed duplicates for ${d.code}, kept ${kept[0].id}`)
    }
  }
  console.log('Done')
  await db.$disconnect()
}
main().catch(console.error)
