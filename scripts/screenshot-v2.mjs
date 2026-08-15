import { chromium } from 'playwright';
import { spawn } from 'child_process';
import http from 'http';
import fs from 'fs';

const VIEWS = [
  { id: 'dashboard', idx: 1 },
  { id: 'matches', idx: 2 },
  { id: 'tactical', idx: 3 },
  { id: 'players', idx: 4 },
  { id: 'compare', idx: 5 },
  { id: 'tournament', idx: 6 },
  { id: 'predictions', idx: 7 },
  { id: 'prediction-engine', idx: 8 },
  { id: 'leaderboard', idx: 9 },
  { id: 'news', idx: 10 },
  { id: 'ai-chat', idx: 11 },
  { id: 'export', idx: 12 },
  { id: 'settings', idx: 13 },
  { id: 'admin', idx: 14 },
  { id: 'achievements', idx: 15 },
  { id: 'notifications', idx: 16 },
  { id: 'subscription', idx: 17 },
  { id: 'system-monitor', idx: 18 },
];

const OUT = '/home/z/my-project/download';

const FAKE_USER = {
  id: 'd1', email: 'admin@elastico.ai', name: 'Admin User',
  displayName: 'Admin User', avatarUrl: null, role: 'admin', plan: 'pro',
  predictionAccuracy: 72.5, predictionStreak: 8, bestStreak: 15,
  totalPredictions: 312, correctPredictions: 226, achievements: '{}',
  favoriteTeams: '', twoFactorEnabled: false, lastLoginAt: new Date().toISOString(), loginCount: 99
};

const MOCK_MATCHES = [
  { id: 'm1', homeTeamId: 't1', awayTeamId: 't2', competition: 'Premier League', stage: 'Group Stage', group: null, date: '2026-08-14T20:00:00Z', status: 'live', homeScore: 2, awayScore: 1, homeXg: 1.8, awayXg: 0.9, possessionHome: 58, shotsHome: 12, shotsAway: 7, shotsOnTargetHome: 5, shotsOnTargetAway: 3, cornersHome: 6, cornersAway: 3, foulsHome: 9, foulsAway: 11, venue: 'Wembley Stadium', weather: 'Clear', temperature: 22, homeWinProb: 65, drawProb: 22, awayWinProb: 13, homeEloBefore: 1850, awayEloBefore: 1720 },
  { id: 'm2', homeTeamId: 't3', awayTeamId: 't4', competition: 'La Liga', stage: 'Group Stage', group: 'A', date: '2026-08-14T21:00:00Z', status: 'upcoming', homeScore: 0, awayScore: 0, homeXg: 0, awayXg: 0, possessionHome: 0, shotsHome: 0, shotsAway: 0, shotsOnTargetHome: 0, shotsOnTargetAway: 0, cornersHome: 0, cornersAway: 0, foulsHome: 0, foulsAway: 0, venue: 'Bernabeu', weather: null, temperature: null, homeWinProb: 55, drawProb: 25, awayWinProb: 20, homeEloBefore: 1900, awayEloBefore: 1780 },
  { id: 'm3', homeTeamId: 't5', awayTeamId: 't6', competition: 'Serie A', stage: 'Quarter Final', group: null, date: '2026-08-13T19:45:00Z', status: 'completed', homeScore: 3, awayScore: 1, homeXg: 2.1, awayXg: 0.7, possessionHome: 62, shotsHome: 15, shotsAway: 8, shotsOnTargetHome: 7, shotsOnTargetAway: 2, cornersHome: 8, cornersAway: 4, foulsHome: 12, foulsAway: 14, venue: 'San Siro', weather: 'Cloudy', temperature: 24, homeWinProb: 70, drawProb: 18, awayWinProb: 12, homeEloBefore: 1820, awayEloBefore: 1690 },
  { id: 'm4', homeTeamId: 't7', awayTeamId: 't8', competition: 'Bundesliga', stage: 'Semi Final', group: null, date: '2026-08-13T18:30:00Z', status: 'completed', homeScore: 1, awayScore: 1, homeXg: 1.2, awayXg: 1.5, possessionHome: 45, shotsHome: 10, shotsAway: 14, shotsOnTargetHome: 4, shotsOnTargetAway: 6, cornersHome: 5, cornersAway: 7, foulsHome: 13, foulsAway: 10, venue: 'Allianz Arena', weather: 'Rain', temperature: 18, homeWinProb: 40, drawProb: 28, awayWinProb: 32, homeEloBefore: 1790, awayEloBefore: 1810 },
];

