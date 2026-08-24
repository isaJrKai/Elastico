// Cycle 4.5 Step 2: Full Understat Sync → CanonicalTeam + SourceIdentity + TeamAnalytic
// Proves the data truth pipeline works end-to-end with REAL Understat data

process.env.DATABASE_URL = 'postgresql://neondb_owner:npg_8zPlbIK5NwaR@ep-late-sunset-axydccn7-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require';
process.env.DIRECT_URL = process.env.DATABASE_URL;

var { PrismaClient } = require('@prisma/client');
var prisma = new PrismaClient();

var BASE = 'https://understat.com';
var HEADERS = {
  'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  'Referer': 'https://understat.com/league/EPL/2024',
  'X-Requested-With': 'XMLHttpRequest',
  'Accept': 'application/json, text/javascript, */*; q=0.01',
};

function sleep(ms) { return new Promise(function(r) { setTimeout(r, ms); }); }

// Name normalization map: Understat name → canonical ELASTICO name
var NAME_MAP = {
  'Aston Villa': 'Aston Villa',
  'Everton': 'Everton',
  'Bournemouth': 'AFC Bournemouth',
  'Southampton': 'Southampton',
  'Leicester': 'Leicester City',
  'Crystal Palace': 'Crystal Palace',
  'Chelsea': 'Chelsea',
  'West Ham': 'West Ham United',
  'Tottenham': 'Tottenham Hotspur',
  'Arsenal': 'Arsenal',
  'Newcastle United': 'Newcastle United',
  'Liverpool': 'Liverpool',
  'Manchester City': 'Manchester City',
  'Manchester United': 'Manchester United',
  'Brighton': 'Brighton and Hove Albion',
  'Fulham': 'Fulham',
  'Wolverhampton Wanderers': 'Wolverhampton Wanderers',
  'Brentford': 'Brentford',
  'Nottingham Forest': 'Nottingham Forest',
  'Ipswich': 'Ipswich Town',
};

