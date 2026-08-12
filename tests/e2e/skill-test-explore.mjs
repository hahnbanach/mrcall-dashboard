// Skill test — auto login then explore business config
import { chromium } from '@playwright/test';

const BUSINESS_URL = 'https://dashboard-angelo.ngrok.io/businessconfiguration?id=694b4410-342d-3d8d-bae8-c93a9d53b2fe';
const EMAIL = process.env.E2E_EMAIL;
const PASSWORD = process.env.E2E_PASSWORD;

if (!EMAIL || !PASSWORD) {
  console.error('Set E2E_EMAIL and E2E_PASSWORD before running this script.');
  process.exit(1);
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
  context.setDefaultTimeout(60000);
  const page = await context.newPage();

  // Step 1: Navigate to business config
  console.log('Step 1: Navigating to business configuration...');
  await page.goto(BUSINESS_URL, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);

  // Step 2: Check if we need to login
  const signInBtn = await page.$('text=Sign in') || await page.$('text=Accedi');
  if (signInBtn) {
    console.log('Step 2: Not authenticated, logging in...');
    await signInBtn.click();
    await page.waitForTimeout(2000);

    // Fill email
    const emailInput = await page.$('input[type="email"], input[name="email"], input[placeholder*="email" i], input[placeholder*="Email" i]');
    if (emailInput) {
      console.log('  Filling email...');
      await emailInput.fill(EMAIL);
    } else {
      console.log('  Looking for email field...');
      // Try to find any text input
      const inputs = await page.$$eval('input', els => els.map(e => ({
        type: e.type, name: e.name, placeholder: e.placeholder, id: e.id
      })));
      console.log('  Available inputs:', JSON.stringify(inputs));
      const firstInput = await page.$('input[type="text"], input:not([type="hidden"])');
      if (firstInput) await firstInput.fill(EMAIL);
    }

    // Fill password
    const pwInput = await page.$('input[type="password"]');
    if (pwInput) {
      console.log('  Filling password...');
      await pwInput.fill(PASSWORD);
    }

    // Take screenshot before submitting
    await page.screenshot({ path: '/tmp/skill-login-filled.png' });

    // Click login button
    const loginBtn = await page.$('button[type="submit"]')
      || await page.$('button:has-text("Sign in")')
      || await page.$('button:has-text("Accedi")')
      || await page.$('button:has-text("Login")');
    if (loginBtn) {
      console.log('  Clicking login button...');
      await loginBtn.click();
    }

    // Wait for navigation away from login
    console.log('  Waiting for login to complete...');
    await page.waitForTimeout(5000);

    // Navigate to business config after login
    console.log('  Navigating to business config...');
    await page.goto(BUSINESS_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(5000);
  }

  console.log('Step 3: On business config page');
  console.log('URL:', page.url());

  // Verify authenticated
  const stillSignIn = await page.$('text=Sign in') || await page.$('text=Accedi');
  if (stillSignIn) {
    console.log('WARNING: Still not authenticated!');
    await page.screenshot({ path: '/tmp/skill-login-failed.png' });
  } else {
    console.log('Authenticated successfully!');
  }

  // Save auth state for future runs
  await context.storageState({ path: '/tmp/pw-auth-state.json' });
  console.log('Auth state saved to /tmp/pw-auth-state.json');

  // Step 4: Screenshot authenticated page
  await page.screenshot({ path: '/tmp/skill-03-authed.png', fullPage: false });
  console.log('Screenshot: /tmp/skill-03-authed.png');

  // Step 5: Explore page structure
  console.log('\n--- Authenticated page structure ---');

  const headings = await page.$$eval('h1, h2, h3, h4, h5',
    els => els.map(e => `[${e.tagName}] ${e.textContent.trim().substring(0, 80)}`).filter(t => t.length > 4)
  );
  console.log('Headings:', headings);

  const tabs = await page.$$eval('[role="tab"], .p-tabview-nav-link, .p-tabmenu-nav .p-menuitem-text',
    els => els.map(e => e.textContent.trim()).filter(t => t.length > 0)
  );
  console.log('Tabs:', tabs);

  const accordions = await page.$$eval('.p-accordion-header-text, .p-accordion-header-link',
    els => els.map(e => e.textContent.trim().substring(0, 80)).filter(t => t.length > 0)
  );
  console.log('Accordions:', accordions);

  const buttons = await page.$$eval('button, .p-button',
    els => els.map(e => e.textContent.trim().substring(0, 50)).filter(t => t.length > 0 && t.length < 50)
  );
  console.log('Buttons:', buttons);

  // Step 6: Look for chat test button
  console.log('\n--- Chat test ---');
  const chatBtn = await page.$('button:has-text("chat")') || await page.$('text=Configura via chat')
    || await page.$('text=Configure via chat');
  if (chatBtn) {
    console.log('Found chat button:', await chatBtn.textContent());
  }

  // Look for text chat widget / test area
  const chatWidget = await page.$$eval('[class*="chat" i], [class*="webcall" i], [class*="textchat" i]',
    els => els.map(e => ({
      tag: e.tagName, class: (e.className || '').toString().substring(0, 60),
      children: e.children.length
    })).slice(0, 10)
  );
  console.log('Chat widgets:', JSON.stringify(chatWidget, null, 2));

  console.log('\n=== Browser open for inspection. Ctrl+C to close. ===');
  await new Promise(() => {});
})();
