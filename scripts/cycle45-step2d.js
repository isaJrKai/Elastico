const BASE = 'https://understat.com';
var HEADERS = {
  'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  'Referer': 'https://understat.com/league/EPL/2024',
  'X-Requested-With': 'XMLHttpRequest',
  'Accept': 'application/json, text/javascript, */*; q=0.01',
};
function sleep(ms) { return new Promise(function(r) { setTimeout(r, ms); }); }

async function main() {
  console.log('=== STEP 2d: Alternative Understat approaches ===');
  console.log('');

  // Approach 1: Players POST endpoint (different domain, might not be rate-limited)
  console.log('[1] Trying players POST endpoint...');
  try {
    var res = await fetch(BASE + '/main/getPlayersStats/', {
      method: 'POST',
      headers: {
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
        'Referer': 'https://understat.com/league/EPL/2024',
        'X-Requested-With': 'XMLHttpRequest',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'league=EPL&season=2024',
    });
    console.log('  Status:', res.status);
    if (res.ok) {
      var data = await res.json();
      var players = Array.isArray(data) ? data : (data.players || []);
      console.log('  Players:', players.length);
      if (players.length > 0) {
        // Aggregate xG by team
        var teamXg = {};
        players.forEach(function(p) {
          var team = p.team_title;
          if (!team) return;
          if (!teamXg[team]) teamXg[team] = { totalXg: 0, games: 0, players: 0 };
          teamXg[team].totalXg += parseFloat(p.xG) || 0;
          teamXg[team].games = Math.max(teamXg[team].games, parseInt(p.games) || 0);
          teamXg[team].players++;
        });
        console.log('');
        console.log('[TEAM xG AGGREGATED FROM PLAYER DATA]');
        Object.entries(teamXg).sort(function(a, b) { return b[1].totalXg - a[1].totalXg; }).forEach(function(entry) {
          var t = entry[0], d = entry[1];
          console.log('  ' + t + ': total xG=' + d.totalXg.toFixed(2) + ' | games=' + d.games + ' | players=' + d.players);
        });
      }
    }
  } catch (e) {
    console.log('  Error:', e.message ? e.message.substring(0, 100) : e);
  }

  // Approach 2: Try match data for a recent match
  await sleep(8000);
  console.log('');
  console.log('[2] Trying match endpoint after 8s delay...');
  try {
    var mRes = await fetch(BASE + '/getMatchData/55555', {
      headers: HEADERS,
    });
    console.log('  Status:', mRes.status);
    if (mRes.ok) {
      var mData = await mRes.json();
      console.log('  Has shots:', !!(mData.shots));
      if (mData.tmpl) {
        console.log('  Home:', mData.tmpl.h ? mData.tmpl.h.title : 'N/A');
        console.log('  Away:', mData.tmpl.a ? mData.tmpl.a.title : 'N/A');
        console.log('  Home xG:', mData.tmpl.h ? mData.tmpl.h.xG : 'N/A');
        console.log('  Away xG:', mData.tmpl.a ? mData.tmpl.a.xG : 'N/A');
      }
    }
  } catch (e) {
    console.log('  Error:', e.message ? e.message.substring(0, 100) : e);
  }

  console.log('');
  console.log('=== DONE ===');
}
main();
