// Diagnose Google Sheets skill: OAuth status, backend endpoints, testchat
import { chromium } from '@playwright/test';

const BASE = process.env.E2E_BASE_URL || 'http://localhost:8080';
const BACKEND = 'https://angelo.ngrok.io';
const CONFIG_BIZ = '694b4410-342d-3d8d-bae8-c93a9d53b2fe';
const TESTCHAT_BIZ = 'f63adf8a-3fc4-37f9-853a-626bbffd38c8';
const EMAIL = process.env.E2E_EMAIL;
const PASSWORD = process.env.E2E_PASSWORD;

if (!EMAIL || !PASSWORD) {
  console.error('Set E2E_EMAIL and E2E_PASSWORD before running this script.');
  process.exit(1);
}


let stepN = 0;
async function ss(page, label) {
  stepN++;
  const name = `/tmp/diag-${String(stepN).padStart(2,'0')}-${label}.png`;
  await page.screenshot({ path: name, fullPage: true });
  console.log(`  [ss] ${name}`);
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

  // === 1. LOGIN ===
  console.log('=== 1. LOGGING IN ===');
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);
  let emailInput = await page.$('input[type="email"]');
  let pwInput = await page.$('input[type="password"]');
  if (!emailInput) {
    const signInBtn = await page.$('text=Sign in') || await page.$('text=Accedi');
    if (signInBtn) { await signInBtn.click(); await page.waitForTimeout(2000); }
    emailInput = await page.$('input[type="email"]') || await page.$('input:not([type="hidden"]):not([type="password"])');
    pwInput = await page.$('input[type="password"]');
  }
  if (emailInput && pwInput) {
    await emailInput.fill(EMAIL);
    await pwInput.fill(PASSWORD);
    const submitBtn = await page.$('button[type="submit"]') || await page.$('button:has-text("Sign in")') || await page.$('button:has-text("Accedi")');
    if (submitBtn) await submitBtn.click();
    await page.waitForTimeout(5000);
  }
  console.log('URL after login:', page.url());

  // === 2. GET AUTH TOKEN (intercept from network) ===
  console.log('\n=== 2. GETTING AUTH TOKEN ===');
  let capturedToken = '';
  await page.route('**/mrcall/v1/**', async (route) => {
    const headers = route.request().headers();
    if (headers['auth'] && !capturedToken) {
      capturedToken = headers['auth'];
    }
    await route.continue();
  });
  // Navigate to businesses to trigger an API call with auth header
  await page.goto(`${BASE}/businesses`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(5000);
  if (!capturedToken) {
    // Try navigating to business config to trigger more API calls
    await page.goto(`${BASE}/businessconfiguration?id=${CONFIG_BIZ}`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(5000);
  }
  await page.unroute('**/mrcall/v1/**');
  const authToken = capturedToken
    ? { uid: '(from token)', email: '(from token)', token: capturedToken.substring(0, 50) + '...', fullToken: capturedToken }
    : { error: 'Could not capture auth token' };
  if (authToken.error) {
    console.log('ERROR:', authToken.error);
    await browser.close();
    return;
  }
  console.log(`User: ${authToken.email} (${authToken.uid})`);
  console.log(`Token: ${authToken.token}`);

  // === 3. CHECK OAUTH ENDPOINTS ===
  console.log('\n=== 3. CHECKING OAUTH ENDPOINTS ===');

  // 3a. GET /oauth/providers - list connected providers
  const providersResult = await page.evaluate(async (args) => {
    try {
      const resp = await fetch(args.url + '/mrcall/v1/mrcall0/oauth/providers', {
        headers: { 'Content-type': 'application/json', 'auth': args.token }
      });
      const text = await resp.text();
      return { status: resp.status, statusText: resp.statusText, body: text.substring(0, 500) };
    } catch (e) { return { error: e.message }; }
  }, { url: BACKEND, token: authToken.fullToken });
  console.log('GET /oauth/providers:', JSON.stringify(providersResult, null, 2));

  // 3b. GET /agent/skills/available - check if skills are loaded
  const skillsResult = await page.evaluate(async (args) => {
    try {
      const resp = await fetch(args.url + '/mrcall/v1/mrcall0/agent/skills/available?businessId=' + args.bizId, {
        headers: { 'Content-type': 'application/json', 'auth': args.token }
      });
      const text = await resp.text();
      return { status: resp.status, body: text.substring(0, 1000) };
    } catch (e) { return { error: e.message }; }
  }, { url: BACKEND, token: authToken.fullToken, bizId: CONFIG_BIZ });
  console.log('GET /agent/skills/available:', JSON.stringify(skillsResult, null, 2));

  // === 4. CHECK BUSINESS VARIABLES ===
  console.log('\n=== 4. CHECKING BUSINESS CONFIG ===');
  await page.goto(`${BASE}/businessconfiguration?id=${CONFIG_BIZ}`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);

  // Click advanced settings
  const advBtn = await page.$('text=Impostazioni avanzate') || await page.$('text=Advanced settings');
  if (advBtn) { await advBtn.click(); await page.waitForTimeout(2000); }

  // Look for AGENT_SKILL_INTEGRATIONS variable value
  const skillIntegrations = await page.evaluate(async (args) => {
    try {
      const resp = await fetch(args.url + '/mrcall/v1/mrcall0/business/' + args.bizId, {
        headers: { 'Content-type': 'application/json', 'auth': args.token }
      });
      const data = await resp.json();
      const vars = data.variables || {};
      return {
        AGENT_SKILL_INTEGRATIONS: vars.AGENT_SKILL_INTEGRATIONS || '(not set)',
        SKILL_GSHEETS_SPREADSHEET_ID: vars.SKILL_GSHEETS_SPREADSHEET_ID || '(not set)',
        SKILL_GSHEETS_READ_RANGE: vars.SKILL_GSHEETS_READ_RANGE || '(not set)',
        GCLOUD_APP_CLIENT_NAME: vars.GCLOUD_APP_CLIENT_NAME || '(not set)',
        owner: data.owner || '(not set)',
        name: data.name || '(not set)'
      };
    } catch (e) { return { error: e.message }; }
  }, { url: BACKEND, token: authToken.fullToken, bizId: CONFIG_BIZ });
  console.log('Business config:', JSON.stringify(skillIntegrations, null, 2));

  // === 5. PARSE SKILL CONFIG ===
  console.log('\n=== 5. PARSING SKILL CONFIG ===');
  try {
    const config = JSON.parse(skillIntegrations.AGENT_SKILL_INTEGRATIONS);
    console.log('Prefetch skills:', JSON.stringify(config.prefetch, null, 2));
    console.log('During skills:', JSON.stringify(config.during, null, 2));
    console.log('Final skills:', JSON.stringify(config.final, null, 2));
  } catch (e) {
    console.log('Could not parse AGENT_SKILL_INTEGRATIONS:', e.message);
  }

  // === 6. CHECK OAUTH STATUS FOR BUSINESS OWNER ===
  console.log('\n=== 6. OAUTH STATUS FOR BUSINESS OWNER ===');
  const ownerUid = skillIntegrations.owner;
  console.log('Business owner UID:', ownerUid);
  console.log('Current user UID:', authToken.uid);
  if (ownerUid !== authToken.uid) {
    console.log('WARNING: Current user is NOT the business owner!');
    console.log('OAuth tokens are looked up by OWNER UID, not current user UID.');
    console.log('The business owner must authorize Google Sheets, not the current user.');
  }

  // === 7. TEST CHAT ===
  console.log('\n=== 7. TESTING CHAT ===');
  await page.goto(`${BASE}/testchat?id=${TESTCHAT_BIZ}`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(8000);
  await ss(page, 'testchat');

  const chatInput = await page.$('.chat-input');
  const disabled = chatInput ? await chatInput.evaluate(e => e.disabled) : true;
  console.log('Chat input disabled:', disabled);

  if (chatInput && !disabled) {
    // Send a message asking about the spreadsheet
    console.log('\n[USER] Leggi i dati dal foglio Google Sheets');
    let bc = await page.$$eval('.chat-message.bot .chat-bubble:not(.typing)', els => els.length);
    await chatInput.fill('Leggi i dati dal foglio Google Sheets');
    await chatInput.press('Enter');

    // Wait for response
    const start = Date.now();
    while (Date.now() - start < 30000) {
      const count = await page.$$eval('.chat-message.bot .chat-bubble:not(.typing)', els => els.length);
      if (count > bc) { bc = count; break; }
      await page.waitForTimeout(500);
    }

    const lastBot = await page.$$eval('.chat-message.bot .chat-text', els =>
      els[els.length - 1]?.textContent || '(no response)');
    console.log(`[BOT] ${lastBot.substring(0, 500)}`);
    await ss(page, 'chat-response');
  }

  // === SUMMARY ===
  console.log('\n=== DIAGNOSTIC SUMMARY ===');
  console.log('1. OAuth endpoint status:', providersResult.status || 'error');
  if (providersResult.status === 404) {
    console.log('   -> The /oauth/providers endpoint does NOT exist. Server needs RESTART (not just DT reload).');
  } else if (providersResult.status === 200) {
    try {
      const providers = JSON.parse(providersResult.body);
      const sheets = providers.find(p => p.provider === 'google_sheets');
      if (sheets) {
        console.log('   -> Google Sheets OAuth is CONNECTED:', sheets.providerAccountId || '(no account ID)');
      } else {
        console.log('   -> Google Sheets OAuth is NOT CONNECTED. User must click "Connect" in skill config.');
      }
    } catch (e) {
      console.log('   -> Could not parse providers response');
    }
  }
  console.log('2. Spreadsheet ID:', skillIntegrations.SKILL_GSHEETS_SPREADSHEET_ID);
  console.log('3. Business owner:', ownerUid, ownerUid === authToken.uid ? '(matches current user)' : '(DIFFERENT from current user!)');

  await ss(page, 'final');
  console.log('\n=== DONE ===');
  await page.waitForTimeout(5000);
  await browser.close();
})();
