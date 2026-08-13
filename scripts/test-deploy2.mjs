import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage();
const logs = [];
page.on('console', msg => { if (msg.type() === 'error' || msg.type() === 'warning') logs.push(`[${msg.type()}] ${msg.text()}`); });
page.on('pageerror', err => logs.push('PAGE_ERROR: ' + err.message + ' | ' + err.stack?.split('\n').slice(0,3).join(' | ')));

try {
  await page.goto('https://elastico-elastico.vercel.app', { waitUntil: 'networkidle', timeout: 30000 });
  
  // Click the "Free" demo button (last in the 4-column grid)
  const buttons = await page.$$('button');
  for (const btn of buttons) {
    const text = await btn.innerText();
    if (text.includes('Free')) {
      console.log('Clicking button:', text.trim());
      await btn.click();
      break;
    }
  }
  
  await new Promise(r => setTimeout(r, 10000));
  
  console.log('URL:', page.url());
  console.log('TITLE:', await page.title());
  console.log('ERRORS:', JSON.stringify(logs.slice(0, 20), null, 2));
  const bodyText = await page.innerText('body');
  console.log('BODY:', bodyText.slice(0, 1200));
} catch(e) {
  console.log('ERR:', e.message);
  console.log('ERRORS:', JSON.stringify(logs.slice(0, 20), null, 2));
}
await browser.close();
