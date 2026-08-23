// Cycle 4.5 Step 2b: Get full PL team list, then try team-xg for 2 teams

const BASE = 'https://understat.com';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Referer': 'https://understat.com/',
  'X-Requested-With': 'XMLHttpRequest',
  'Accept': 'application/json, text/javascript, */*; q=0.01',
};

function sleep(ms) { return new Promise(function(r) { setTimeout(r, ms); }); }

async function main() {
  console.log('=== STEP 2b: FULL PL TEAM LIST + TEAM XG TEST ===');
  console.log('');

  // Get all PL 2024 teams
  const res = await fetch(BASE + '/getLeagueData/EPL/2024', { headers: HEADERS });
  const data = await res.json();
  const teams = [];
  for (var idStr in data.teams) {
    var t = data.teams[idStr];
    teams.push({ id: parseInt(idStr), title: t.title, short_title: t.short_title });
  }
  teams.sort(function(a, b) { return a.id - b.id; });

  console.log('[ALL PL 2024 TEAMS - ' + teams.length + ']');
  teams.forEach(function(t) {
    console.log('  ' + t.id + ' | ' + t.title + ' | ' + (t.short_title || 'N/A'));
  });

  // Try team data for first 3 teams with delays
  console.log('');
  console.log('[TESTING TEAM MATCH DATA - 3 teams with 3s delays]');
  for (var i = 0; i < 3 && i < teams.length; i++) {
    var team = teams[i];
    await sleep(3000);
    console.log('  Fetching team', team.id, '(' + team.title + ')...');
    try {
      var tRes = await fetch(BASE + '/getTeamData/' + team.id + '/2024', { headers: HEADERS });
      console.log('    Status:', tRes.status);
      if (tRes.ok) {
        var tData = await tRes.json();
        var matchCount = 0;
        if (tData.dates) {
          Object.values(tData.dates).forEach(function(matches) {
            if (Array.isArray(matches)) matchCount += matches.length;
          });
        }
        console.log('    Matches:', matchCount);

        // Compute xG from matches
        var totalXg = 0, totalXga = 0, played = 0;
        if (tData.dates) {
          Object.values(tData.dates).forEach(function(dateMatches) {
            if (Array.isArray(dateMatches)) {
              dateMatches.forEach(function(m) {
                var isHome = String(m.h && m.h.id) === String(team.id);
                var xg = isHome ? parseFloat(m.h && m.h.xG) : parseFloat(m.a && m.a.xG);
                var xga = isHome ? parseFloat(m.a && m.a.xG) : parseFloat(m.h && m.h.xG);
                if (xg > 0 || xga > 0) {
                  totalXg += (xg || 0);
                  totalXga += (xga || 0);
                  played++;
                }
              });
            }
          });
        }
        if (played > 0) {
          console.log('    xG/game:', (totalXg / played).toFixed(2), '| xGA/game:', (totalXga / played).toFixed(2), '| Matches with xG:', played);
        }
      }
    } catch (e) {
      console.log('    Error:', e.message ? e.message.substring(0, 80) : e);
    }
  }

  console.log('');
  console.log('=== STEP 2b COMPLETE ===');
}

main();
