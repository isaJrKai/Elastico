import { PrismaClient } from '@prisma/client'
import { hash } from 'bcryptjs'

const DATABASE_URL = 'postgresql://neondb_owner:npg_8zPlbIK5NwaR@ep-late-sunset-axydccn7-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require'

const prisma = new PrismaClient({
  datasources: {
    db: { url: DATABASE_URL },
  },
})

async function seed() {
  console.log('🌱 Seeding ELASTICO Neon database...')

  // 1. Create SystemSetting
  console.log('  → Creating SystemSetting: registration_open')
  await prisma.systemSetting.upsert({
    where: { key: 'registration_open' },
    update: { value: 'true' },
    create: { key: 'registration_open', value: 'true' },
  })

  // 2. Create demo admin user
  console.log('  → Creating admin user: admin@elastico.ai')
  const adminHash = await hash('Admin123!', 10)
  const admin = await prisma.user.upsert({
    where: { email: 'admin@elastico.ai' },
    update: {
      name: 'ELASTICO Admin',
      passwordHash: adminHash,
      role: 'admin',
      plan: 'elite',
    },
    create: {
      email: 'admin@elastico.ai',
      name: 'ELASTICO Admin',
      passwordHash: adminHash,
      role: 'admin',
      plan: 'elite',
      isActive: true,
    },
  })
  console.log(`    ✓ Admin user created: ${admin.id}`)

  // 3. Create demo pro user
  console.log('  → Creating pro user: pro@elastico.ai')
  const proHash = await hash('Pro12345!', 10)
  const pro = await prisma.user.upsert({
    where: { email: 'pro@elastico.ai' },
    update: {
      name: 'Pro Demo',
      passwordHash: proHash,
      role: 'user',
      plan: 'pro',
    },
    create: {
      email: 'pro@elastico.ai',
      name: 'Pro Demo',
      passwordHash: proHash,
      role: 'user',
      plan: 'pro',
      isActive: true,
    },
  })
  console.log(`    ✓ Pro user created: ${pro.id}`)

  // 4. Create demo free user
  console.log('  → Creating free user: demo@elastico.ai')
  const freeHash = await hash('Demo1234!', 10)
  const freeUser = await prisma.user.upsert({
    where: { email: 'demo@elastico.ai' },
    update: {
      name: 'Free User',
      passwordHash: freeHash,
      role: 'user',
      plan: 'free',
    },
    create: {
      email: 'demo@elastico.ai',
      name: 'Free User',
      passwordHash: freeHash,
      role: 'user',
      plan: 'free',
      isActive: true,
    },
  })
  console.log(`    ✓ Free user created: ${freeUser.id}`)

  console.log('\n✅ Seed complete!')
  console.log(`   Admin: admin@elastico.ai / Admin123! (role: admin, plan: elite)`)
  console.log(`   Pro:   pro@elastico.ai / Pro12345! (role: user, plan: pro)`)
  console.log(`   Free:  demo@elastico.ai / Demo1234! (role: user, plan: free)`)

  await prisma.$disconnect()
}

seed().catch(async (err) => {
  console.error('Seed error:', err)
  await prisma.$disconnect()
  process.exit(1)
})
