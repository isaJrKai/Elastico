import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();

async function main() {
  const teamCount = await db.team.count();
  const analyticsCount = await db.teamAnalytic.count();
  const matchCount = await db.match.count();
  const standingCount = await db.standingEntry.count();
  const oddsCount = await db.oddsSnapshot.count();
  const newsCount = await db.newsArticle.count();
 const userCount = await db.user.count();

  console.log('=== NEON DB INVENTORY ===');
  console.log('Teams:', teamCount);
  console.log('TeamAnalytics:', analyticsCount);
  console.log('Matches:', matchCount);
  console.log('StandingEntries:', standingCount);
  console.log('OddsSnapshots:', oddsCount);
  console.log('NewsArticles:', newsCount);
  console.log('Users:', userCount);

  // Team analytics
  if (analyticsCount > 0) {
    const analytics = await db.teamAnalytic.findMany({
      where: { source: 'understat' },
      include: { team: { select: { name: true, leagueCode: true } } },
      take: 10,
    });
    console.log('\n=== UNDERSTAT TEAM ANALYTICS (sample) ===');
    for (const a of analytics) {
      console.log(' ', a.team.name, '(' + a.leagueCode + '): xG/g=' + a.xgPerGame, 'xGA/g=' + a.xgaPerGame, 'ppda=' + a.ppda);
    }
  } else {
    console.log('\nNO UNDERSTAT ANALYTICS IN DATABASE');
  }

  // Team sources
  const sources = await db.team.groupBy({ by: ['source'], _count: true });
  console.log('\nTeams by source:', sources.map(s => s.source + ': ' + s._count));

  // Entity integrity
  const names = await db.team.findMany({ select: { name: true, source: true, sourceId: true, leagueCode: true } });
  const nameCounts = {};
  for (const t of names) {
    const n = t.name.toLowerCase();
    if (!nameCounts[n]) nameCounts[n] = [];
    nameCounts[n].push(t);
  }
  const dupes = Object.entries(nameCounts).filter(([k, v]) => v.length > 1);
  const uniqueNames = new Set(names.map(t => t.name.toLowerCase()));
  console.log('\nEntity integrity: ' + names.length + ' total rows, ' + uniqueNames.size + ' unique names, ' + (names.length - uniqueNames.size) + ' redundant rows');
  if (dupes.length > 0) {
    console.log('DUPLICATES (' + dupes.length + '):');
    for (const [name, entries] of dupes.slice(0, 10)) {
      console.log('  "' + name + '": ' + entries.map(e => e.source + '/' + (e.sourceId || 'no-id') + ' [' + e.leagueCode + ']').join(', '));
    }
  }

  // xG in matches
  const matchesWithXg = await db.match.findMany({
    where: { homeXg: { not: null } },
    include: { homeTeam: { select: { name: true } }, awayTeam: { select: { name: true } } },
  });
  console.log('\nMatches with homeXg set: ' + matchesWithXg.length);
  for (const m of matchesWithXg) {
    console.log('  ' + m.homeTeam.name + ' vs ' + m.awayTeam.name + ': hXg=' + m.homeXg + ' aXg=' + m.awayXg + ' source=' + m.source);
  }

  const matchSources = await db.match.groupBy({ by: ['source'], _count: true });
  console.log('Matches by source:', matchSources.map(s => s.source + ': ' + s._count));

  // Check 'unknown' source teams
  const unknownTeams = names.filter(t => t.source === 'unknown');
  console.log('\nTeams with source=unknown: ' + unknownTeams.length + ' (these are orphaned/demo data)');
  if (unknownTeams.length > 0) {
    console.log('  Sample:', unknownTeams.slice(0, 3).map(t => '"' + t.name + '" [' + t.leagueCode + ']'));
  }

  await db.disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
