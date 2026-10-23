// Fix: Nullify fabricated xG from seed script
if (!process.env.DATABASE_URL) throw new Error('Set DATABASE_URL in the environment before running this script');
process.env.DIRECT_URL = process.env.DATABASE_URL;

var { PrismaClient } = require('@prisma/client');
var prisma = new PrismaClient();

async function main() {
  // Nullify all xG from matches that lack source attribution
  var result = await prisma.match.updateMany({
    where: {
      AND: [
        { homeXgSource: null },
        { homeXgTruthClass: null },
      ],
    },
    data: {
      homeXg: null,
      awayXg: null,
    },
  });
  console.log('Nullified xG in', result.count, 'matches');

  // Verify
  var remaining = await prisma.match.count({
    where: { OR: [{ homeXg: { not: null } }, { awayXg: { not: null } }] },
  });
  console.log('Matches with xG remaining:', remaining);
  await prisma.$disconnect();
}

main().catch(function(e) {
  console.error('FATAL:', e.message ? e.message.substring(0, 500) : e);
  prisma.$disconnect();
  process.exit(1);
});
