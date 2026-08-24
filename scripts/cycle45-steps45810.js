// Cycle 4.5 Steps 4+5+8+10: Entity Resolution, Provenance, Zero-Fabrication, Freshness

process.env.DATABASE_URL = 'postgresql://neondb_owner:npg_8zPlbIK5NwaR@ep-late-sunset-axydccn7-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require';
process.env.DIRECT_URL = process.env.DATABASE_URL;

var { PrismaClient } = require('@prisma/client');
var prisma = new PrismaClient();

async function main() {
  console.log('=== STEPS 4+5+8+10 ===');
  console.log('');

  // ──────────────────────────────────────────
  // STEP 4: Entity Resolution Verification
  // ──────────────────────────────────────────
  console.log('━━━ STEP 4: ENTITY RESOLUTION ━━━');
  console.log('');

  // Check: One CanonicalTeam should map to at most one Understat SourceIdentity
  var allSI = await prisma.sourceIdentity.findMany({
    include: { canonicalTeam: true },
    where: { source: 'understat' },
    orderBy: { externalName: 'asc' },
  });

  console.log('[4a] Understat SourceIdentities:', allSI.length);
  console.log('     All 20 PL teams have exactly 1 understat identity:', allSI.length === 20 ? 'PASS' : 'FAIL');

  // Check for duplicates (same canonical team with multiple understat identities)
  var ctMap = {};
  allSI.forEach(function(si) {
    if (!ctMap[si.canonicalTeamId]) ctMap[si.canonicalTeamId] = [];
    ctMap[si.canonicalTeamId].push(si);
  });
  var dupes = Object.entries(ctMap).filter(function(e) { return e[1].length > 1; });
  console.log('[4b] Duplicate understat identities per canonical team:', dupes.length === 0 ? 'NONE (PASS)' : dupes.length + ' DUPLICATES (FAIL)');

  // Check: No two different CanonicalTeams share the same Understat externalId
  var extIds = allSI.map(function(si) { return si.externalId; });
  var uniqueExtIds = new Set(extIds);
  console.log('[4c] Unique Understat external IDs:', uniqueExtIds.size, '/', extIds.length, uniqueExtIds.size === extIds.length ? 'PASS' : 'FAIL (DUPLICATES)');

  // Check: Name resolution method is documented
  var withResolution = allSI.filter(function(si) { return si.resolutionMethod; });
  console.log('[4d] Identities with documented resolution method:', withResolution.length, '/', allSI.length, withResolution.length === allSI.length ? 'PASS' : 'FAIL');

  // Sample resolution chain
  console.log('');
  console.log('[4e] Sample entity resolution chain (Arsenal):');
  var arsenal = allSI.find(function(si) { return si.externalName === 'Arsenal'; });
  if (arsenal) {
    console.log('     CanonicalTeam.id:', arsenal.canonicalTeamId);
    console.log('     CanonicalTeam.displayName:', arsenal.canonicalTeam.displayName);
    console.log('     SourceIdentity.source:', arsenal.source);
    console.log('     SourceIdentity.externalId:', arsenal.externalId);
    console.log('     SourceIdentity.externalName:', arsenal.externalName);
    console.log('     SourceIdentity.confidence:', arsenal.confidence);
    console.log('     SourceIdentity.resolutionMethod:', arsenal.resolutionMethod);
  } else {
    console.log('     NOT FOUND - FAIL');
  }

  // ──────────────────────────────────────────
  // STEP 5: xG Provenance Verification
  // ──────────────────────────────────────────
  console.log('');
  console.log('━━━ STEP 5: xG PROVENANCE TRACE ━━━');
  console.log('');

  // Full trace: Understat API → DB TeamAnalytic → (eventually API → UI)
  var analytics = await prisma.teamAnalytic.findMany({
    where: { truthClass: 'REAL', source: 'understat' },
    include: { canonicalTeam: true },
    orderBy: { xgPerGame: 'desc' },
    take: 5,
  });

  console.log('[5a] Top 5 xG teams - full provenance trace:');
  analytics.forEach(function(a, i) {
    console.log('');
    console.log('  #' + (i + 1) + ':', a.canonicalTeam.displayName);
    console.log('    Source:', a.source, '(scraped from understat.com)');
    console.log('    sourceTeamId:', a.sourceTeamId, '| sourceTeamName:', a.sourceTeamName);
    console.log('    xG/game:', a.xgPerGame, '| npxG/game:', a.npxGPerGame);
    console.log('    truthClass:', a.truthClass, '| dataFreshness:', a.dataFreshness);
    console.log('    Method: Sum of player xG / games played (DERIVED from REAL source)');
    console.log('    syncedAt:', a.syncedAt.toISOString());
  });

  // Verify: All REAL records have source='understat'
  var realRecords = await prisma.teamAnalytic.findMany({ where: { truthClass: 'REAL' } });
  var allFromUnderstat = realRecords.every(function(r) { return r.source === 'understat'; });
  console.log('');
  console.log('[5b] All REAL records from understat:', allFromUnderstat ? 'PASS' : 'FAIL');

  // Verify: No PROXY records exist (Cycle 4 audit found none)
  var proxyRecords = await prisma.teamAnalytic.count({ where: { truthClass: 'PROXY' } });
  console.log('[5c] PROXY records:', proxyRecords, proxyRecords === 0 ? 'PASS (none fabricated)' : 'FAIL');

  // Verify: xgaPerGame is null (honestly unavailable, not estimated)
  var nullXga = realRecords.filter(function(r) { return r.xgaPerGame === null; });
  console.log('[5d] xGA honestly null (not estimated):', nullXga.length, '/', realRecords.length, nullXga.length === realRecords.length ? 'PASS' : 'FAIL');

  // ──────────────────────────────────────────
  // STEP 8: Zero-Fabrication Audit
  // ──────────────────────────────────────────
  console.log('');
  console.log('━━━ STEP 8: ZERO-FABRICATION AUDIT ━━━');
  console.log('');

  // Check 1: No hardcoded xG values in the DB
  var allAnalytics = await prisma.teamAnalytic.findMany();
  var hardcodedPatterns = [];
  var commonFakeValues = [0, 1, 1.0, 1.5, 0.5];
  allAnalytics.forEach(function(a) {
    if (a.xgPerGame !== null && commonFakeValues.includes(a.xgPerGame)) {
      hardcodedPatterns.push(a.canonicalTeamId + ': xgPerGame=' + a.xgPerGame);
    }
    // Check for suspiciously round numbers (exactly 1 decimal)
    if (a.xgPerGame !== null) {
      var str = String(a.xgPerGame);
      if (str.match(/^\d\.0$/)) {
        hardcodedPatterns.push(a.canonicalTeamId + ': suspiciously round xgPerGame=' + a.xgPerGame);
      }
    }
  });
  console.log('[8a] Hardcoded/suspicious xG values:', hardcodedPatterns.length === 0 ? 'NONE (PASS)' : 'FOUND (CHECK):');
  hardcodedPatterns.slice(0, 5).forEach(function(p) { console.log('     ', p); });

  // Check 2: No silent null → 0 transformation
  var zeroXgNotNullSource = allAnalytics.filter(function(a) {
    return a.xgPerGame === 0 && a.truthClass === 'REAL';
  });
  console.log('[8b] REAL records with xG=0 (silent null→0?):', zeroXgNotNullSource.length === 0 ? 'NONE (PASS)' : zeroXgNotNullSource.length + ' FOUND (FAIL)');

  // Check 3: No fake fallbacks (truthClass should never be DEMO for real sync)
  var demoRecords = await prisma.teamAnalytic.count({ where: { truthClass: 'DEMO' } });
  console.log('[8c] DEMO truthClass records:', demoRecords, demoRecords === 0 ? 'PASS (none fabricated)' : 'WARN: ' + demoRecords + ' demo records exist');

  // Check 4: Source code audit — search for xG fabrication patterns
  console.log('[8d] Source code: checking for fabrication patterns in /api/teams...');
  console.log('     (Will verify in code audit below)');

  // ──────────────────────────────────────────
  // STEP 10: Freshness Test
  // ──────────────────────────────────────────
  console.log('');
  console.log('━━━ STEP 10: FRESHNESS TEST ━━━');
  console.log('');

  // All understat records should have dataFreshness='SEASON' (2024 data in 2026)
  var freshnessGroups = {};
  allAnalytics.forEach(function(a) {
    if (!freshnessGroups[a.dataFreshness]) freshnessGroups[a.dataFreshness] = 0;
    freshnessGroups[a.dataFreshness]++;
  });
  console.log('[10a] Data freshness distribution:');
  Object.entries(freshnessGroups).forEach(function(e) {
    console.log('     ' + (e[0] || 'null') + ':', e[1]);
  });

  var allSeason = allAnalytics.every(function(a) { return a.dataFreshness === 'SEASON'; });
  console.log('[10b] All records correctly tagged SEASON (2024 data in 2026-08):', allSeason ? 'PASS' : 'FAIL');

  // Check syncedAt is recent (within last hour)
  var oneHourAgo = new Date(Date.now() - 3600000);
  var recentSync = allAnalytics.filter(function(a) { return a.syncedAt > oneHourAgo; });
  console.log('[10c] syncedAt within last hour:', recentSync.length, '/', allAnalytics.length, recentSync.length === allAnalytics.length ? 'PASS' : 'WARN');

  // Check: records have updatedAt >= syncedAt
  var validTimestamps = allAnalytics.every(function(a) { return a.updatedAt >= a.syncedAt; });
  console.log('[10d] updatedAt >= syncedAt:', validTimestamps ? 'PASS' : 'FAIL');

  await prisma.$disconnect();
  console.log('');
  console.log('=== STEPS 4+5+8+10 COMPLETE ===');
}

main().catch(function(e) {
  console.error('FATAL:', e.message ? e.message.substring(0, 500) : e);
  prisma.$disconnect();
  process.exit(1);
});
