// Quick check: business variables for both testchat and config businesses
import { chromium } from '@playwright/test';

const BASE = process.env.E2E_BASE_URL || 'http://localhost:8080';
const BACKEND = 'https://angelo.ngrok.io';
const TESTCHAT_BIZ = 'f63adf8a-3fc4-37f9-853a-626bbffd38c8';
const CONFIG_BIZ = '694b4410-342d-3d8d-bae8-c93a9d53b2fe';
const EMAIL = process.env.E2E_EMAIL;
const PASSWORD = process.env.E2E_PASSWORD;

if (!EMAIL || !PASSWORD) {
  console.error('Set E2E_EMAIL and E2E_PASSWORD before running this script.');
  process.exit(1);
}


(async () => {
  const browser = await chromium.launch({
    headless: false, channel: 'chrome',
    args: ['--no-first-run', '--no-default-browser-check']
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }, ignoreHTTPSErrors: true
  });
  context.setDefaultTimeout(30000);
  const page = await context.newPage();

  // Login
  console.log('=== LOGIN ===');
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  let emailInput = await page.$('input[type="email"]');
  let pwInput = await page.$('input[type="password"]');
  if (!emailInput) {
    const btn = await page.$('text=Sign in') || await page.$('text=Accedi');
    if (btn) { await btn.click(); await page.waitForTimeout(2000); }
    emailInput = await page.$('input[type="email"]') || await page.$('input:not([type="hidden"]):not([type="password"])');
    pwInput = await page.$('input[type="password"]');
  }
  if (emailInput && pwInput) {
    await emailInput.fill(EMAIL);
    await pwInput.fill(PASSWORD);
    const submit = await page.$('button[type="submit"]') || await page.$('button:has-text("Sign in")');
    if (submit) await submit.click();
    await page.waitForTimeout(5000);
  }

  // Capture auth token from any API call
  let capturedToken = '';
  await page.route('**/mrcall/v1/**', async (route) => {
    const h = route.request().headers();
    if (h['auth'] && !capturedToken) capturedToken = h['auth'];
    await route.continue();
  });
  // Wait for the page to settle after login (it redirects to /businesses)
  await page.waitForTimeout(8000);
  // If still no token, navigate explicitly
  if (!capturedToken) {
    await page.goto(`${BASE}/businesses`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(5000);
  }
  await page.unroute('**/mrcall/v1/**');

  if (!capturedToken) {
    console.log('ERROR: No auth token captured');
    await browser.close();
    return;
  }
  console.log('Token captured OK');

  // Check both businesses
  for (const [label, bizId] of [['TESTCHAT (Testmirs)', TESTCHAT_BIZ], ['CONFIG (Mr Brown)', CONFIG_BIZ]]) {
    console.log(`\n=== ${label}: ${bizId} ===`);

    // Try multiple API endpoints to get business info
    for (const path of [
      `/mrcall/v1/mrcall0/crm/business/${bizId}`,
      `/mrcall/v1/mrcall0/business/${bizId}`,
      `/mrcall/v1/mrcall0/crm/businesses/${bizId}`
    ]) {
      const result = await page.evaluate(async (args) => {
        try {
          const resp = await fetch(args.url + args.path, {
            headers: { 'Content-type': 'application/json', 'auth': args.token }
          });
          if (resp.status !== 200) return { path: args.path, status: resp.status };
          const data = await resp.json();
          const vars = data.variables || data.business_variables || {};
          return {
            path: args.path,
            status: resp.status,
            name: data.name || data.business_name || '?',
            owner: data.owner || data.business_owner || '?',
            AGENT_SKILL_INTEGRATIONS: vars.AGENT_SKILL_INTEGRATIONS || '(not set)',
            SKILL_GSHEETS_SPREADSHEET_ID: vars.SKILL_GSHEETS_SPREADSHEET_ID || '(not set)',
            SKILL_GSHEETS_READ_RANGE: vars.SKILL_GSHEETS_READ_RANGE || '(not set)',
            GCLOUD_APP_CLIENT_NAME: vars.GCLOUD_APP_CLIENT_NAME || '(not set)',
            allVarKeys: Object.keys(vars).filter(k => k.includes('SKILL') || k.includes('AGENT') || k.includes('GSHEET')).join(', ')
          };
        } catch(e) { return { path: args.path, error: e.message }; }
      }, { url: BACKEND, path, token: capturedToken });

      if (result.status === 200) {
        console.log(`  Endpoint: ${result.path} -> OK`);
        console.log(`  Name: ${result.name}`);
        console.log(`  Owner: ${result.owner}`);
        console.log(`  AGENT_SKILL_INTEGRATIONS: ${(result.AGENT_SKILL_INTEGRATIONS || '').substring(0, 300)}`);
        console.log(`  SKILL_GSHEETS_SPREADSHEET_ID: ${result.SKILL_GSHEETS_SPREADSHEET_ID}`);
        console.log(`  SKILL_GSHEETS_READ_RANGE: ${result.SKILL_GSHEETS_READ_RANGE}`);
        console.log(`  Skill/Agent vars: ${result.allVarKeys || '(none)'}`);

        // Parse and show skill config
        if (result.AGENT_SKILL_INTEGRATIONS && result.AGENT_SKILL_INTEGRATIONS !== '(not set)') {
          try {
            const cfg = JSON.parse(result.AGENT_SKILL_INTEGRATIONS);
            console.log('  Prefetch:', JSON.stringify(cfg.prefetch));
            console.log('  During:', JSON.stringify(cfg.during));
            console.log('  Final:', JSON.stringify(cfg.final));
          } catch(e) { console.log('  Parse error:', e.message); }
        }
        break; // Found the right endpoint
      } else {
        console.log(`  ${result.path}: ${result.status || result.error}`);
      }
    }
  }

  // Also check: what's the business ID used by the testchat WebSocket?
  console.log('\n=== TESTCHAT WEBSOCKET CHECK ===');
  let wsUrl = '';
  page.on('websocket', ws => { wsUrl = ws.url(); });
  await page.goto(`${BASE}/testchat?id=${TESTCHAT_BIZ}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(8000);
  console.log('WebSocket URL:', wsUrl || '(none captured)');
  if (wsUrl) {
    const match = wsUrl.match(/businessId=([^&]+)/);
    console.log('WebSocket businessId:', match ? match[1] : '(not in URL)');
  }

  console.log('\n=== DONE ===');
  await page.waitForTimeout(3000);
  await browser.close();
})();
