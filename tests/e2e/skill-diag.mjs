// Diagnose skill configuration and test chat
import { chromium } from '@playwright/test';
import { existsSync } from 'fs';

const BASE = process.env.E2E_BASE_URL || 'http://localhost:8080';
const TESTCHAT_BIZ = 'f63adf8a-3fc4-37f9-853a-626bbffd38c8';
const CONFIG_BIZ = '694b4410-342d-3d8d-bae8-c93a9d53b2fe';
const EMAIL = process.env.E2E_EMAIL;
const PASSWORD = process.env.E2E_PASSWORD;
if (!EMAIL || !PASSWORD) {
  console.error('Set E2E_EMAIL and E2E_PASSWORD before running this script.');
  process.exit(1);
}

const AUTH_STATE = '/tmp/pw-auth-state.json';

let stepN = 0;
async function ss(page, label) {
  stepN++;
  const name = `/tmp/diag-${String(stepN).padStart(2,'0')}-${label}.png`;
  await page.screenshot({ path: name, fullPage: true });
  console.log(`  [ss] ${name}`);
}

async function ensureLogin(page, context) {
  await page.goto(`${BASE}/businesses`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);
  const signInBtn = await page.$('text=Sign in') || await page.$('text=Accedi');
  if (signInBtn) {
    console.log('Not logged in, doing email/password login...');
    await signInBtn.click();
    await page.waitForTimeout(2000);
    const emailInput = await page.$('input[type="email"]') || await page.$('input:not([type="hidden"]):not([type="password"])');
    if (emailInput) await emailInput.fill(EMAIL);
    const pwInput = await page.$('input[type="password"]');
    if (pwInput) await pwInput.fill(PASSWORD);
    const loginBtn = await page.$('button[type="submit"]') || await page.$('button:has-text("Sign in")');
    if (loginBtn) await loginBtn.click();
    await page.waitForTimeout(5000);
    await context.storageState({ path: AUTH_STATE });
    console.log('Logged in and saved auth state');
  } else {
    console.log('Already authenticated');
  }
}

async function waitForBotResponse(page, prevCount, maxWait = 25000) {
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    const count = await page.$$eval('.chat-message.bot .chat-bubble:not(.typing)', els => els.length);
    if (count > prevCount) return count;
    await page.waitForTimeout(500);
  }
  return prevCount;
}

