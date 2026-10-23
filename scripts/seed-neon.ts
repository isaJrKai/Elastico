import { PrismaClient } from '@prisma/client'
import { hash } from 'bcryptjs'

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  throw new Error('Set DATABASE_URL in the environment before running this seed script.')
}
if (process.env.NODE_ENV === 'production') {
  throw new Error('Refusing to run this demo seed in production.')
}
if (process.env.SEED_DEMO_USERS !== 'true') {
  throw new Error('Demo seed is disabled. Set SEED_DEMO_USERS=true only in a non-production environment.')
}

const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } })

async function seed() {
  const users = [
    { email: process.env.SEED_ADMIN_EMAIL || 'admin@elastico.ai', password: process.env.SEED_ADMIN_PASSWORD, name: 'ELASTICO Admin', role: 'admin', plan: 'elite' },
    { email: process.env.SEED_PRO_EMAIL || 'pro@elastico.ai', password: process.env.SEED_PRO_PASSWORD, name: 'Pro Demo', role: 'user', plan: 'pro' },
    { email: process.env.SEED_DEMO_EMAIL || 'demo@elastico.ai', password: process.env.SEED_DEMO_PASSWORD, name: 'Free User', role: 'user', plan: 'free' },
  ] as const

  for (const user of users) {
    if (!user.password || user.password.length < 20) {
      throw new Error('All demo accounts require SEED_*_PASSWORD values of at least 20 characters.')
    }
  }

  await prisma.systemSetting.upsert({
    where: { key: 'registration_open' },
    update: { value: 'true' },
    create: { key: 'registration_open', value: 'true' },
  })

  for (const user of users) {
    const passwordHash = await hash(user.password!, 12)
    await prisma.user.upsert({
      where: { email: user.email },
      update: { name: user.name, passwordHash, role: user.role, plan: user.plan },
      create: { email: user.email, name: user.name, passwordHash, role: user.role, plan: user.plan, isActive: true },
    })
    console.log('Seeded demo account: ' + user.email + ' (' + user.plan + ')')
  }
}

seed()
  .catch(async (error) => {
    console.error('Demo seed failed:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
