import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const db = new PrismaClient()

async function main() {
  console.log('Seeding ELASTICO Neon database...')

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

  // Demo users
  const users = [
    { email: 'admin@elastico.ai', password: 'Admin123!', name: 'ELASTICO Admin', displayName: 'Admin', role: 'admin' as const, plan: 'elite' as const },
    { email: 'pro@elastico.ai', password: 'Pro12345!', name: 'Pro Demo', displayName: 'Pro User', role: 'user' as const, plan: 'pro' as const },
    { email: 'demo@elastico.ai', password: 'Demo1234!', name: 'Free User', displayName: 'Demo', role: 'user' as const, plan: 'free' as const },
  ]

  for (const u of users) {
    const hash = await bcrypt.hash(u.password, 10)
    await db.user.upsert({
      where: { email: u.email },
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