(async () => {
  const browser = await chromium.launch({
    headless: false,
    channel: 'chrome',
    args: ['--no-first-run', '--no-default-browser-check']
  });

  const contextOpts = { viewport: { width: 1440, height: 900 }, ignoreHTTPSErrors: true };
  if (existsSync(AUTH_STATE)) contextOpts.storageState = AUTH_STATE;
  const context = await browser.newContext(contextOpts);
  context.setDefaultTimeout(30000);
  const page = await context.newPage();

  // ---- LOGIN ----
  console.log('=== LOGIN ===');
  await ensureLogin(page, context);

  // ---- PART 1: CHECK BUSINESS CONFIGURATION ----
  console.log('\n=== CHECKING BUSINESS CONFIG (Mr Brown) ===');
  await page.goto(`${BASE}/businessconfiguration?id=${CONFIG_BIZ}`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);
  await ss(page, 'bizconfig-loaded');

  // Look for "Impostazioni avanzate" or "Advanced settings"
  const advBtn = await page.$('text=Impostazioni avanzate') || await page.$('text=Advanced settings') || await page.$('text=Avanzate');
  if (advBtn) {
    console.log('Found "Impostazioni avanzate", clicking...');
    await advBtn.click();
    await page.waitForTimeout(2000);
    await ss(page, 'advanced-settings');
  } else {
    console.log('Advanced settings button not found. Looking for menu items...');
    // Try sidebar/menu items
    const menuItems = await page.$$eval('[class*="menu"] a, [class*="sidebar"] a, [class*="nav"] a, .p-menuitem a, .p-tabmenuitem a',
      els => els.map(e => ({ text: e.textContent.trim(), href: e.href }))
    );
    console.log('Menu items:', JSON.stringify(menuItems.filter(m => m.text.length > 0), null, 2));
    await ss(page, 'menu-items');
  }

  // Look for agent skills section
  const skillsSection = await page.$('text=Agent Skills') || await page.$('text=Skill') || await page.$('[class*="skill"]');
  if (skillsSection) {
    console.log('Found skills section');
    await skillsSection.scrollIntoViewIfNeeded();
    await page.waitForTimeout(1000);
    await ss(page, 'skills-section');
  }

  // Dump all visible text about skills configuration
  const skillsInfo = await page.$$eval('[class*="skill"], [class*="agent"], [data-testid*="skill"]',
    els => els.map(e => e.textContent.trim().substring(0, 200))
  );
  if (skillsInfo.length > 0) {
    console.log('Skills-related elements:', skillsInfo);
  }

  // ---- PART 2: TEST CHAT ----
  console.log('\n=== TESTING CHAT ===');
  console.log(`Business: ${TESTCHAT_BIZ}`);
  await page.goto(`${BASE}/testchat?id=${TESTCHAT_BIZ}`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(6000); // Wait for WS connect + greeting
  await ss(page, 'testchat-loaded');

  // Check if chat connected
  const chatStatus = await page.$eval('.chat-status', e => e.textContent.trim()).catch(() => null);
  const chatMessages = await page.$$eval('.chat-message', els => els.map(e => ({
    role: e.classList.contains('bot') ? 'BOT' : 'USER',
    text: (e.querySelector('.chat-text') || {textContent:''}).textContent.trim()
  })));
  console.log('Chat status:', chatStatus);
  console.log('Initial messages:', chatMessages);

  // Check if connected (input should be enabled)
  const inputDisabled = await page.$eval('.chat-input', e => e.disabled).catch(() => true);
  console.log('Input disabled:', inputDisabled);

  if (inputDisabled) {
    console.log('Chat not connected! Checking page content...');
    const pageText = await page.$eval('.test-chat-page', e => e.textContent.trim().substring(0, 500));
    console.log('Page content:', pageText);
    await ss(page, 'chat-not-connected');
  } else {
    // Send a test message about skills
    const chatInput = await page.$('.chat-input');

    // Turn 1
    console.log('\n[USER] Ciao');
    let botCount = await page.$$eval('.chat-message.bot .chat-bubble:not(.typing)', els => els.length);
    await chatInput.fill('Ciao');
    await chatInput.press('Enter');
    botCount = await waitForBotResponse(page, botCount);
    let lastBot = await page.$$eval('.chat-message.bot .chat-text', els => els[els.length - 1]?.textContent || '(no response)');
    console.log(`[BOT] ${lastBot.substring(0, 300)}`);
    await ss(page, 'turn1');

    // Turn 2 - try to trigger a skill
    console.log('\n[USER] Puoi leggere i dati dal foglio Google?');
    await chatInput.fill('Puoi leggere i dati dal foglio Google?');
    await chatInput.press('Enter');
    botCount = await waitForBotResponse(page, botCount);
    lastBot = await page.$$eval('.chat-message.bot .chat-text', els => els[els.length - 1]?.textContent || '(no response)');
    console.log(`[BOT] ${lastBot.substring(0, 300)}`);
    await ss(page, 'turn2');

    // Turn 3 - try another skill-triggering message
    console.log('\n[USER] Scrivi qualcosa sul foglio Google');
    await chatInput.fill('Scrivi qualcosa sul foglio Google');
    await chatInput.press('Enter');
    botCount = await waitForBotResponse(page, botCount);
    lastBot = await page.$$eval('.chat-message.bot .chat-text', els => els[els.length - 1]?.textContent || '(no response)');
    console.log(`[BOT] ${lastBot.substring(0, 300)}`);
    await ss(page, 'turn3');

    // Full conversation
    console.log('\n=== FULL CONVERSATION ===');
    const allMsgs = await page.$$eval('.chat-message', els => els.map(e => ({
      role: e.classList.contains('bot') ? 'BOT' : e.classList.contains('user') ? 'USER' : 'SYS',
      text: (e.querySelector('.chat-text') || { textContent: '' }).textContent.trim()
    })));
    for (const m of allMsgs) {
      console.log(`  [${m.role}] ${m.text.substring(0, 200)}`);
    }
  }

  // ---- PART 3: Also test Mr Brown chat ----
  console.log('\n=== TESTING MR BROWN CHAT ===');
  await page.goto(`${BASE}/testchat?id=${CONFIG_BIZ}`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(6000);
  await ss(page, 'mrbrown-chat-loaded');

  const mrBrownDisabled = await page.$eval('.chat-input', e => e.disabled).catch(() => true);
  if (!mrBrownDisabled) {
    const chatInput2 = await page.$('.chat-input');

    console.log('\n[USER] Ciao, mi chiamo Angelo');
    let botCount2 = await page.$$eval('.chat-message.bot .chat-bubble:not(.typing)', els => els.length);
    await chatInput2.fill('Ciao, mi chiamo Angelo');
    await chatInput2.press('Enter');
    botCount2 = await waitForBotResponse(page, botCount2);
    let lastBot2 = await page.$$eval('.chat-message.bot .chat-text', els => els[els.length - 1]?.textContent || '(no response)');
    console.log(`[BOT] ${lastBot2.substring(0, 300)}`);

    console.log('\n[USER] Puoi leggere i dati dal foglio Google Sheets?');
    await chatInput2.fill('Puoi leggere i dati dal foglio Google Sheets?');
    await chatInput2.press('Enter');
    botCount2 = await waitForBotResponse(page, botCount2);
    lastBot2 = await page.$$eval('.chat-message.bot .chat-text', els => els[els.length - 1]?.textContent || '(no response)');
    console.log(`[BOT] ${lastBot2.substring(0, 300)}`);
    await ss(page, 'mrbrown-turn2');

    console.log('\n=== MR BROWN FULL CONVERSATION ===');
    const allMsgs2 = await page.$$eval('.chat-message', els => els.map(e => ({
      role: e.classList.contains('bot') ? 'BOT' : e.classList.contains('user') ? 'USER' : 'SYS',
      text: (e.querySelector('.chat-text') || { textContent: '' }).textContent.trim()
    })));
    for (const m of allMsgs2) {
      console.log(`  [${m.role}] ${m.text.substring(0, 200)}`);
    }
  } else {
    console.log('Mr Brown chat not connected');
    const status = await page.$eval('.chat-status', e => e.textContent.trim()).catch(() => 'no status');
    console.log('Status:', status);
    await ss(page, 'mrbrown-not-connected');
  }

  await ss(page, 'final');
  console.log('\n=== DONE ===');
  // Keep browser open for 30 seconds for inspection, then close
  await page.waitForTimeout(30000);
  await browser.close();
})();
