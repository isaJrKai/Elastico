import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage();
const logs = [];
page.on('console', msg => { if (msg.type() === 'error') logs.push(msg.text()); });
page.on('pageerror', err => logs.push('PAGE_ERROR: ' + err.message + '\n' + err.stack));

try {
  await page.goto('https://elastico-elastico.vercel.app', { waitUntil: 'networkidle', timeout: 30000 });
  const apiRes = await page.evaluate(async () => {
    const r = await fetch('/api/auth/demo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'free@elastico.app', role: 'free', password: 'demo1234' })
    });
    return await r.json();
  });
  await page.evaluate(({ token, user }) => {
    localStorage.setItem('elastico_token', token);
    localStorage.setItem('elastico_user', JSON.stringify(user));
  }, { token: apiRes.token, user: apiRes.user });
  await page.reload({ waitUntil: 'networkidle', timeout: 30000 });
  await new Promise(r => setTimeout(r, 8000));
  console.log('ERRORS:');
  for (const log of logs) console.log('---\n' + log);
} catch(e) {
  console.log('ERR:', e.message);
  for (const log of logs) console.log('---\n' + log);
}
await browser.close();
