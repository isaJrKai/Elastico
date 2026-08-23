// Cycle 4.6 Step 1: Fix truthClass REAL → DERIVED for aggregated team xG
process.env.DATABASE_URL = 'postgresql://neondb_owner:npg_8zPlbIK5NwaR@ep-late-sunset-axydccn7-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require';
process.env.DIRECT_URL = process.env.DATABASE_URL;

var { PrismaClient } = require('@prisma/client');
var prisma = new PrismaClient();

async function main() {
  var result = await prisma.teamAnalytic.updateMany({
    where: { source: 'understat', truthClass: 'REAL' },
    data: { truthClass: 'DERIVED' },
  });
  console.log('Updated', result.count, 'records: REAL → DERIVED');

  // Verify
  var counts = await prisma.teamAnalytic.groupBy({
    by: ['truthClass'],
    _count: true,
  });
  console.log('Distribution:', JSON.stringify(counts));
  await prisma.$disconnect();
}
main().catch(function(e) { console.error(e.message); prisma.$disconnect(); process.exit(1); });
