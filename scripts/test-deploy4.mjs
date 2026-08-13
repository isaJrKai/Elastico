import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage();
const logs = [];
page.on('console', msg => { if (msg.type() === 'error' || msg.type() === 'warning') logs.push(`[${msg.type()}] ${msg.text()}`); });
page.on('pageerror', err => logs.push('PAGE_ERROR: ' + err.message));

try {
  // First get a valid token
  await page.goto('https://elastico-elastico.vercel.app', { waitUntil: 'networkidle', timeout: 30000 });
  const apiRes = await page.evaluate(async () => {
    const r = await fetch('/api/auth/demo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'free@elastico.app', role: 'free', password: 'demo1234' })
    });
    return await r.json();
  });
  
  // Set both token and user in localStorage
  await page.evaluate(({ token, user }) => {
    localStorage.setItem('elastico_token', token);
    localStorage.setItem('elastico_user', JSON.stringify(user));
  }, { token: apiRes.token, user: apiRes.user });
  
  // Now reload - this should trigger session restore
  await page.reload({ waitUntil: 'networkidle', timeout: 30000 });
  await new Promise(r => setTimeout(r, 8000));
  
  console.log('URL:', page.url());
  console.log('TITLE:', await page.title());
  console.log('ERRORS:', JSON.stringify(logs.slice(0, 20), null, 2));
  const bodyText = await page.innerText('body');
  console.log('BODY (first 2000):', bodyText.slice(0, 2000));
} catch(e) {
  console.log('ERR:', e.message);
  console.log('ERRORS:', JSON.stringify(logs.slice(0, 20), null, 2));
}
await browser.close();