async function main() {
  console.log('=== CYCLE 4.5 STEP 2: UNDERSTAT DATA SYNC ===');
  console.log('Strategy: Fetch PL 2024 teams + player xG → aggregate to team level → write to DB');
  console.log('');

  var startTime = Date.now();
  var stats = { canonicalTeams: 0, sourceIdentities: 0, teamAnalytics: 0, errors: 0 };

  // 1. Fetch league teams (for Understat team IDs)
  console.log('[1/4] Fetching PL 2024 teams from Understat...');
  var teamRes = await fetch(BASE + '/getLeagueData/EPL/2024', { headers: HEADERS });
  var teamData = await teamRes.json();
  var understatTeams = {};
  for (var idStr in teamData.teams) {
    var t = teamData.teams[idStr];
    understatTeams[t.title] = { id: parseInt(idStr), title: t.title };
  }
  console.log('  Got', Object.keys(understatTeams).length, 'teams');

  // 2. Fetch player xG data
  await sleep(2000);
  console.log('[2/4] Fetching PL 2024 player xG data...');
  var playerRes = await fetch(BASE + '/main/getPlayersStats/', {
    method: 'POST',
    headers: {
      'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
      'Referer': 'https://understat.com/league/EPL/2024',
      'X-Requested-With': 'XMLHttpRequest',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'league=EPL&season=2024',
  });
  var playerData = await playerRes.json();
  var players = Array.isArray(playerData) ? playerData : (playerData.players || []);
  console.log('  Got', players.length, 'players');

  // 3. Aggregate player xG by team
  console.log('[3/4] Aggregating player xG to team level...');
  var teamAgg = {};
  players.forEach(function(p) {
    var teamName = p.team_title;
    if (!teamName || teamName.includes(',')) return; // Skip multi-team entries
    if (!teamAgg[teamName]) {
      teamAgg[teamName] = { totalXg: 0, totalNpxG: 0, totalGoals: 0, maxGames: 0, playerCount: 0 };
    }
    teamAgg[teamName].totalXg += parseFloat(p.xG) || 0;
    teamAgg[teamName].totalNpxG += parseFloat(p.npxG) || 0;
    teamAgg[teamName].totalGoals += parseInt(p.goals) || 0;
    teamAgg[teamName].maxGames = Math.max(teamAgg[teamName].maxGames, parseInt(p.games) || 0);
    teamAgg[teamName].playerCount++;
  });

  // 4. Write to DB: CanonicalTeam + SourceIdentity + TeamAnalytic
  console.log('[4/4] Writing to database...');
  var season = '2024';
  var leagueCode = 'PL';

  for (var understatName in teamAgg) {
    var agg = teamAgg[understatName];
    var canonicalName = NAME_MAP[understatName] || understatName;
    var understatId = understatTeams[understatName];

    if (!understatId) {
      console.log('  WARN: No Understat team ID for', understatName, '- skipping');
      stats.errors++;
      continue;
    }

    var games = agg.maxGames;
    if (games === 0) continue;

    var xgPerGame = Math.round((agg.totalXg / games) * 100) / 100;
    var npxGPerGame = Math.round((agg.totalNpxG / games) * 100) / 100;

    // Upsert CanonicalTeam
    var canonical = await prisma.canonicalTeam.upsert({
      where: {
        displayName_leagueCode: { displayName: canonicalName, leagueCode: leagueCode },
      },
      create: {
        displayName: canonicalName,
        shortCode: canonicalName.substring(0, 3).toUpperCase(),
        leagueCode: leagueCode,
        country: 'England',
        primaryColor: '#00e676',
      },
      update: {
        updatedAt: new Date(),
      },
    });
    stats.canonicalTeams++;

    // Create SourceIdentity (Understat → CanonicalTeam)
    var si = await prisma.sourceIdentity.upsert({
      where: {
        source_externalId: { source: 'understat', externalId: String(understatId.id) },
      },
      create: {
        canonicalTeamId: canonical.id,
        source: 'understat',
        externalId: String(understatId.id),
        externalName: understatName,
        leagueCode: leagueCode,
        confidence: 'NORMALIZED',
        resolutionMethod: 'alias: "' + understatName + '" -> "' + canonicalName + '"',
      },
      update: {
        externalName: understatName,
        isActive: true,
        updatedAt: new Date(),
      },
    });
    stats.sourceIdentities++;

    // Create TeamAnalytic with REAL truth class
    var analytic = await prisma.teamAnalytic.upsert({
      where: {
        canonicalTeamId_source_season_leagueCode: {
          canonicalTeamId: canonical.id,
          source: 'understat',
          season: season,
          leagueCode: leagueCode,
        },
      },
      create: {
        canonicalTeamId: canonical.id,
        source: 'understat',
        season: season,
        leagueCode: leagueCode,
        truthClass: 'REAL',
        xgPerGame: xgPerGame,
        // xgaPerGame not available from player aggregation — leave null (not estimated!)
        npxGPerGame: npxGPerGame,
        sourceTeamId: String(understatId.id),
        sourceTeamName: understatName,
        dataFreshness: 'SEASON', // 2024 season data, current date is 2026-08
        syncedAt: new Date(),
      },
      update: {
        truthClass: 'REAL',
        xgPerGame: xgPerGame,
        npxGPerGame: npxGPerGame,
        sourceTeamId: String(understatId.id),
        sourceTeamName: understatName,
        dataFreshness: 'SEASON',
        syncedAt: new Date(),
        updatedAt: new Date(),
      },
    });
    stats.teamAnalytics++;

    console.log('  ' + canonicalName + ' (US id=' + understatId.id + '): xG/game=' + xgPerGame + ' | npxG/game=' + npxGPerGame + ' | games=' + games + ' | players=' + agg.playerCount + ' | truth=REAL');
  }

  // Write sync log
  await prisma.syncLog.create({
    data: {
      source: 'understat',
      action: 'team-analytics-sync',
      status: 'success',
      recordsProcessed: Object.keys(teamAgg).length,
      recordsCreated: stats.teamAnalytics,
      durationMs: Date.now() - startTime,
    },
  });

  console.log('');
  console.log('=== SYNC COMPLETE ===');
  console.log('CanonicalTeams created:', stats.canonicalTeams);
  console.log('SourceIdentities created:', stats.sourceIdentities);
  console.log('TeamAnalytics created:', stats.teamAnalytics);
  console.log('Errors:', stats.errors);
  console.log('Duration:', (Date.now() - startTime) + 'ms');

  // Verify: re-read from DB
  console.log('');
  console.log('[DB VERIFICATION]');
  var dbCanonical = await prisma.canonicalTeam.count();
  var dbSI = await prisma.sourceIdentity.count();
  var dbTA = await prisma.teamAnalytic.count();
  var realCount = await prisma.teamAnalytic.count({ where: { truthClass: 'REAL' } });
  console.log('  CanonicalTeams in DB:', dbCanonical);
  console.log('  SourceIdentities in DB:', dbSI);
  console.log('  TeamAnalytics in DB:', dbTA);
  console.log('  TeamAnalytics with truthClass=REAL:', realCount);

  // Sample one record to show provenance
  var sample = await prisma.teamAnalytic.findFirst({ where: { truthClass: 'REAL' }, include: { canonicalTeam: true } });
  if (sample) {
    console.log('');
    console.log('[SAMPLE RECORD - FULL PROVENANCE CHAIN]');
    console.log('  CanonicalTeam:', sample.canonicalTeam.displayName);
    console.log('  Source:', sample.source);
    console.log('  Season:', sample.season);
    console.log('  League:', sample.leagueCode);
    console.log('  xG/game:', sample.xgPerGame);
    console.log('  npxG/game:', sample.npxGPerGame);
    console.log('  xGA/game:', sample.xgaPerGame, '(null = honestly unavailable from player aggregation)');
    console.log('  truthClass:', sample.truthClass);
    console.log('  dataFreshness:', sample.dataFreshness);
    console.log('  sourceTeamId:', sample.sourceTeamId);
    console.log('  sourceTeamName:', sample.sourceTeamName);
    console.log('  syncedAt:', sample.syncedAt.toISOString());
  }

  await prisma.$disconnect();
}

main().catch(function(e) {
  console.error('FATAL:', e.message ? e.message.substring(0, 500) : e);
  prisma.$disconnect();
  process.exit(1);
});
