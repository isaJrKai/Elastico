import { PrismaClient } from '@prisma/client'
const db = new PrismaClient({
  datasources: { db: { url: 'postgresql://neondb_owner:npg_8zPlbIK5NwaR@ep-late-sunset-axydccn7-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require' } }
})
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
