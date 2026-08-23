const BASE = 'https://understat.com';
var HEADERS = {
  'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  'Accept': '*/*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': 'https://understat.com/league/EPL/2023',
};
function sleep(ms) { return new Promise(function(r) { setTimeout(r, ms); }); }

async function main() {
  // Try PL 2023 teams first
  console.log('Fetching PL 2023 teams...');
  var res = await fetch(BASE + '/getLeagueData/EPL/2023', { headers: HEADERS });
  var data = await res.json();
  var teamIds = Object.keys(data.teams).map(function(k) { return parseInt(k); });
  console.log('Teams:', teamIds.length);

  // Try ONE team with 5s delay
  await sleep(5000);
  var testId = teamIds[0];
  console.log('Trying team', testId, 'after 5s delay...');
  var tRes = await fetch(BASE + '/getTeamData/' + testId + '/2023', { headers: HEADERS });
  console.log('Status:', tRes.status);
  if (tRes.ok) {
    var tData = await tRes.json();
    console.log('Has dates:', !!tData.dates);
  }

  // Try a known match ID from PL 2024
  await sleep(5000);
  console.log('Trying match 55555...');
  var mRes = await fetch(BASE + '/getMatchData/55555', { headers: HEADERS });
  console.log('Status:', mRes.status);

  // Try the old approach - scraping the league page directly
  await sleep(5000);
  console.log('Trying direct page scrape...');
  try {
    var pageRes = await fetch(BASE + '/league/EPL/2023', {
      headers: { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36' },
    });
    console.log('Page status:', pageRes.status);
    if (pageRes.ok) {
      var html = await pageRes.text();
      // Look for JSON data embedded in page
      var jsonMatch = html.match(/var teamsData\s*=\s*JSON\.parse\('([^']+)'\)/);
      if (jsonMatch) {
        console.log('Found teamsData in page!');
      } else {
        // Check for script tags with data
        var scriptMatch = html.match(/"teamsData":\s*"([^"]+)"/);
        if (scriptMatch) {
          console.log('Found teamsData in script! Length:', scriptMatch[1].length);
        } else {
          console.log('No embedded JSON found. Page length:', html.length);
          // Check what's in the page
          if (html.includes('getLeagueData')) console.log('  Page references getLeagueData');
          if (html.includes('React')) console.log('  Page uses React');
          if (html.includes('__NEXT_DATA__')) console.log('  Page uses Next.js');
        }
      }
    }
  } catch (e) {
    console.log('Page scrape error:', e.message ? e.message.substring(0, 100) : e);
  }

  console.log('');
  console.log('=== DONE ===');
}
main();
