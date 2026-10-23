import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

async function main() {
  // Refuse to mutate production settings unless an operator explicitly opts in.
  if (process.env.NODE_ENV === 'production' && process.env.ELASTICO_SEED_ALLOW_PRODUCTION !== 'true') {
    throw new Error('Refusing to seed production without ELASTICO_SEED_ALLOW_PRODUCTION=true')
  }

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
