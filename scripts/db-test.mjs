import fs from 'fs';
import { PrismaClient } from '@prisma/client';

// Read .env manually and set DATABASE_URL explicitly
const envLines = fs.readFileSync('.env', 'utf-8').split('\n');
for (const line of envLines) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && m[1] === 'DATABASE_URL') {
    process.env.DATABASE_URL = m[2];
  }
  if (m && m[1] === 'DIRECT_URL') {
    process.env.DIRECT_URL = m[2];
  }
}

const db = new PrismaClient();
try {
  const count = await db.team.count();
  console.log('DB CONNECTED, team count:', count);
} catch(e) {
  console.error('DB FAILED:', e.message);
} finally {
  await db.$disconnect();
}
