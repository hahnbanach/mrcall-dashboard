// Check AGENT_SKILL_INTEGRATIONS on both businesses using correct API endpoint
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
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
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

  // Capture token
  let token = '';
  await page.route('**/mrcall/v1/**', async (route) => {
    const h = route.request().headers();
    if (h['auth'] && !token) token = h['auth'];
    await route.continue();
  });
  await page.goto(`${BASE}/businesses`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);
  await page.unroute('**/mrcall/v1/**');

  if (!token) {
    console.log('ERROR: No auth token captured');
    await browser.close();
    return;
  }
  console.log('Token OK');

  // Use Playwright's server-side request API (bypasses CORS)
  const req = context.request;
  const headers = { 'Content-type': 'application/json', 'auth': token };

  // Check both businesses using correct endpoint: GET /crm/business?id=xxx
  for (const [label, bizId] of [['TESTCHAT (Testmirs)', TESTCHAT_BIZ], ['CONFIG (Mr Brown)', CONFIG_BIZ]]) {
    console.log(`\n=== ${label}: ${bizId} ===`);
    try {
      const resp = await req.get(`${BACKEND}/mrcall/v1/mrcall0/crm/business?id=${bizId}`, { headers });
      console.log('Status:', resp.status());
      if (resp.status() === 200) {
        const data = await resp.json();
        // Handle both single result and array
        const biz = Array.isArray(data) ? data[0] : (data.result || data);
        console.log('Business name:', biz?.name || biz?.nickname || biz?.companyName || '?');
        console.log('Owner:', biz?.owner || '?');
        console.log('Template:', biz?.template || '?');

        const vars = biz?.variables || {};
        const skillConfig = vars.AGENT_SKILL_INTEGRATIONS;
        if (skillConfig) {
          console.log('AGENT_SKILL_INTEGRATIONS: SET (' + skillConfig.length + ' chars)');
          try {
            const parsed = JSON.parse(skillConfig);
            console.log('  prefetch:', JSON.stringify(parsed.prefetch || []));
            console.log('  during:', JSON.stringify(parsed.during || []));
            console.log('  final:', JSON.stringify(parsed.final || []));

            // Show params of each prefetch skill
            if (parsed.prefetch && parsed.prefetch.length > 0) {
              for (const entry of parsed.prefetch) {
                console.log(`  prefetch skill: ${entry.skill}`);
                console.log(`    params:`, JSON.stringify(entry.params || {}));
              }
            }
          } catch(e) {
            console.log('  Raw value:', skillConfig.substring(0, 500));
          }
        } else {
          console.log('AGENT_SKILL_INTEGRATIONS: NOT SET');
        }

        // Also show all skill/agent related vars
        const skillVars = Object.keys(vars).filter(k =>
          k.includes('SKILL') || k.includes('AGENT') || k.includes('GSHEET') || k.includes('GCLOUD')
        );
        if (skillVars.length > 0) {
          console.log('Other skill-related vars:');
          for (const k of skillVars) {
            if (k === 'AGENT_SKILL_INTEGRATIONS') continue;
            console.log(`  ${k}: ${vars[k]?.substring(0, 200) || '(empty)'}`);
          }
        }
      } else {
        const body = await resp.text();
        console.log('Response:', body.substring(0, 300));
      }
    } catch(e) {
      console.log('Error:', e.message);
    }
  }

  console.log('\n=== DONE ===');
  await page.waitForTimeout(2000);
  await browser.close();
})();
