// Cycle 4.5 Step 1+3: Environment + DB Inspection
process.env.DATABASE_URL = 'postgresql://neondb_owner:npg_8zPlbIK5NwaR@ep-late-sunset-axydccn7-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require';
process.env.DIRECT_URL = process.env.DATABASE_URL;

const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  console.log('=== CYCLE 4.5 STEP 1+3: ENVIRONMENT + DB INSPECTION ===');
  console.log('');

  // DB connectivity via Prisma raw query
  const sql = 'SELECT current_database() as db, now() as ts, version() as ver';
  const dbResult = await p.$queryRawUnsafe(sql);
  console.log('[DB CONNECTIVITY]');
  console.log('  Database:', JSON.stringify(dbResult[0].db));
  console.log('  Server time:', dbResult[0].ts);
  console.log('  Version:', dbResult[0].ver ? dbResult[0].ver.substring(0, 60) : 'N/A');

  // Table counts
  const ct = await p.canonicalTeam.count();
  const si = await p.sourceIdentity.count();
  const ta = await p.teamAnalytic.count();
  const tm = await p.team.count();
  const ma = await p.match.count();
  const sl = await p.syncLog.count();

  console.log('');
  console.log('[DB TABLE COUNTS]');
  console.log('  CanonicalTeams:', ct, ct === 0 ? '<<< EMPTY' : '');
  console.log('  SourceIdentities:', si, si === 0 ? '<<< EMPTY' : '');
  console.log('  TeamAnalytics:', ta, ta === 0 ? '<<< EMPTY' : '');
  console.log('  Teams:', tm);
  console.log('  Matches:', ma);
  console.log('  SyncLogs:', sl);

  // Team sources
  if (tm > 0) {
    const sources = await p.team.groupBy({ by: ['source'], _count: true });
    console.log('');
    console.log('[TEAM SOURCES]');
    sources.forEach(function(s) { console.log('  ' + s.source + ':', s._count); });
  }

  // Match sources
  if (ma > 0) {
    const matchSources = await p.match.groupBy({ by: ['source'], _count: true });
    console.log('');
    console.log('[MATCH SOURCES]');
    matchSources.forEach(function(s) { console.log('  ' + s.source + ':', s._count); });

    // xG data check
    const xgMatches = await p.match.count({
      where: { OR: [{ homeXg: { not: null } }, { awayXg: { not: null } }] },
    });
    console.log('');
    console.log('[XG DATA IN MATCHES]');
    console.log('  Matches with any xG:', xgMatches, '/', ma);
    console.log('  Matches without xG:', ma - xgMatches);
  }

  // Sync logs
  const syncLogs = await p.syncLog.findMany({ orderBy: { createdAt: 'desc' }, take: 5 });
  console.log('');
  console.log('[RECENT SYNC LOGS]');
  syncLogs.forEach(function(s) {
    console.log('  ' + s.source + '|' + s.action + '|' + s.status + ' | records: ' + s.recordsProcessed + ' | ' + (s.createdAt ? s.createdAt.toISOString().substring(0, 19) : 'N/A'));
  });

  // Env check
  console.log('');
  console.log('[ENVIRONMENT KEYS]');
  var keys = ['DATABASE_URL', 'DIRECT_URL', 'JWT_SECRET', 'API_SPORTS_KEY', 'FOOTBALL_DATA_API_KEY', 'THE_ODDS_API_KEY'];
  keys.forEach(function(k) {
    var val = process.env[k];
    console.log('  ' + k + ':', val && val.length > 0 ? 'CONFIGURED' : 'NOT CONFIGURED');
  });
  console.log('  UNDERSTAT: NO KEY REQUIRED (scraped)');

  await p.$disconnect();
  console.log('');
  console.log('=== STEP 1+3 COMPLETE ===');
}

main().catch(function(e) {
  console.error('ERROR:', e.message ? e.message.substring(0, 500) : e);
  p.$disconnect();
  process.exit(1);
});
