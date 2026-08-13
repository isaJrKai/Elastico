import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage();

// Intercept React error to get details
await page.addInitScript(() => {
  const origError = console.error;
  console.error = function(...args) {
    origError.apply(console, args);
    // Store in window for retrieval
    if (!window.__reactErrors) window.__reactErrors = [];
    window.__reactErrors.push(args.map(a => typeof a === 'string' ? a : a?.message || String(a)).join(' '));
  };
  
  // Override React's error rendering
  window.__reactErrorInfo = null;
  const origCreateElement = document.createElement.bind(document);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
    ...(window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__,
    onCommitFiberRoot: function() {},
  };
});

const logs = [];
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
  
  // Get any stored React errors
  const reactErrors = await page.evaluate(() => (window as any).__reactErrors || []);
  console.log('React Errors:', JSON.stringify(reactErrors.slice(0, 5), null, 2));
  console.log('Page Errors:', JSON.stringify(logs.slice(0, 5), null, 2));
  console.log('Title:', await page.title());
  
  // Try to get error details from the page
  const bodyHtml = await page.content();
  const errorMatch = bodyHtml.match(/error[^<]{0,200}/gi);
  if (errorMatch) console.log('Error matches:', errorMatch.slice(0, 5));
  
} catch(e) {
  console.log('ERR:', e.message);
  }
await browser.close();
