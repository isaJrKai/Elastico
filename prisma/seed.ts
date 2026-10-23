import { PrismaClient } from '@prisma/client'

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  throw new Error('Set DATABASE_URL before running the seed script')
}
const databaseHost = new URL(databaseUrl).hostname
const localDatabaseHosts = new Set(['localhost', '127.0.0.1', '::1', 'postgres'])
if (!localDatabaseHosts.has(databaseHost) && process.env.ELASTICO_SEED_ALLOW_REMOTE !== 'true') {
  throw new Error('Refusing to seed a remote database without ELASTICO_SEED_ALLOW_REMOTE=true')
}
if (process.env.NODE_ENV === 'production' && process.env.ELASTICO_SEED_ALLOW_PRODUCTION !== 'true') {
  throw new Error('Refusing to seed production without ELASTICO_SEED_ALLOW_PRODUCTION=true')
}

const db = new PrismaClient()

async function main() {
  console.log('Seeding ELASTICO database...')

  // System settings
  await db.systemSetting.upsert({
    where: { key: 'registration_open' },
    update: {},
    create: { key: 'registration_open', value: 'true', type: 'string' },
  })
  await db.systemSetting.upsert({
    where: { key: 'site_name' },
    update: {},
    create: { key: 'site_name', value: 'ELASTICO', type: 'string' },
  })
  await db.systemSetting.upsert({
    where: { key: 'prediction_engine' },
    update: {},
    create: { key: 'prediction_engine', value: 'ensemble', type: 'string' },
  })
  console.log('  System settings created')

  console.log('\nSeed complete!')
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect())
