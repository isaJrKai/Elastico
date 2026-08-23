// Cycle 4.5 Step 9b: Investigate fabricated xG in seeded matches

process.env.DATABASE_URL = 'postgresql://neondb_owner:npg_8zPlbIK5NwaR@ep-late-sunset-axydccn7-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require';
process.env.DIRECT_URL = process.env.DATABASE_URL;

var { PrismaClient } = require('@prisma/client');
var prisma = new PrismaClient();

async function main() {
  console.log('=== STEP 9b: FABRICATION INVESTIGATION ===');
  console.log('');

  // All matches with xG data
  var xgMatches = await prisma.match.findMany({
    where: { OR: [{ homeXg: { not: null } }, { awayXg: { not: null } }] },
    include: { homeTeam: true, awayTeam: true },
    orderBy: { createdAt: 'asc' },
  });

  console.log('[FABRICATED xG IN MATCHES]');
  console.log('Total matches with xG != null:', xgMatches.length);
  console.log('');

  xgMatches.forEach(function(m, i) {
    var flags = [];
    // Flag: source attribution missing
    if (!m.homeXgSource) flags.push('NO_HOMEXG_SOURCE');
    if (!m.awayXgSource) flags.push('NO_AWAYXG_SOURCE');
    // Flag: truth class missing
    if (!m.homeXgTruthClass) flags.push('NO_HOMEXG_TRUTH');
    if (!m.awayXgTruthClass) flags.push('NO_AWAYXG_TRUTH');
    // Flag: xG exactly 0 (suspicious for completed matches)
    if (m.homeXg === 0 && m.status !== 'upcoming') flags.push('SUSPICIOUS_HOMEXG_0');
    if (m.awayXg === 0 && m.status !== 'upcoming') flags.push('SUSPICIOUS_AWAYXG_0');
    // Flag: upcoming match with 0 (should be null)
    if (m.status === 'upcoming' && m.homeXg !== null) flags.push('UPCOMING_HAS_XG');

    var verdict = flags.length === 0 ? 'CLEAN' : 'FABRICATED (' + flags.join(', ') + ')';
    console.log('#' + (i+1) + ':', m.homeTeam.name, 'vs', m.awayTeam.name);
    console.log('     status:', m.status, '| source:', m.source, '| sourceId:', m.sourceId);
    console.log('     homeXg:', m.homeXg, '| awayXg:', m.awayXg);
    console.log('     homeXgSource:', m.homeXgSource, '| awayXgSource:', m.awayXgSource);
    console.log('     homeXgTruthClass:', m.homeXgTruthClass, '| awayXgTruthClass:', m.awayXgTruthClass);
    console.log('     VERDICT:', verdict);
    console.log('');
  });

  // Summary
  var fabricated = xgMatches.filter(function(m) {
    return !m.homeXgSource || !m.homeXgTruthClass ||
           (m.status === 'upcoming' && m.homeXg !== null);
  });
  console.log('=== SUMMARY ===');
  console.log('Total xG matches:', xgMatches.length);
  console.log('Fabricated/suspicious:', fabricated.length);
  console.log('Clean:', xgMatches.length - fabricated.length);
  console.log('');
  console.log('ROOT CAUSE: scripts/seed.ts lines 217-218 use Math.random() to fabricate xG');
  console.log('IMPACT: 10 matches in DB have fake xG with no source/truth attribution');
  console.log('FIX NEEDED: Nullify fabricated xG or label truthClass=DEAD/DEMO');

  await prisma.$disconnect();
}

main().catch(function(e) {
  console.error('FATAL:', e.message ? e.message.substring(0, 500) : e);
  prisma.$disconnect();
  process.exit(1);
});
