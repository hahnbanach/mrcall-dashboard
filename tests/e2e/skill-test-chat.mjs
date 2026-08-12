// Skill E2E test — find Mr Brown on /businesses, open text chat, test conversation
import { chromium } from '@playwright/test';
import { existsSync } from 'fs';

const BASE = process.env.E2E_BASE_URL || 'http://localhost:8080';
const BUSINESSES = `${BASE}/businesses`;
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
  const name = `/tmp/skill-${String(stepN).padStart(2,'0')}-${label}.png`;
  await page.screenshot({ path: name, fullPage: false });
  console.log(`  [ss] ${name}`);
}

async function waitForBotResponse(page, prevCount, maxWait = 20000) {
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
  await page.goto(BUSINESSES, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);

  const signInBtn = await page.$('text=Sign in') || await page.$('text=Accedi');
  if (signInBtn) {
    await signInBtn.click();
    await page.waitForTimeout(2000);
    const emailInput = await page.$('input[type="email"]') || await page.$('input:not([type="hidden"]):not([type="password"])');
    if (emailInput) await emailInput.fill(EMAIL);
    const pwInput = await page.$('input[type="password"]');
    if (pwInput) await pwInput.fill(PASSWORD);
    const loginBtn = await page.$('button[type="submit"]') || await page.$('button:has-text("Sign in")');
    if (loginBtn) await loginBtn.click();
    await page.waitForTimeout(5000);
    await page.goto(BUSINESSES, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);
  }
  console.log('Authenticated');
  await context.storageState({ path: AUTH_STATE });

  // ---- FIND MR BROWN ----
  console.log('\n=== FINDING MR BROWN ===');
  await ss(page, 'businesses-loaded');

  // Search for Mr Brown using the input field (non-readonly, class p-inputtext)
  const searchInput = await page.$('input.p-inputtext.p-component.w-full:not([readonly])');
  const searchBtn = await page.$('button:has-text("Search")');
  if (searchInput && searchBtn) {
    console.log('Found search input, typing "Mr Brown"...');
    await searchInput.click();
    await searchInput.fill('Mr Brown');
    await page.waitForTimeout(500);
    await searchBtn.click();
    await page.waitForTimeout(3000);
  } else {
    console.log('Search input or button not found');
  }
  await ss(page, 'after-search');

  // Check if Mr Brown is visible now, if not try scrolling/pagination
  let mrBrownVisible = await page.$('text=Mr Brown');
  if (!mrBrownVisible) {
    console.log('Mr Brown not found on current view. Trying pages...');
    // Try page 2
    const page2 = await page.$('button:has-text("2")');
    if (page2) {
      await page2.click();
      await page.waitForTimeout(3000);
      mrBrownVisible = await page.$('text=Mr Brown');
    }
    if (!mrBrownVisible) {
      // Try page 3
      const page3 = await page.$('button:has-text("3")');
      if (page3) {
        await page3.click();
        await page.waitForTimeout(3000);
        mrBrownVisible = await page.$('text=Mr Brown');
      }
    }
  }

  if (!mrBrownVisible) {
    console.log('ERROR: Mr Brown not found on any page!');
    await ss(page, 'mr-brown-not-found');
    // List all business names visible
    const bizNames = await page.$$eval('h3, h4, [class*="business-name"], [class*="card-title"]',
      els => els.map(e => e.textContent.trim()).filter(t => t.length > 0 && t.length < 50)
    );
    console.log('Business names visible:', bizNames);
    console.log('Browser open for inspection. Ctrl+C to close.');
    await new Promise(() => {});
    return;
  }
  console.log('Found Mr Brown!');

  // Scroll Mr Brown into view
  await mrBrownVisible.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);

  // Find "Test chat" button for Mr Brown
  const testChatBtns = await page.$$('button:has-text("Test chat")');
  let mrBrownChatBtn = null;
  for (const btn of testChatBtns) {
    const isNearMrBrown = await btn.evaluate(el => {
      let p = el;
      for (let i = 0; i < 15; i++) {
        p = p.parentElement;
        if (!p) break;
        if (p.textContent.includes('Mr Brown') && p.textContent.includes('694b4410')) return true;
      }
      return false;
    });
    if (isNearMrBrown) {
      mrBrownChatBtn = btn;
      break;
    }
  }

  if (!mrBrownChatBtn && testChatBtns.length > 0) {
    console.log('Using first Test chat button as fallback');
    mrBrownChatBtn = testChatBtns[0];
  }

  // ---- OPEN TEXT CHAT ----
  console.log('\n=== OPENING TEXT CHAT ===');
  await mrBrownChatBtn.scrollIntoViewIfNeeded();
  await mrBrownChatBtn.click();
  console.log('Clicked "Test chat", waiting for WebSocket connection...');
  await page.waitForTimeout(6000); // WS connect + greeting
  await ss(page, 'chat-opened');

  // Verify chat panel opened
  const chatPanel = await page.$('.chat-panel');
  if (!chatPanel) {
    console.log('ERROR: Chat panel did not open!');
    await ss(page, 'no-chat-panel');
    console.log('Browser open. Ctrl+C to close.');
    await new Promise(() => {});
    return;
  }
  console.log('Chat panel is open!');

  // Read greeting
  const greetings = await page.$$eval('.chat-message.bot .chat-text', els => els.map(e => e.textContent.trim()));
  console.log('Bot greeting:', greetings);

  // ---- CONVERSATION ----
  console.log('\n=== CONVERSATION ===');
  const chatInput = await page.$('.chat-input');

  // Turn 1: Greeting
  console.log('\n[USER] Ciao, mi chiamo Angelo');
  let botCount = await page.$$eval('.chat-message.bot .chat-bubble:not(.typing)', els => els.length);
  await chatInput.fill('Ciao, mi chiamo Angelo');
  await chatInput.press('Enter');
  botCount = await waitForBotResponse(page, botCount);
  let lastBot = await page.$$eval('.chat-message.bot .chat-text', els => els[els.length - 1]?.textContent || '');
  console.log(`[BOT] ${lastBot.substring(0, 200)}`);
  await ss(page, 'turn1');

  // Turn 2: Ask about the spreadsheet/available info
  console.log('\n[USER] Che informazioni hai disponibili?');
  await chatInput.fill('Che informazioni hai disponibili?');
  await chatInput.press('Enter');
  botCount = await waitForBotResponse(page, botCount);
  lastBot = await page.$$eval('.chat-message.bot .chat-text', els => els[els.length - 1]?.textContent || '');
  console.log(`[BOT] ${lastBot.substring(0, 200)}`);
  await ss(page, 'turn2');

  // Turn 3: Try to trigger a skill
  console.log('\n[USER] Puoi cercare un contatto per me?');
  await chatInput.fill('Puoi cercare un contatto per me?');
  await chatInput.press('Enter');
  botCount = await waitForBotResponse(page, botCount);
  lastBot = await page.$$eval('.chat-message.bot .chat-text', els => els[els.length - 1]?.textContent || '');
  console.log(`[BOT] ${lastBot.substring(0, 200)}`);
  await ss(page, 'turn3');

  // ---- FULL CONVERSATION LOG ----
  console.log('\n=== FULL CONVERSATION ===');
  const allMsgs = await page.$$eval('.chat-message', els => els.map(e => ({
    role: e.classList.contains('bot') ? 'BOT' : e.classList.contains('user') ? 'USER' : 'SYS',
    text: (e.querySelector('.chat-text') || { textContent: '' }).textContent.trim()
  })));
  for (const m of allMsgs) {
    console.log(`  [${m.role}] ${m.text.substring(0, 150)}`);
  }

  await ss(page, 'final');
  console.log('\n=== DONE — Browser open. Ctrl+C to close. ===');
  await new Promise(() => {});
})();
