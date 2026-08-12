// Direct API checks using Playwright server-side requests (no CORS)
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

  // Login & capture token
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
    await page.waitForTimeout(6000);
  }

  // Capture token from WebSocket connection on testchat
  let token = '';
  page.on('websocket', ws => {
    const url = ws.url();
    const m = url.match(/token=([^&]+)/);
    if (m) token = m[1];
  });
  await page.goto(`${BASE}/testchat?id=${TESTCHAT_BIZ}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(8000);

  if (!token) {
    // Fallback: intercept network
    let netToken = '';
    page.on('request', req => {
      const h = req.headers();
      if (h['auth'] && !netToken) netToken = h['auth'];
    });
    await page.goto(`${BASE}/businesses`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(5000);
    token = netToken;
  }

  if (!token) {
    console.log('ERROR: Could not capture auth token');
    await browser.close();
    return;
  }
  console.log('Token captured (' + token.length + ' chars)');

  // Use Playwright's server-side request API (bypasses CORS)
  const req = context.request;
  const headers = { 'Content-type': 'application/json', 'auth': token };

  // 1. OAuth providers
  console.log('\n=== 1. OAUTH PROVIDERS ===');
  try {
    const resp = await req.get(`${BACKEND}/mrcall/v1/mrcall0/oauth/providers`, { headers });
    console.log('Status:', resp.status());
    const body = await resp.text();
    console.log('Response:', body.substring(0, 500));
    try {
      const providers = JSON.parse(body);
      for (const p of providers) {
        console.log(`  Provider: ${p.provider} (${p.providerName})`);
        console.log(`    Account: ${p.providerAccountId || '(none)'}`);
        console.log(`    Scopes: ${(p.scopes || []).join(', ')}`);
        console.log(`    Created: ${p.createdAt ? new Date(p.createdAt).toISOString() : '?'}`);
      }
    } catch(e) {}
  } catch(e) { console.log('Error:', e.message); }

  // 2. Available skills
  console.log('\n=== 2. AVAILABLE SKILLS ===');
  try {
    const resp = await req.get(`${BACKEND}/mrcall/v1/mrcall0/agent/skills/available?businessId=${CONFIG_BIZ}`, { headers });
    console.log('Status:', resp.status());
    const skills = await resp.json();
    for (const s of skills) {
      console.log(`  ${s.name}: ${(s.description || '').substring(0, 100)}`);
    }
  } catch(e) { console.log('Error:', e.message); }

  // 3. Business variables for both businesses
  for (const [label, bizId] of [['TESTCHAT', TESTCHAT_BIZ], ['CONFIG', CONFIG_BIZ]]) {
    console.log(`\n=== 3. BUSINESS VARIABLES (${label}: ${bizId}) ===`);

    // Try the variable management endpoints
    const paths = [
      `/mrcall/v1/mrcall0/business_variable/${bizId}`,
      `/mrcall/v1/mrcall0/variables/${bizId}`,
      `/mrcall/v1/mrcall0/crm/businesses/${bizId}/variables`,
    ];

    let found = false;
    for (const path of paths) {
      try {
        const resp = await req.get(`${BACKEND}${path}`, { headers });
        if (resp.status() === 200) {
          const data = await resp.json();
          console.log(`Endpoint: ${path}`);
          // Look for skill-related variables
          const vars = data.variables || data;
          const keys = typeof vars === 'object' ? Object.keys(vars) : [];
          const skillKeys = keys.filter(k =>
            k.includes('SKILL') || k.includes('AGENT') || k.includes('GSHEET') || k.includes('GCLOUD')
          );
          console.log(`Total vars: ${keys.length}, Skill-related: ${skillKeys.length}`);
          for (const k of skillKeys) {
            const v = typeof vars[k] === 'string' ? vars[k] : JSON.stringify(vars[k]);
            console.log(`  ${k}: ${v.substring(0, 300)}`);
          }
          found = true;
          break;
        } else {
          console.log(`  ${path}: ${resp.status()}`);
        }
      } catch(e) {
        console.log(`  ${path}: ${e.message}`);
      }
    }

    if (!found) {
      // Try generic search for all business endpoints
      const searchPaths = [
        `/mrcall/v1/mrcall0/crm/business`,  // might list all businesses with search
      ];
      for (const path of searchPaths) {
        try {
          const resp = await req.post(`${BACKEND}${path}`, {
            headers,
            data: JSON.stringify({ businessId: bizId })
          });
          if (resp.status() === 200) {
            const data = await resp.json();
            console.log(`Found via ${path}:`, JSON.stringify(data).substring(0, 500));
            found = true;
            break;
          }
        } catch(e) {}
      }
    }

    if (!found) {
      console.log('  Could not find business variables endpoint');
    }
  }

  console.log('\n=== DONE ===');
  await page.waitForTimeout(3000);
  await browser.close();
})();
