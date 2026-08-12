// Diagnose skill configuration and test chat — with fresh Firebase login
import { chromium } from '@playwright/test';

const BASE = process.env.E2E_BASE_URL || 'http://localhost:8080';
const TESTCHAT_BIZ = 'f63adf8a-3fc4-37f9-853a-626bbffd38c8';
const CONFIG_BIZ = '694b4410-342d-3d8d-bae8-c93a9d53b2fe';
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

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    ignoreHTTPSErrors: true
  });
  context.setDefaultTimeout(30000);
  const page = await context.newPage();

  // Listen for console errors
  page.on('console', msg => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      console.log(`  [${msg.type()}] ${msg.text().substring(0, 300)}`);
    }
  });

  // ---- FRESH LOGIN ----
  console.log('=== FRESH LOGIN ===');
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);
  await ss(page, 'login-page');

  // Find email/password inputs
  let emailInput = await page.$('input[type="email"]');
  let pwInput = await page.$('input[type="password"]');
  if (!emailInput) {
    // Maybe need to click a button first
    const signInBtn = await page.$('text=Sign in') || await page.$('text=Accedi') || await page.$('button:has-text("email")');
    if (signInBtn) {
      await signInBtn.click();
      await page.waitForTimeout(2000);
    }
    emailInput = await page.$('input[type="email"]') || await page.$('input:not([type="hidden"]):not([type="password"])');
    pwInput = await page.$('input[type="password"]');
  }
  if (emailInput && pwInput) {
    await emailInput.fill(EMAIL);
    await pwInput.fill(PASSWORD);
    const submitBtn = await page.$('button[type="submit"]') || await page.$('button:has-text("Sign in")') || await page.$('button:has-text("Accedi")');
    if (submitBtn) {
      await submitBtn.click();
      console.log('Submitted login form');
    }
    await page.waitForTimeout(5000);
  } else {
    console.log('Could not find login form fields');
  }
  await ss(page, 'after-login');
  console.log('URL after login:', page.url());

  // ---- CHECK IF FIREBASE USER EXISTS ----
  const firebaseUser = await page.evaluate(() => {
    try {
      // Check if firebase auth has a user
      const app = window.__firebase_app || null;
      return { hasApp: !!app };
    } catch(e) { return { error: e.message }; }
  });
  console.log('Firebase check:', firebaseUser);

  // ---- TEST CHAT via /testchat ----
  console.log('\n=== TESTING /testchat (Mr Brown) ===');
  await page.goto(`${BASE}/testchat?id=${CONFIG_BIZ}`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(8000);
  await ss(page, 'testchat-mrbrown');

  const status1 = await page.$eval('.chat-status', e => e.textContent.trim()).catch(() => null);
  const disabled1 = await page.$eval('.chat-input', e => e.disabled).catch(() => true);
  console.log('Status:', status1, '| Input disabled:', disabled1);

  if (!disabled1) {
    const chatInput = await page.$('.chat-input');

    console.log('\n[USER] Ciao, mi chiamo Angelo');
    let bc = await page.$$eval('.chat-message.bot .chat-bubble:not(.typing)', els => els.length);
    await chatInput.fill('Ciao, mi chiamo Angelo');
    await chatInput.press('Enter');
    bc = await waitForBotResponse(page, bc);
    let lb = await page.$$eval('.chat-message.bot .chat-text', els => els[els.length - 1]?.textContent || '(no response)');
    console.log(`[BOT] ${lb.substring(0, 300)}`);
    await ss(page, 'mrbrown-turn1');

    console.log('\n[USER] Puoi leggere i dati dal foglio Google Sheets?');
    await chatInput.fill('Puoi leggere i dati dal foglio Google Sheets?');
    await chatInput.press('Enter');
    bc = await waitForBotResponse(page, bc);
    lb = await page.$$eval('.chat-message.bot .chat-text', els => els[els.length - 1]?.textContent || '(no response)');
    console.log(`[BOT] ${lb.substring(0, 300)}`);
    await ss(page, 'mrbrown-turn2');

    console.log('\n=== FULL CONVERSATION ===');
    const allMsgs = await page.$$eval('.chat-message', els => els.map(e => ({
      role: e.classList.contains('bot') ? 'BOT' : 'USER',
      text: (e.querySelector('.chat-text') || {textContent:''}).textContent.trim()
    })));
    for (const m of allMsgs) console.log(`  [${m.role}] ${m.text.substring(0, 200)}`);
  } else {
    console.log('testchat not connecting, falling back to /businesses...');

    await page.goto(`${BASE}/businesses`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);

    const searchInput = await page.$('input.p-inputtext.p-component.w-full:not([readonly])');
    const searchBtn = await page.$('button:has-text("Search")');
    if (searchInput && searchBtn) {
      await searchInput.fill('Mr Brown');
      await page.waitForTimeout(500);
      await searchBtn.click();
      await page.waitForTimeout(3000);
    }

    const testChatBtn = await page.$('button:has-text("Test chat")');
    if (testChatBtn) {
      await testChatBtn.scrollIntoViewIfNeeded();
      await testChatBtn.click();
      console.log('Opened chat via /businesses');
      await page.waitForTimeout(6000);
      await ss(page, 'businesses-chat');

      const chatInput = await page.$('.chat-input');
      if (chatInput) {
        const dis = await chatInput.evaluate(e => e.disabled);
        if (!dis) {
          console.log('\n[USER] Ciao, mi chiamo Angelo');
          let bc = await page.$$eval('.chat-message.bot .chat-bubble:not(.typing)', els => els.length);
          await chatInput.fill('Ciao, mi chiamo Angelo');
          await chatInput.press('Enter');
          bc = await waitForBotResponse(page, bc);
          let lb = await page.$$eval('.chat-message.bot .chat-text', els => els[els.length - 1]?.textContent || '(no response)');
          console.log(`[BOT] ${lb.substring(0, 300)}`);

          console.log('\n[USER] Puoi leggere i dati dal foglio Google Sheets?');
          await chatInput.fill('Puoi leggere i dati dal foglio Google Sheets?');
          await chatInput.press('Enter');
          bc = await waitForBotResponse(page, bc);
          lb = await page.$$eval('.chat-message.bot .chat-text', els => els[els.length - 1]?.textContent || '(no response)');
          console.log(`[BOT] ${lb.substring(0, 300)}`);
          await ss(page, 'businesses-turn2');

          console.log('\n=== FULL CONVERSATION ===');
          const allMsgs = await page.$$eval('.chat-message', els => els.map(e => ({
            role: e.classList.contains('bot') ? 'BOT' : 'USER',
            text: (e.querySelector('.chat-text') || {textContent:''}).textContent.trim()
          })));
          for (const m of allMsgs) console.log(`  [${m.role}] ${m.text.substring(0, 200)}`);
        } else {
          console.log('Chat input still disabled on /businesses');
        }
      }
    }
  }

  // ---- CHECK BUSINESS CONFIG ----
  console.log('\n=== CHECKING BUSINESS CONFIG (Mr Brown) ===');
  await page.goto(`${BASE}/businessconfiguration?id=${CONFIG_BIZ}`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);

  const advBtn = await page.$('text=Impostazioni avanzate') || await page.$('text=Advanced settings');
  if (advBtn) {
    await advBtn.click();
    await page.waitForTimeout(2000);
  }

  // Scroll down to find skills
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(1000);

  const skillsText = await page.$$eval('[class*="skill"], [class*="agent-skill"]',
    els => els.map(e => e.textContent.trim().substring(0, 400))
  );
  console.log('Skills found:', skillsText.length);
  for (const s of skillsText) console.log(`  ${s.substring(0, 200)}`);
  await ss(page, 'skills-config');

  await ss(page, 'final');
  console.log('\n=== DONE ===');
  await page.waitForTimeout(10000);
  await browser.close();
})();
