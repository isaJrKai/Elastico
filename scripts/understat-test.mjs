import fs from 'fs';
const envLines = fs.readFileSync('.env', 'utf-8').split('\n');
for (const line of envLines) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2];
}
import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();

const startTime = Date.now();
const results = { teamsRequested: 0, teamsResolved: 0, teamsUnresolved: 0, errors: [], elapsedMs: 0 };

async function main() {
  console.log('=== CONTROLLED UNDERSTAT SYNC TEST ===');
  console.log('Target: PL (Premier League), Season 2024');
  console.log('');

  // Step 1: Fetch Understat teams
  console.log('Step 1: Fetching Understat PL teams...');
  const LEAGUE_SLUG = 'EPL';
  const url = 'https://understat.com/getLeagueData/' + LEAGUE_SLUG + '/2024';
  
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://understat.com/',
        'X-Requested-With': 'XMLHttpRequest',
        'Accept': 'application/json',
      },
    });
    
    if (!res.ok) {
      console.log('  FAILED: HTTP ' + res.status);
      results.errors.push('Understat HTTP ' + res.status);
      return;
    }
    
    const data = await res.json();
    const teams = data.teams || {};
    const teamList = Object.entries(teams).map(([id, t]) => ({
      id: parseInt(id),
      title: t.title || '',
      short_title: t.short_title || '',
      team_name: t.team_name || t.title || '',
    }));
    
    results.teamsRequested = teamList.length;
    console.log('  Got ' + teamList.length + ' teams:');
    for (const t of teamList) {
      console.log('    id=' + t.id + ' name="' + t.title + '" short="' + t.short_title + '"');
    }
    
    // Step 2: Test entity resolution against DB teams
    console.log('');
    console.log('Step 2: Entity Resolution...');
    const dbTeams = await db.team.findMany({
      where: { leagueCode: 'PL' },
      orderBy: { name: 'asc' },
    });
    console.log('  DB has ' + dbTeams.length + ' PL teams:');
    for (const t of dbTeams.slice(0, 5)) {
      console.log('    ' + t.name + ' (source=' + t.source + ', id=' + t.sourceId + ')');
    }
    if (dbTeams.length > 5) console.log('    ... and ' + (dbTeams.length - 5) + ' more');
    
    // Manual resolution test (first 3 teams)
    console.log('');
    console.log('Step 3: Resolving first 3 Understat teams...');
    const testTeams = teamList.slice(0, 3);
    
    for (const ut of testTeams) {
      const name = ut.team_name || ut.title;
      // Try exact match first
      const exact = dbTeams.find(t => t.name.toLowerCase() === name.toLowerCase());
      if (exact) {
        results.teamsResolved++;
        console.log('  RESOLVED (EXACT): "' + name + '" → "' + exact.name + '" (' + exact.source + ')');
      } else {
        // Try contains
        const fuzzy = dbTeams.find(t => 
          t.name.toLowerCase().includes(name.toLowerCase().split(' ')[0]) ||
          name.toLowerCase().includes(t.name.toLowerCase().split(' ')[0])
        );
        if (fuzzy) {
          results.teamsResolved++;
          console.log('  RESOLVED (FUZZY): "' + name + '" → "' + fuzzy.name + '" (' + fuzzy.source + ')');
        } else {
          results.teamsUnresolved++;
          console.log('  UNRESOLVED: "' + name + '" (id=' + ut.id + ')');
        }
      }
    }
    
    // Step 4: Try fetching match-level xG for one team
    console.log('');
    console.log('Step 4: Fetching team match data for first team (id=' + testTeams[0].id + ')...');
    const teamUrl = 'https://understat.com/getTeamData/' + testTeams[0].id + '/2024';
    const teamRes = await fetch(teamUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://understat.com/',
        'X-Requested-With': 'XMLHttpRequest',
        'Accept': 'application/json',
      },
    });
    
    if (teamRes.ok) {
      const teamData = await teamRes.json();
      const dates = teamData.dates || {};
      let totalMatches = 0;
      let matchWithXg = 0;
      let matchWithoutXg = 0;
      
      for (const [dateStr, matches] of Object.entries(dates)) {
        if (Array.isArray(matches)) {
          for (const m of matches) {
            totalMatches++;
            const hxg = parseFloat(m.h?.xG) || 0;
            const axg = parseFloat(m.a?.xG) || 0;
            if (hxg > 0 || axg > 0) matchWithXg++;
            else matchWithoutXg++;
          }
        }
      }
      
      console.log('  Total matches: ' + totalMatches);
      console.log('  Matches with xG: ' + matchWithXg);
      console.log('  Matches without xG: ' + matchWithoutXg);
      
      // Show first match xG data
      const firstDate = Object.entries(dates)[0];
      if (firstDate) {
        const firstMatches = firstDate[1];
        if (Array.isArray(firstMatches) && firstMatches.length > 0) {
          const m = firstMatches[0];
          console.log('  Sample match: ' + (m.h?.title || '?') + ' vs ' + (m.a?.title || '?'));
          console.log('    Score: ' + (m.h?.goals || 0) + ' - ' + (m.a?.goals || 0));
          console.log('    xG: ' + (m.h?.xG || 'N/A') + ' - ' + (m.a?.xG || 'N/A'));
        }
      }
    } else {
      console.log('  FAILED: HTTP ' + teamRes.status);
      results.errors.push('getTeamData HTTP ' + teamRes.status);
    }
    
    // Step 5: Check canonical team state
    console.log('');
    console.log('Step 5: Canonical Team State...');
    const canonicalCount = await db.canonicalTeam.count();
    const identityCount = await db.sourceIdentity.count();
    console.log('  CanonicalTeams: ' + canonicalCount);
    console.log('  SourceIdentities: ' + identityCount);
    
  } catch (err) {
    console.error('ERROR:', err.message);
    results.errors.push(err.message);
  }
  
  results.elapsedMs = Date.now() - startTime;
  console.log('');
  console.log('=== RESULTS ===');
  console.log(JSON.stringify(results, null, 2));
}

main().finally(() => db.$disconnect());