const MOCK_TEAMS = [
  { id: 't1', name: 'England', shortName: 'ENG', code: 'eng', logo: null, primaryColor: '#FFFFFF', secondaryColor: '#CF081F', founded: 1863, stadium: 'Wembley', eloRating: 1850, wins: 580, draws: 220, losses: 240, goalsFor: 2180, goalsAgainst: 980, cleanSheets: 340, league: 'UEFA' },
  { id: 't2', name: 'France', shortName: 'FRA', code: 'fra', logo: null, primaryColor: '#002395', secondaryColor: '#ED2939', founded: 1919, stadium: 'Stade de France', eloRating: 1720, wins: 420, draws: 180, losses: 210, goalsFor: 1650, goalsAgainst: 890, cleanSheets: 280, league: 'UEFA' },
  { id: 't3', name: 'Spain', shortName: 'ESP', code: 'esp', logo: null, primaryColor: '#AA151B', secondaryColor: '#F1BF00', founded: 1913, stadium: 'Bernabeu', eloRating: 1900, wins: 630, draws: 190, losses: 170, goalsFor: 2200, goalsAgainst: 900, cleanSheets: 370, league: 'UEFA' },
  { id: 't4', name: 'Germany', shortName: 'GER', code: 'deu', logo: null, primaryColor: '#000000', secondaryColor: '#DD0000', founded: 1900, stadium: 'Olympiastadion', eloRating: 1780, wins: 520, draws: 200, losses: 210, goalsFor: 2000, goalsAgainst: 950, cleanSheets: 310, league: 'UEFA' },
  { id: 't5', name: 'Italy', shortName: 'ITA', code: 'ita', logo: null, primaryColor: '#008C45', secondaryColor: '#CD212A', founded: 1898, stadium: 'San Siro', eloRating: 1820, wins: 470, draws: 230, losses: 180, goalsFor: 1850, goalsAgainst: 870, cleanSheets: 300, league: 'UEFA' },
  { id: 't6', name: 'Brazil', shortName: 'BRA', code: 'bra', logo: null, primaryColor: '#009739', secondaryColor: '#FEDD00', founded: 1914, stadium: 'Maracana', eloRating: 1690, wins: 720, draws: 180, losses: 160, goalsFor: 2600, goalsAgainst: 1000, cleanSheets: 320, league: 'CONMEBOL' },
  { id: 't7', name: 'Argentina', shortName: 'ARG', code: 'arg', logo: null, primaryColor: '#74ACDF', secondaryColor: '#FFFFFF', founded: 1893, stadium: 'Monumental', eloRating: 1790, wins: 610, draws: 200, losses: 170, goalsFor: 2300, goalsAgainst: 950, cleanSheets: 330, league: 'CONMEBOL' },
  { id: 't8', name: 'Portugal', shortName: 'POR', code: 'por', logo: null, primaryColor: '#006600', secondaryColor: '#FF0000', founded: 1914, stadium: 'Estadio da Luz', eloRating: 1810, wins: 450, draws: 160, losses: 180, goalsFor: 1700, goalsAgainst: 800, cleanSheets: 290, league: 'UEFA' },
];

function waitForServer(port, maxMs = 60000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      http.get(`http://localhost:${port}/`, (res) => {
        if (res.statusCode < 500) resolve(true);
        else if (Date.now() - start > maxMs) reject(new Error(`HTTP ${res.statusCode}`));
        else setTimeout(check, 500);
      }).on('error', () => {
        if (Date.now() - start > maxMs) reject(new Error('Timeout'));
        else setTimeout(check, 500);
      });
    };
    check();
  });
}

