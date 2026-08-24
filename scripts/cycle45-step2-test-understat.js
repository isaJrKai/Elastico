// Cycle 4.5 Step 2: Test Understat accessibility + Small sync
// Tests: Can we reach understat.com? Does the new API work?

process.env.DATABASE_URL = 'postgresql://neondb_owner:npg_8zPlbIK5NwaR@ep-late-sunset-axydccn7-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require';
process.env.DIRECT_URL = process.env.DATABASE_URL;

const BASE = 'https://understat.com';

async function testUnderstat() {
  console.log('=== CYCLE 4.5 STEP 2: UNDERSTAT ACCESSIBILITY TEST ===');
  console.log('');

  // Test 1: League teams
  console.log('[TEST 1] Fetching PL 2024 teams...');
  try {
    const res = await fetch(BASE + '/getLeagueData/EPL/2024', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://understat.com/',
        'X-Requested-With': 'XMLHttpRequest',
        'Accept': 'application/json, text/javascript, */*; q=0.01',
      },
    });
    console.log('  Status:', res.status);
    if (res.ok) {
      const data = await res.json();
      const teamCount = data.teams ? Object.keys(data.teams).length : 0;
      console.log('  Teams found:', teamCount);
      if (teamCount > 0) {
        const first3 = Object.entries(data.teams).slice(0, 3);
        first3.forEach(function(entry) {
          console.log('    ID:', entry[0], '| Name:', entry[1].title, '| Short:', entry[1].short_title);
        });
      }
      console.log('  Result: ACCESSIBLE');
    } else {
      console.log('  Result: HTTP ERROR', res.status);
    }
  } catch (e) {
    console.log('  Result: FAILED -', e.message ? e.message.substring(0, 100) : e);
  }

  // Test 2: Team match history (Arsenal = id 228 typically)
  console.log('');
  console.log('[TEST 2] Fetching team matches (id=228, Arsenal PL 2024)...');
  try {
    const res = await fetch(BASE + '/getTeamData/228/2024', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://understat.com/',
        'X-Requested-With': 'XMLHttpRequest',
        'Accept': 'application/json, text/javascript, */*; q=0.01',
      },
    });
    console.log('  Status:', res.status);
    if (res.ok) {
      const data = await res.json();
      let matchCount = 0;
      if (data.dates) {
        Object.values(data.dates).forEach(function(matches) {
          if (Array.isArray(matches)) matchCount += matches.length;
        });
      }
      console.log('  Match count:', matchCount);
      // Show first match xG data
      if (data.dates) {
        const firstDate = Object.entries(data.dates)[0];
        if (firstDate && Array.isArray(firstDate[1]) && firstDate[1].length > 0) {
          const m = firstDate[1][0];
          console.log('  Sample match:', JSON.stringify({
            date: firstDate[0],
            home: m.h ? m.h.title : 'N/A',
            away: m.a ? m.a.title : 'N/A',
            homeXg: m.h ? m.h.xG : 'N/A',
            awayXg: m.a ? m.a.xG : 'N/A',
          }));
        }
      }
      console.log('  Result: ACCESSIBLE');
    } else {
      console.log('  Result: HTTP ERROR', res.status);
    }
  } catch (e) {
    console.log('  Result: FAILED -', e.message ? e.message.substring(0, 100) : e);
  }

  console.log('');
  console.log('=== STEP 2 TEST COMPLETE ===');
}

testUnderstat();
