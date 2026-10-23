import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const db = new PrismaClient()

async function main() {
  // Guard before any database mutation, not halfway through seeding.
  if (process.env.NODE_ENV === 'production' && process.env.ELASTICO_SEED_ALLOW_PRODUCTION !== 'true') {
    throw new Error('Refusing to seed production without ELASTICO_SEED_ALLOW_PRODUCTION=true')
  }

  console.log('Seeding ELASTICO database...')

  // System settings
  await db.systemSetting.upsert({
    where: { key: 'registration_open' },
    update: { value: 'true' },
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

  const adminPassword = process.env.ELASTICO_SEED_ADMIN_PASSWORD
  if (adminPassword) {
    if (adminPassword.length < 16) {
      throw new Error('ELASTICO_SEED_ADMIN_PASSWORD must be at least 16 characters')
    }
    const passwordHash = await bcrypt.hash(adminPassword, 12)
    await db.user.upsert({
      where: { email: 'admin@elastico.ai' },
      update: {
        name: 'ELASTICO Admin',
        displayName: 'Admin',
        role: 'admin',
        plan: 'elite',
        passwordHash,
        provider: 'email',
      },
      create: {
        email: 'admin@elastico.ai',
        passwordHash,
        name: 'ELASTICO Admin',
        displayName: 'Admin',
        role: 'admin',
        plan: 'elite',
        provider: 'email',
      },
    })
    console.log('  Administrator seeded using ELASTICO_SEED_ADMIN_PASSWORD')
  } else {
    console.log('  Administrator seed skipped; set ELASTICO_SEED_ADMIN_PASSWORD explicitly if needed')
  }

  // Public demo accounts are non-admin, reserved, and intentionally have no password login.
  const demoUsers = [
    { email: 'user@elastico.ai', name: 'Free Demo', displayName: 'Free Demo', plan: 'free' },
    { email: 'pro@elastico.ai', name: 'Pro Demo', displayName: 'Pro Demo', plan: 'pro' },
    { email: 'elite@elastico.ai', name: 'Elite Demo', displayName: 'Elite Demo', plan: 'elite' },
  ] as const

  for (const demo of demoUsers) {
    await db.user.upsert({
      where: { email: demo.email },
      update: {
        name: demo.name,
        displayName: demo.displayName,
        role: 'user',
        plan: demo.plan,
        provider: 'demo',
        passwordHash: null,
      },
      create: {
        email: demo.email,
        name: demo.name,
        displayName: demo.displayName,
        role: 'user',
        plan: demo.plan,
        provider: 'demo',
        passwordHash: null,
      },
    })
    console.log(`  Demo user: ${demo.email} (${demo.plan})`)
  }

  console.log('\nSeed complete!')
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect())
