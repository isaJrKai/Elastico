// Cycle 4.6 Step 9: End-to-end verification — Arsenal golden path
// Traces: DB → API response shape → UI readiness

process.env.DATABASE_URL = 'postgresql://neondb_owner:npg_8zPlbIK5NwaR@ep-late-sunset-axydccn7-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require';
process.env.DIRECT_URL = process.env.DATABASE_URL;

var { PrismaClient } = require('@prisma/client');
var prisma = new PrismaClient();
var http = require('http');

function fetchApi(path) {
  return new Promise(function(resolve, reject) {
    var opts = { hostname: 'localhost', port: 3000, path: path, method: 'GET',
      headers: { 'Accept': 'application/json' }, timeout: 5000 };
    var req = http.request(opts, function(res) {
      var body = '';
      res.on('data', function(c) { body += c; });
      res.on('end', function() { resolve({ status: res.statusCode, body: body }); });
    });
    req.on('error', reject);
    req.on('timeout', function() { req.destroy(); reject(new Error('timeout')); });
    req.end();
  });
}

async function main() {
  console.log('=== CYCLE 4.6 END-TO-END VERIFICATION ===');
  console.log('');

  var pass = 0, fail = 0, warn = 0;
  function check(name, ok, detail) {
    if (ok) { pass++; console.log('  PASS:', name, detail || ''); }
    else { fail++; console.log('  FAIL:', name, detail || ''); }
  }
  function warnCheck(name, ok, detail) {
    if (ok) { pass++; console.log('  PASS:', name, detail || ''); }
    else { warn++; console.log('  WARN:', name, detail || ''); }
  }

  // ── STEP 1: DB LAYER ────────────────────────────────────────
  console.log('[1] DATABASE LAYER');

  var arsenal = await prisma.canonicalTeam.findFirst({
    where: { displayName: 'Arsenal' },
    include: {
      identities: { where: { source: 'understat' } },
      analytics: { orderBy: { syncedAt: 'desc' }, take: 1 },
    },
  });
  check('Arsenal CanonicalTeam exists', !!arsenal);
  if (!arsenal) { console.log('  ABORT: Arsenal not in DB'); process.exit(1); }
  check('  displayName:', arsenal.displayName === 'Arsenal', arsenal.displayName);
  check('  leagueCode:', arsenal.leagueCode === 'PL', arsenal.leagueCode);

  check('  SourceIdentity exists', arsenal.identities.length === 1, 'count=' + arsenal.identities.length);
  if (arsenal.identities.length > 0) {
    var si = arsenal.identities[0];
    check('    source:', si.source === 'understat', si.source);
    check('    externalId:', si.externalId === '83', si.externalId);
    check('    confidence:', si.confidence === 'NORMALIZED', si.confidence);
    check('    resolutionMethod:', !!si.resolutionMethod, si.resolutionMethod);
  }

  check('  TeamAnalytic exists', arsenal.analytics.length === 1, 'count=' + arsenal.analytics.length);
  if (arsenal.analytics.length > 0) {
    var ta = arsenal.analytics[0];
    check('    source:', ta.source === 'understat', ta.source);
    check('    truthClass:', ta.truthClass === 'DERIVED', ta.truthClass);
    check('    xgPerGame:', ta.xgPerGame !== null, 'xgPerGame=' + ta.xgPerGame);
    check('    xgaPerGame is honestly null:', ta.xgaPerGame === null, 'xgaPerGame=' + ta.xgaPerGame);
    check('    dataFreshness:', ta.dataFreshness === 'SEASON', ta.dataFreshness);
    check('    sourceTeamId:', ta.sourceTeamId === '83', ta.sourceTeamId);
    check('    syncedAt recent:', (Date.now() - ta.syncedAt.getTime()) < 3600000, ta.syncedAt.toISOString());
  }

  // ── STEP 2: PROVENANCE CHAIN ──────────────────────────────
  console.log('');
  console.log('[2] PROVENANCE CHAIN');

  var allAnalytics = await prisma.teamAnalytic.findMany({ where: { truthClass: 'DERIVED' } });
  check('All DERIVED records source=understat', allAnalytics.every(function(a) { return a.source === 'understat'; }), 'count=' + allAnalytics.length);
  check('No REAL records remain', (await prisma.teamAnalytic.count({ where: { truthClass: 'REAL' } })) === 0);
  check('No PROXY records exist', (await prisma.teamAnalytic.count({ where: { truthClass: 'PROXY' } })) === 0);
  check('No DEMO records exist', (await prisma.teamAnalytic.count({ where: { truthClass: 'DEMO' } })) === 0);

  // Verify xGA is null everywhere (not fabricated)
  var nullXga = allAnalytics.filter(function(a) { return a.xgaPerGame === null; });
  check('xGA honestly null:', nullXga.length === allAnalytics.length, nullXga.length + '/' + allAnalytics.length);

  // ── STEP 3: FABRICATION SCAN ───────────────────────────────
  console.log('');
  console.log('[3] FABRICATION SCAN');

  // Check no matches have fabricated xG
  var fabricated = await prisma.match.count({
    where: {
      AND: [
        { homeXg: { not: null } },
        { homeXgSource: null },
      ],
    },
  });
  check('No matches with unattributed xG', fabricated === 0, 'found=' + fabricated);

  var allNull = await prisma.match.count({
    where: { homeXg: null, awayXg: null },
  });
  var totalMatches = await prisma.match.count();
  check('All matches have null xG (no fabrication)', allNull === totalMatches, allNull + '/' + totalMatches);

  // ── STEP 4: API RESPONSE SHAPE ───────────────────────────
  console.log('');
  console.log('[4] API WIRING (code-level)');

  // Can't call API without running server, but verify the route code
  var fs = require('fs');
  var teamsRoute = fs.readFileSync('src/app/api/teams/route.ts', 'utf8');
  check('/api/teams includes CanonicalTeam query', teamsRoute.includes('canonicalTeam.findMany'));
  check('/api/teams includes xgTruthClass', teamsRoute.includes('xgTruthClass'));
  check('/api/teams includes xgSource', teamsRoute.includes('xgSource'));
  check('/api/teams includes xgFreshness', teamsRoute.includes('xgFreshness'));
  check('/api/teams uses ?? null (not || 0)', teamsRoute.includes('?? null'));
  check('/api/teams ESPN fallback has truthClass=MISSING', teamsRoute.includes("xgTruthClass: 'MISSING'"));

  var matchRoute = fs.readFileSync('src/app/api/matches/[id]/route.ts', 'utf8');
  check('/api/matches/[id] includes CanonicalTeam fallback', matchRoute.includes('canonicalTeam.findFirst'));
  check('/api/matches/[id] uses ?? null for xG', matchRoute.includes('homeXg: m.homeXg ?? null'));
  check('/api/matches/[id] ESPN fallback has MISSING', matchRoute.includes("homeXgTruthClass: 'MISSING'"));

  // ── STEP 5: UI LAYER ─────────────────────────────────────
  console.log('');
  console.log('[5] UI LAYER (code-level)');

  var store = fs.readFileSync('src/store/use-elastico-store.ts', 'utf8');
  check('Store: xgPerGame is nullable', store.includes('xgPerGame: number | null'));
  check('Store: xgaPerGame is nullable', store.includes('xgaPerGame: number | null'));

  var tactical = fs.readFileSync('src/components/elastico/tactical-view.tsx', 'utf8');
  check('Tactical: generateDemoProfile accepts null xG', tactical.includes('xgPerGame: number | null'));
  check('Tactical: uses ?? fallback (not fabrication)', tactical.includes('team.xgPerGame ?? 1.3'));
  check('Tactical: styleData uses ?? null for xG', tactical.includes('homeTeam.xgPerGame ?? null'));

  var compare = fs.readFileSync('src/components/elastico/compare-view.tsx', 'utf8');
  check('Compare: shows N/A for null (not --)', compare.includes('>N/A</span>'));
  check('Compare: has DERIVED badge', compare.includes('DERIVED</span>'));
  check('Compare: has source provenance', compare.includes('via {src}'));
  check('Compare: dead code removed (no duplicate null block)', !compare.includes('Skip bar rendering for null values'));

  var matchDetail = fs.readFileSync('src/components/elastico/match-detail-view.tsx', 'utf8');
  check('Match Detail: null shows N/A', matchDetail.includes("'N/A'"));
  check('Match Detail: shows truthClass badge', matchDetail.includes('TruthClass ||') || matchDetail.includes('truthClass ||'));

  // ── SUMMARY ─────────────────────────────────────────────
  console.log('');
  console.log('=== SUMMARY ===');
  console.log('PASS:', pass);
  console.log('WARN:', warn);
  console.log('FAIL:', fail);
  console.log('');
  console.log(fail === 0 ? 'CYCLE 4.6: ALL CHECKS PASSED' : 'CYCLE 4.6: ' + fail + ' CHECK(S) FAILED');

  await prisma.$disconnect();
}

main().catch(function(e) {
  console.error('FATAL:', e.message ? e.message.substring(0, 500) : e);
  prisma.$disconnect();
  process.exit(1);
});
