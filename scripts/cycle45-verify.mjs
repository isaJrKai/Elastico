/**
 * Cycle 4.5 Verification Script
 * Runs all DB integrity, sync, and data verification checks.
 * Output: structured JSON to stdout.
 */

import fs from 'fs';
import { PrismaClient } from '@prisma/client';

// Load .env manually to avoid shell env override issues
const envLines = fs.readFileSync('.env', 'utf-8').split('\n');
for (const line of envLines) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2];
}

const db = new PrismaClient();
const results = {};

// ═══ 1. DATABASE INTEGRITY ═══
async function checkDbIntegrity() {
  console.log('\n=== DATABASE INTEGRITY ===');
  
  // CanonicalTeam duplicates
  const allCanonical = await db.canonicalTeam.findMany({
    include: { identities: true, analytics: true }
  });
  results.canonicalTeams = allCanonical.length;
  results.canonicalIdentities = allCanonical.reduce((s, c) => s + c.identities.length, 0);
  results.canonicalAnalytics = allCanonical.reduce((s, c) => s + c.analytics.length, 0);
  
  // Check for duplicate displayName+leagueCode (should be 0 due to unique constraint)
  const nameGroups = {};
  for (const c of allCanonical) {
    const key = `${c.displayName}|${c.leagueCode}`;
    nameGroups[key] = (nameGroups[key] || 0) + 1;
  }
  const dupCanonical = Object.entries(nameGroups).filter(([, v]) => v > 1);
  results.duplicateCanonicalTeams = dupCanonical.length;
  if (dupCanonical.length > 0) {
    console.log('  ⚠ DUPLICATE CanonicalTeams:', dupCanonical);
  }
  
  // SourceIdentity duplicates
  const allIdentities = await db.sourceIdentity.findMany();
  const idGroups = {};
  for (const i of allIdentities) {
    const key = `${i.source}|${i.externalId}`;
    idGroups[key] = (idGroups[key] || 0) + 1;
  }
  const dupIdentities = Object.entries(idGroups).filter(([, v]) => v > 1);
  results.duplicateSourceIdentities = dupIdentities.length;
  results.totalSourceIdentities = allIdentities.length;
  if (dupIdentities.length > 0) {
    console.log('  ⚠ DUPLICATE SourceIdentities:', dupIdentities);
  }
  
  // Identity by source breakdown
  const bySource = {};
  for (const i of allIdentities) {
    bySource[i.source] = (bySource[i.source] || 0) + 1;
  }
  results.identitiesBySource = bySource;
  
  // Match duplicates
  const allMatches = await db.match.groupBy({
    by: ['source', 'sourceId'],
    _count: true,
    having: { sourceId: { _count: { gt: 1 } } },
  });
  results.duplicateMatches = allMatches.length;
  results.totalMatches = await db.match.count();
  results.totalTeams = await db.team.count();
  results.totalPlayers = await db.player.count();
  results.totalStandings = await db.standingEntry.count();
  results.totalOdds = await db.oddsSnapshot.count();
  results.totalNews = await db.newsArticle.count();
  results.totalSyncLogs = await db.syncLog.count();
  
  // Team duplicates by source+sourceId
  const dupTeams = await db.team.groupBy({
    by: ['source', 'sourceId'],
    _count: true,
    having: { sourceId: { _count: { gt: 1 } } },
  });
  results.duplicateTeams = dupTeams.length;
  
  console.log(`  CanonicalTeams: ${results.canonicalTeams}`);
  console.log(`  SourceIdentities: ${results.totalSourceIdentities} (${JSON.stringify(bySource)})`);
  console.log(`  Teams: ${results.totalTeams}, Matches: ${results.totalMatches}`);
  console.log(`  Players: ${results.totalPlayers}, Standings: ${results.totalStandings}`);
  console.log(`  Odds: ${results.totalOdds}, News: ${results.totalNews}`);
  console.log(`  SyncLogs: ${results.totalSyncLogs}`);
  console.log(`  Duplicate CanonicalTeams: ${results.duplicateCanonicalTeams}`);
  console.log(`  Duplicate SourceIdentities: ${results.duplicateSourceIdentities}`);
  console.log(`  Duplicate Matches: ${results.duplicateMatches}`);
  console.log(`  Duplicate Teams: ${results.duplicateTeams}`);
}

// ═══ 2. TEAM ANALYTICS (xG) VERIFICATION ═══
async function checkTeamAnalytics() {
  console.log('\n=== TEAM ANALYTICS (xG) VERIFICATION ===');
  
  const analytics = await db.teamAnalytic.findMany({
    orderBy: { syncedAt: 'desc' },
    take: 50,
  });
  
  results.totalTeamAnalytics = await db.teamAnalytic.count();
  results.analyticsBySource = {};
  results.analyticsByTruthClass = {};
  
  const allAnalytics = await db.teamAnalytic.findMany();
  for (const a of allAnalytics) {
    results.analyticsBySource[a.source] = (results.analyticsBySource[a.source] || 0) + 1;
    results.analyticsByTruthClass[a.truthClass] = (results.analyticsByTruthClass[a.truthClass] || 0) + 1;
  }
  
  // Understat-specific analytics
  const understatAnalytics = await db.teamAnalytic.findMany({
    where: { source: 'understat' },
    include: { team: true, canonicalTeam: true },
    orderBy: { syncedAt: 'desc' },
  });
  
  results.understatAnalytics = understatAnalytics.length;
  results.understatSamples = understatAnalytics.slice(0, 5).map(a => ({
    teamName: a.team?.name || a.sourceTeamName,
    teamId: a.teamId,
    canonicalTeamId: a.canonicalTeamId,
    sourceTeamId: a.sourceTeamId,
    sourceTeamName: a.sourceTeamName,
    season: a.season,
    leagueCode: a.leagueCode,
    xgPerGame: a.xgPerGame,
    xgaPerGame: a.xgaPerGame,
    npxGPerGame: a.npxGPerGame,
    truthClass: a.truthClass,
    dataFreshness: a.dataFreshness,
    syncedAt: a.syncedAt?.toISOString(),
  }));
  
  console.log(`  Total TeamAnalytics: ${results.totalTeamAnalytics}`);
  console.log(`  By Source: ${JSON.stringify(results.analyticsBySource)}`);
  console.log(`  By TruthClass: ${JSON.stringify(results.analyticsByTruthClass)}`);
  console.log(`  Understat analytics: ${results.understatAnalytics}`);
  for (const s of results.understatSamples) {
    console.log(`    ${s.teamName}: xG/g=${s.xgPerGame}, xGA/g=${s.xgaPerGame}, truth=${s.truthClass}, fresh=${s.dataFreshness}`);
  }
}

