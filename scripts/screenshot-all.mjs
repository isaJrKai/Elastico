import { chromium } from 'playwright';
import { spawn } from 'child_process';
import http from 'http';

const PAGES = [
  { name: 'dashboard', url: 'http://localhost:3000/' },
  { name: 'matches', url: 'http://localhost:3000/matches' },
  { name: 'live-matches', url: 'http://localhost:3000/matches?filter=live' },
  { name: 'tactical', url: 'http://localhost:3000/tactical' },
  { name: 'players', url: 'http://localhost:3000/players' },
  { name: 'compare', url: 'http://localhost:3000/compare' },
  { name: 'standings', url: 'http://localhost:3000/standings' },
  { name: 'predictions', url: 'http://localhost:3000/predictions' },
  { name: 'prediction-engine', url: 'http://localhost:3000/prediction-engine' },
  { name: 'leaderboard', url: 'http://localhost:3000/leaderboard' },
  { name: 'news', url: 'http://localhost:3000/news' },
  { name: 'ai-chat', url: 'http://localhost:3000/chat' },
  { name: 'export', url: 'http://localhost:3000/export' },
  { name: 'settings', url: 'http://localhost:3000/settings' },
  { name: 'login', url: 'http://localhost:3000/login' },
  { name: 'admin', url: 'http://localhost:3000/admin' },
];

const OUT = '/home/z/my-project/download';

function waitForServer(port, maxMs = 30000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      http.get(`http://localhost:${port}/`, (res) => {
        resolve(true);
      }).on('error', () => {
        if (Date.now() - start > maxMs) {
          reject(new Error('Server did not start in time'));
        } else {
          setTimeout(check, 500);
        }
      });
    };
    check();
  });
}

async function main() {
  // Start Next.js server
  console.log('Starting Next.js server...');
  const server = spawn('npx', ['next', 'start', '-p', '3000'], {
    cwd: '/home/z/my-project',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, NODE_ENV: 'production', PORT: '3000' }
  });

  // Log server output
  server.stdout.on('data', (d) => console.log('[server]', d.toString().trim()));
  server.stderr.on('data', (d) => console.log('[server:err]', d.toString().trim()));

  try {
    await waitForServer(3000);
    console.log('Server is ready!');
  } catch (e) {
    // Try dev server as fallback
    console.log('Production server failed, trying dev...');
    server.kill();
    const devServer = spawn('npx', ['next', 'dev', '-p', '3000'], {
      cwd: '/home/z/my-project',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, PORT: '3000' }
    });
    devServer.stdout.on('data', (d) => console.log('[dev]', d.toString().trim()));
    devServer.stderr.on('data', (d) => console.log('[dev:err]', d.toString().trim()));
    await waitForServer(3000, 60000);
    console.log('Dev server ready!');
    // Replace server ref for cleanup
    server.kill = () => devServer.kill();
  }

  // Extra wait for hydration
  await new Promise(r => setTimeout(r, 2000));

  // Launch browser
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--window-size=1440,900']
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1.5,
  });

  const results = [];

  for (const page of PAGES) {
    console.log(`\nCapturing: ${page.name} (${page.url})`);
    try {
      const p = await context.newPage();
      
      // Navigate and wait for network idle
      await p.goto(page.url, { 
        waitUntil: 'networkidle', 
        timeout: 15000 
      }).catch(() => {});

      // Extra wait for any JS rendering
      await new Promise(r => setTimeout(r, 1500));

      const filePath = `${OUT}/elastico-${page.name}.png`;
      await p.screenshot({ 
        path: filePath, 
        fullPage: true,
        timeout: 10000
      });

      const fs = await import('fs');
      const stats = fs.statSync(filePath);
      console.log(`  OK: ${(stats.size / 1024).toFixed(1)} KB -> ${filePath}`);
      results.push({ name: page.name, size: stats.size, ok: true });

      await p.close();
    } catch (err) {
      console.log(`  FAILED: ${err.message}`);
      results.push({ name: page.name, error: err.message, ok: false });
    }
  }

  await browser.close();
  console.log('\n=== RESULTS ===');
  for (const r of results) {
    console.log(`  ${r.ok ? 'OK' : 'FAIL'}  ${r.name}  ${r.ok ? (r.size/1024).toFixed(1)+'KB' : r.error}`);
  }

  // Cleanup
  try { server.kill('SIGTERM'); } catch(e) {}
}

main().catch(e => { console.error(e); process.exit(1); });
