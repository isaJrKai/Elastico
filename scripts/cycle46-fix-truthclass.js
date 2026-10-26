// Cycle 4.6 Step 1: Fix truthClass REAL → DERIVED for aggregated team xG
if (!process.env.DATABASE_URL) throw new Error('Set DATABASE_URL in the environment before running this maintenance script.');
if (process.env.ALLOW_MUTATING_MAINTENANCE_SCRIPT !== 'true') throw new Error('Set ALLOW_MUTATING_MAINTENANCE_SCRIPT=true after reviewing the target database.');
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