// ═══ 3. MATCH xG VERIFICATION ═══
async function checkMatchXg() {
  console.log('\n=== MATCH xG VERIFICATION ===');
  
  const matchesWithXg = await db.match.findMany({
    where: { OR: [{ homeXg: { not: null } }, { awayXg: { not: null } }] },
    include: { homeTeam: true, awayTeam: true },
    orderBy: { date: 'desc' },
    take: 10,
  });
  
  results.matchesWithXg = matchesWithXg.length;
  results.matchXgSamples = matchesWithXg.map(m => ({
    id: m.id,
    homeTeam: m.homeTeam?.name,
    awayTeam: m.awayTeam?.name,
    homeXg: m.homeXg,
    awayXg: m.awayXg,
    homeXgSource: m.homeXgSource,
    awayXgSource: m.awayXgSource,
    homeXgTruthClass: m.homeXgTruthClass,
    awayXgTruthClass: m.awayXgTruthClass,
    date: m.date?.toISOString(),
  }));
  
  console.log(`  Matches with xG: ${results.matchesWithXg}`);
  for (const s of results.matchXgSamples) {
    console.log(`    ${s.homeTeam} vs ${s.awayTeam}: hXg=${s.homeXg}(${s.homeXgTruthClass}), aXg=${s.awayXg}(${s.awayXgTruthClass})`);
  }
  
  if (matchesWithXg.length === 0) {
    console.log('  ⚠ NO matches have xG data persisted. Match-level xG: MISSING');
  }
}

// ═══ 4. FRESHNESS VERIFICATION ═══
async function checkFreshness() {
  console.log('\n=== FRESHNESS VERIFICATION ===');
  
  const analytics = await db.teamAnalytic.findMany({
    where: { source: 'understat' },
    orderBy: { syncedAt: 'desc' },
  });
  
  results.freshnessBreakdown = {};
  const now = Date.now();
  
  for (const a of analytics) {
    const age = (now - a.syncedAt.getTime()) / (1000 * 60 * 60);
    var expected;
    if (age < 24) expected = 'FRESH';
    else if (age < 168) expected = 'CURRENT';
    else if (age < 2160) expected = 'SEASON';
    else expected = 'STALE';
    
    const match = a.dataFreshness === expected;
    results.freshnessBreakdown[a.dataFreshness || 'NULL'] = (results.freshnessBreakdown[a.dataFreshness || 'NULL'] || 0) + 1;
    if (!match) {
      console.log(`  ⚠ MISMATCH: ${a.sourceTeamName} labeled ${a.dataFreshness}, expected ${expected} (${age.toFixed(1)}h old)`);
    }
  }
  
  console.log(`  Freshness distribution: ${JSON.stringify(results.freshnessBreakdown)}`);
  if (analytics.length > 0) {
    const newest = analytics[0];
    const ageHours = (now - newest.syncedAt.getTime()) / (1000 * 60 * 60);
    console.log(`  Most recent: ${newest.sourceTeamName}, ${ageHours.toFixed(1)}h ago, labeled ${newest.dataFreshness}`);
  }
}

// ═══ 5. SYNC LOG VERIFICATION ═══
async function checkSyncLogs() {
  console.log('\n=== SYNC LOGS ===');
  
  const logs = await db.syncLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10,
  });
  
  results.recentSyncLogs = logs.map(l => ({
    source: l.source,
    action: l.action,
    status: l.status,
    processed: l.recordsProcessed,
    created: l.recordsCreated,
    updated: l.recordsUpdated,
    error: l.errorMessage,
    durationMs: l.durationMs,
    createdAt: l.createdAt?.toISOString(),
  }));
  
  console.log(`  Recent sync logs (${logs.length}):`);
  for (const l of results.recentSyncLogs) {
    const status = l.status === 'success' ? '✓' : '✗';
    console.log(`    ${status} ${l.source}/${l.action}: ${l.status}, processed=${l.processed}, created=${l.created}, updated=${l.updated}, ${l.durationMs}ms`);
    if (l.error) console.log(`      ERROR: ${l.error}`);
  }
}

// ═══ MAIN ═══
async function main() {
  try {
    await checkDbIntegrity();
    await checkTeamAnalytics();
    await checkMatchXg();
    await checkFreshness();
    await checkSyncLogs();
    
    console.log('\n=== FULL RESULTS JSON ===');
    console.log(JSON.stringify(results, null, 2));
  } catch (err) {
    console.error('Verification failed:', err);
    process.exit(1);
  } finally {
    await db.$disconnect();
  }
}

main();