async function main() {
  console.log('Starting Next.js dev server...');
  const server = spawn('npx', ['next', 'dev', '-p', '3000'], {
    cwd: '/home/z/my-project',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PORT: '3000', NEXT_TELEMETRY_DISABLED: '1' }
  });
  server.stdout.on('data', () => {});
  server.stderr.on('data', () => {});

  await waitForServer(3000);
  console.log('Server ready!');
  await new Promise(r => setTimeout(r, 3000));

  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  const page = await context.newPage();

  // Intercept ALL APIs
  await page.route('**/api/auth/**', async route => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ user: FAKE_USER, token: 'tok' }) });
  });
  await page.route('**/api/matches**', async route => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_MATCHES) });
  });
  await page.route('**/api/teams**', async route => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_TEAMS) });
  });
  await page.route('**/api/players**', async route => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([
      { id: 'p1', name: 'Harry Kane', teamId: 't1', position: 'ST', age: 33, rating: 88, goals: 65, assists: 20, appearances: 90, yellowCards: 8, redCards: 1, marketValue: 15000000, nationality: 'England', imageUrl: null },
      { id: 'p2', name: 'Kylian Mbappe', teamId: 't2', position: 'LW', age: 28, rating: 91, goals: 72, assists: 30, appearances: 85, yellowCards: 5, redCards: 0, marketValue: 180000000, nationality: 'France', imageUrl: null },
      { id: 'p3', name: 'Pedri', teamId: 't3', position: 'CM', age: 24, rating: 87, goals: 18, assists: 35, appearances: 80, yellowCards: 12, redCards: 0, marketValue: 100000000, nationality: 'Spain', imageUrl: null },
    ])});
  });
  for (const ep of ['**/api/news', '**/api/notifications', '**/api/predictions', '**/api/leaderboard', '**/api/bookmarks', '**/api/achievements', '**/api/live**', '**/api/standings']) {
    await page.route(ep, async route => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
  }
  for (const ep of ['**/api/admin/**', '**/api/analytics/**', '**/api/bandwidth**', '**/api/system/**', '**/api/sync**', '**/api/export**', '**/api/odds**', '**/api/chat**', '**/api/setup**']) {
    await page.route(ep, async route => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    });
  }

  // Navigate and login
  console.log('Navigating...');
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle', timeout: 30000 });
  await new Promise(r => setTimeout(r, 2000));

  // Screenshot login
  await page.screenshot({ path: `${OUT}/elastico-login.png` });
  console.log('Login page captured');

  // Click Admin demo button
  await page.locator('text=Admin').first().click();
  await new Promise(r => setTimeout(r, 3000));

  // Verify auth
  const text = await page.evaluate(() => document.body.innerText.substring(0, 300));
  console.log('Page:', text.substring(0, 100));
  if (text.includes('Sign In')) {
    console.log('Auth failed!');
    await browser.close(); server.kill('SIGTERM'); return;
  }
  console.log('Authenticated!');

  // Get sidebar button details with full inner HTML
  const sidebarButtons = await page.evaluate(() => {
    const aside = document.querySelector('aside');
    if (!aside) return 'no aside';
    const btns = aside.querySelectorAll('button');
    return Array.from(btns).map((b, i) => {
      // Get all text content including nested spans
      const allText = b.textContent?.trim() || '';
      // Get tooltip/aria info
      const ariaLabel = b.getAttribute('aria-label') || '';
      const title = b.getAttribute('title') || '';
      // Get span children text
      const spans = Array.from(b.querySelectorAll('span')).map(s => s.textContent?.trim()).filter(Boolean);
      return { idx: i, text: allText.substring(0, 50), ariaLabel, title, spans };
    });
  });
  console.log('Sidebar buttons:', JSON.stringify(sidebarButtons, null, 2));

  // Navigate using sidebar buttons by index
  for (const view of VIEWS) {
    console.log(`\n--- ${view.id} (idx ${view.idx}) ---`);
    try {
      const btn = page.locator('aside button').nth(view.idx);
      await btn.click({ timeout: 3000 });
      await new Promise(r => setTimeout(r, 2500));
      const fp = `${OUT}/elastico-${view.id}.png`;
      await page.screenshot({ path: fp });
      console.log(`  Saved: ${(fs.statSync(fp).size / 1024).toFixed(1)} KB`);
    } catch (e) {
      console.log(`  ERROR: ${e.message}`);
    }
  }

  await browser.close();
  console.log('\n=== ALL DONE ===');
  server.kill('SIGTERM');
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
