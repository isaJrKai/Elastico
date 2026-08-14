import { chromium } from 'playwright';
import { spawn } from 'child_process';
import http from 'http';
import fs from 'fs';

const VIEWS = [
  'dashboard',
  'matches',
  'tactical',
  'players',
  'compare',
  'tournament',
  'predictions',
  'prediction-engine',
  'leaderboard',
  'news',
  'ai-chat',
  'export',
  'settings',
  'admin',
  'notifications',
  'subscription',
  'achievements',
  'system-monitor',
];

const OUT = '/home/z/my-project/download';

function waitForServer(port, maxMs = 45000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      http.get(`http://localhost:${port}/`, (res) => {
        if (res.statusCode === 200) resolve(true);
        else { if (Date.now() - start > maxMs) reject(new Error(`Status ${res.statusCode}`)); else setTimeout(check, 500); }
      }).on('error', () => {
        if (Date.now() - start > maxMs) reject(new Error('Server did not start'));
        else setTimeout(check, 500);
      });
    };
    check();
  });
}

async function main() {
  // Start dev server (production has stale routes)
  console.log('Starting Next.js dev server...');
  const server = spawn('npx', ['next', 'dev', '-p', '3000', '--turbopack'], {
    cwd: '/home/z/my-project',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PORT: '3000', NEXT_TELEMETRY_DISABLED: '1' }
  });

  let serverOutput = '';
  server.stdout.on('data', d => { serverOutput += d.toString(); console.log('[srv]', d.toString().trim()); });
  server.stderr.on('data', d => { serverOutput += d.toString(); });

  await waitForServer(3000);
  console.log('Server ready!');
  // Wait extra for hydration & lazy chunks
  await new Promise(r => setTimeout(r, 3000));

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });

  const page = await context.newPage();

  // Navigate to root
  console.log('\nNavigating to app...');
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle', timeout: 30000 });
  await new Promise(r => setTimeout(r, 2000));

  // Authenticate via store manipulation
  console.log('Authenticating via Zustand store...');
  await page.evaluate(() => {
    // Set localStorage tokens first
    const fakeUser = {
      id: 'demo-001', email: 'demo@elastico.ai', name: 'Demo User',
      displayName: 'Demo User', avatarUrl: null, role: 'admin', plan: 'pro',
      predictionAccuracy: 67.3, predictionStreak: 5, bestStreak: 12,
      totalPredictions: 245, correctPredictions: 165, achievements: JSON.stringify([]),
      favoriteTeams: '', twoFactorEnabled: false, lastLoginAt: new Date().toISOString(), loginCount: 42
    };
    localStorage.setItem('elastico_token', 'demo-screenshot-token');
    localStorage.setItem('elastico_user', JSON.stringify(fakeUser));

    // Directly set Zustand store state
    if (window.__ZUSTAND_DEVTOOLS__) {
      // Zustand devtools available
    }
    // Access store via React hook - use the global window
    // The store is created with create() so we can import it
  });

  // Use a more direct approach: inject script that imports the store
  // Since it's ESM, we need to use dynamic import
  console.log('Setting auth state via dynamic import...');
  await page.evaluate(async () => {
    const mod = await import('/src/store/use-elastico-store.ts');
    const store = mod.useElasticoStore;
    const fakeUser = {
      id: 'demo-001', email: 'demo@elastico.ai', name: 'Demo User',
      displayName: 'Demo User', avatarUrl: null, role: 'admin', plan: 'pro',
      predictionAccuracy: 67.3, predictionStreak: 5, bestStreak: 12,
      totalPredictions: 245, correctPredictions: 165, achievements: '{}',
      favoriteTeams: '', twoFactorEnabled: false, lastLoginAt: new Date().toISOString(), loginCount: 42
    };
    store.getState().setUser(fakeUser, 'demo-screenshot-token');
    return store.getState().isAuthenticated;
  }).catch(e => {
    console.log('Dynamic import failed, trying alternative...');
    return false;
  });

  // Alternative: use the demo login API
  console.log('Trying demo login API...');
  const loginRes = await page.evaluate(async () => {
    const r = await fetch('/api/auth/demo', { method: 'POST' });
    return { status: r.status, body: await r.text().catch(() => '') };
  });
  console.log('Demo login response:', JSON.stringify(loginRes));

  // Check if authenticated now
  let isAuth = await page.evaluate(() => {
    // Try reading from Zustand via React fiber
    const root = document.querySelector('#__next');
    return root ? root.textContent.includes('ELASTICO') : false;
  });
  console.log('Page content check:', isAuth);

  // Check what's actually rendered
  const bodyText = await page.evaluate(() => document.body.innerText.substring(0, 500));
  console.log('Page text:', bodyText);

  // If we see login form, try clicking demo login button
  if (bodyText.includes('Sign In') || bodyText.includes('Login') || bodyText.includes('Email')) {
    console.log('Login page detected, looking for demo button...');
    const demoBtn = await page.$('button:has-text("Demo"), button:has-text("demo"), a:has-text("Demo")');
    if (demoBtn) {
      console.log('Found demo button, clicking...');
      await demoBtn.click();
      await new Promise(r => setTimeout(r, 2000));
    } else {
      // Try email/password login
      const emailInput = await page.$('input[type="email"], input[name="email"]');
      if (emailInput) {
        console.log('Filling login form...');
        await emailInput.fill('demo@elastico.ai');
        const passInput = await page.$('input[type="password"], input[name="password"]');
        if (passInput) await passInput.fill('demo1234');
        const submitBtn = await page.$('button[type="submit"], button:has-text("Sign In"), button:has-text("Login")');
        if (submitBtn) {
          await submitBtn.click();
          await new Promise(r => setTimeout(r, 2000));
        }
      }
    }
  }

  // Wait for potential auth redirect
  await new Promise(r => setTimeout(r, 1500));

  // Now try to set view via Zustand store exposed on window
  // The store might be accessible through __ZUSTAND__ or similar
  // Let's try using page.evaluate with the store module
  
  // Check current state
  const stateCheck = await page.evaluate(() => {
    // Look for any global store references
    const keys = Object.keys(window).filter(k => 
      k.toLowerCase().includes('zustand') || 
      k.toLowerCase().includes('store') ||
      k.toLowerCase().includes('elastico')
    );
    return { keys, hasNext: !!document.querySelector('#__next'), url: window.location.href };
  });
  console.log('Window keys:', JSON.stringify(stateCheck));

  // Navigate views via sidebar clicks instead
  // First, find sidebar navigation items
  console.log('\nLooking for sidebar navigation...');
  const sidebarItems = await page.$$eval('nav a, [role="navigation"] a, aside a, .sidebar a', 
    els => els.map(e => ({ text: e.textContent?.trim(), href: e.href, class: e.className }))
  );
  console.log('Found nav items:', JSON.stringify(sidebarItems.slice(0, 15)));

  // Alternative: use data-view or click handlers
  const allButtons = await page.$$eval('button', 
    els => els.map(e => ({ text: e.textContent?.trim().substring(0, 40), class: e.className })).filter(b => b.text)
  );
  console.log('Found buttons:', JSON.stringify(allButtons.slice(0, 20)));

  // Take screenshot of current state regardless
  await page.screenshot({ path: `${OUT}/elastico-current-state.png`, fullPage: false });
  console.log('\nSaved current state screenshot');

  // Now try to use the Zustand store through React's internal hooks
  // by dispatching a custom event that the store listens to
  console.log('\nAttempting store manipulation via React internals...');
  
  // Try accessing the store through the module system
  const storeResult = await page.evaluate(async () => {
    // Next.js Turbopack exposes modules in a specific way
    // Try to find the store through __next_f or similar
    
    // Method: Use the Zustand store's subscribe pattern
    // The store is created outside React, so it exists as a module-level singleton
    
    // Try importing from the bundled path
    try {
      // Turbopack/webpack chunks may be accessible
      const chunks = Object.keys(window).filter(k => k.startsWith('__webpack') || k.startsWith('__turbopack'));
      
      // Try to find the store in any exposed module system
      if ((window).__NEXT_DATA__) {
        return { method: '__NEXT_DATA__', buildId: (window).__NEXT_DATA__.buildId };
      }
      
      // Check for module cache
      const cacheKeys = Object.keys(window).filter(k => k.includes('cache') || k.includes('module'));
      return { method: 'cache-check', chunks, cacheKeys };
    } catch(e) {
      return { error: e.message };
    }
  });
  console.log('Store access result:', JSON.stringify(storeResult));

  // FINAL APPROACH: Use Playwright to click through the sidebar
  // First make sure we're past login
  const currentText = await page.evaluate(() => document.body.innerText.substring(0, 300));
  console.log('\nCurrent page text:', currentText);

  if (currentText.includes('Sign In') || currentText.includes('Welcome back')) {
    console.log('STILL ON LOGIN - attempting form fill...');
    // Look for any input
    const inputs = await page.$$('input');
    console.log(`Found ${inputs.length} inputs`);
    for (const input of inputs) {
      const type = await input.getAttribute('type');
      const placeholder = await input.getAttribute('placeholder');
      console.log(`  Input: type=${type} placeholder=${placeholder}`);
    }
    
    // Fill and submit
    if (inputs.length >= 2) {
      await inputs[0].fill('demo@elastico.ai');
      await inputs[1].fill('password123');
      const btn = await page.$('button[type="submit"]') || await page.$('button');
      if (btn) { await btn.click(); await new Promise(r => setTimeout(r, 2000)); }
    }
  }

  // Take final state screenshot
  await page.screenshot({ path: `${OUT}/elastico-after-login.png`, fullPage: false });
  const afterLoginText = await page.evaluate(() => document.body.innerText.substring(0, 300));
  console.log('After login text:', afterLoginText);

  // If we're now authenticated, click through sidebar items
  if (!afterLoginText.includes('Sign In') && !afterLoginText.includes('Welcome back')) {
    console.log('\nAUTHENTICATED! Now capturing views...');
    
    // Find sidebar links and click them one by one
    const navLinks = await page.$$('nav a, aside a');
    console.log(`Found ${navLinks.length} nav links`);
    
    for (const link of navLinks) {
      const text = await link.textContent();
      console.log(`  Nav: ${text?.trim()}`);
    }
  }

  await browser.close();
  console.log('\nDone!');
  
  try { server.kill('SIGTERM'); } catch(e) {}
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
