import { PrismaClient } from '@prisma/client'

if (!process.env.DATABASE_URL) {
  throw new Error('Set DATABASE_URL in the environment before running this script')
}

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
})

async function seed() {
  // Seed only non-sensitive system defaults. Never create known-password accounts.
  await prisma.systemSetting.upsert({
    where: { key: 'registration_open' },
    update: {},
    create: { key: 'registration_open', value: 'true', type: 'string' },
  })
  console.log('System defaults seeded; no user accounts were created.')
}

seed()
  .catch((err) => {
    console.error('Seed error:', err)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
