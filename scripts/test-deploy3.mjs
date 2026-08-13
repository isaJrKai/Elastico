import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage();
const logs = [];
page.on('console', msg => { if (msg.type() === 'error' || msg.type() === 'warning') logs.push(`[${msg.type()}] ${msg.text()}`); });
page.on('pageerror', err => logs.push('PAGE_ERROR: ' + err.message));

try {
  await page.goto('https://elastico-elastico.vercel.app', { waitUntil: 'networkidle', timeout: 30000 });
  
  // Find and click the Free demo button
  const buttons = await page.$$('button');
  for (const btn of buttons) {
    const text = await btn.innerText();
    if (text.includes('Free') && text.includes('free')) {
      await btn.click();
      break;
    }
  }
  
  // Wait for navigation/response
  await new Promise(r => setTimeout(r, 8000));
  
  // If still on login, the demo failed - try direct API
  const currentUrl = page.url();
  console.log('URL after demo click:', currentUrl);
  
  // Try calling the demo API directly
  const apiRes = await page.evaluate(async () => {
    try {
      const r = await fetch('/api/auth/demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'free@elastico.app', role: 'free', password: 'demo1234' })
      });
      return { status: r.status, data: await r.json() };
    } catch(e) { return { error: e.message }; }
  });
  console.log('Demo API response:', JSON.stringify(apiRes, null, 2));
  
  // If we got a token, set it and reload
  if (apiRes.data?.token) {
    await page.evaluate((token) => {
      localStorage.setItem('elastico_token', token);
    }, apiRes.data.token);
    await page.reload({ waitUntil: 'networkidle', timeout: 30000 });
    await new Promise(r => setTimeout(r, 5000));
  }
  
  console.log('FINAL URL:', page.url());
  console.log('FINAL TITLE:', await page.title());
  console.log('ERRORS:', JSON.stringify(logs.slice(0, 20), null, 2));
  const bodyText = await page.innerText('body');
  console.log('BODY (first 1500):', bodyText.slice(0, 1500));
} catch(e) {
  console.log('ERR:', e.message);
  console.log('ERRORS:', JSON.stringify(logs.slice(0, 20), null, 2));
}
await browser.close();
