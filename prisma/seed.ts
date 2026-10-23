import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const db = new PrismaClient()

async function main() {
  // This script contains demo-only setup. Never allow it to run against production.
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to run the demo seed in production. Use controlled production migrations instead.')
  }

  console.log('Seeding ELASTICO non-production database...')

  // System settings
  // System settings
  await db.systemSetting.upsert({
    where: { key: 'registration_open' },
    update: { value: 'true' },
    create: { key: 'registration_open', value: 'true', type: 'string' },
  })
  await db.systemSetting.upsert({
    where: { key: 'site_name' },
    update: {},
    creat  // Demo accounts are opt-in and require operator-supplied credentials.
  // Never ship known default passwords, even for local demo accounts.
  if (process.env.SEED_DEMO_USERS === 'true') {
    const users = [
      {
        email: process.env.SEED_ADMIN_EMAIL,
        password: process.env.SEED_ADMIN_PASSWORD,
        name: 'ELASTICO Admin',
        displayName: 'Admin',
        role: 'admin' as const,
        plan: 'elite' as const,
      },
      {
        email: process.env.SEED_PRO_EMAIL,
        password: process.env.SEED_PRO_PASSWORD,
        name: 'Pro Demo',
        displayName: 'Pro User',
        role: 'user' as const,
        plan: 'pro' as const,
      },
      {
        email: process.env.SEED_DEMO_EMAIL,
        password: process.env.SEED_DEMO_PASSWORD,
        name: 'Free User',
        displayName: 'Demo',
        role: 'user' as const,
        plan: 'free' as const,
      },
    ]

    for (const u of users) {
      if (!u.email || !u.password || u.password.length < 20) {
        throw new Error('Opt-in demo seeding requires all SEED_*_EMAIL and SEED_*_PASSWORD values; passwords must be at least 20 characters.')
      }
      const hash = await bcrypt.hash(u.password, 12)
      await db.user.upsert({
        where: { email: u.email },
        update: { name: u.name, displayName: u.displayName, role: u.role, plan: u.plan },
        create: { email: u.email, passwordHash: hash, name: u.name, displayName: u.displayName, role: u.role, plan: u.plan },
      })
      console.log(`  User: ${u.email} (${u.plan})`)
    }
  } else {
    console.log('  Demo users skipped. Set SEED_DEMO_USERS=true with strong SEED_* credentials to opt in.')
  }
email },
      update: { name: u.name, displayName: u.displayName, role: u.role, plan: u.plan },
      create: { email: u.email, passwordHash: hash, name: u.name, displayName: u.displayName, role: u.role, plan: u.plan },
    })
    console.log(`  User: ${u.email} (${u.plan})`)
  }

  console.log('\nSeed complete!')
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect())
