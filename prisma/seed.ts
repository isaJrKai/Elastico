import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to run the development seed in production.')
  }

  // Seed only non-sensitive application defaults. Do not create a predictable
  // administrator account or ship known demo passwords in source control.
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

  console.log('Development seed complete (system defaults only).')
}

main()
  .catch((error) => {
    console.error('[seed] Failed:', error)
    process.exitCode = 1
  })
  .finally(() => db.$disconnect())
