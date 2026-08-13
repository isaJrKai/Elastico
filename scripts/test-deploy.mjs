import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage();
const logs = [];
page.on('console', msg => { if (msg.type() === 'error') logs.push(msg.text()); });
page.on('pageerror', err => logs.push('PAGE_ERROR: ' + err.message));

try {
  await page.goto('https://elastico-elastico.vercel.app', { waitUntil: 'networkidle', timeout: 30000 });
  
  // Try clicking demo login
  const demoBtn = await page.$('button:has-text("Click to Enter")');
  if (demoBtn) {
    await demoBtn.click();
    await new Promise(r => setTimeout(r, 8000));
  }
  
  console.log('URL:', page.url());
  console.log('TITLE:', await page.title());
  console.log('ERRORS:', JSON.stringify(logs.slice(0, 15), null, 2));
  const bodyText = await page.innerText('body');
  console.log('BODY:', bodyText.slice(0, 1000));
} catch(e) {
  console.log('ERR:', e.message);
  console.log('ERRORS:', JSON.stringify(logs.slice(0, 15), null, 2));
}
await browser.close();
