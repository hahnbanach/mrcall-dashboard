// @ts-check
const { defineConfig, devices } = require('@playwright/test')

// The app and the tests have to agree on the Firebase config, and until now
// nothing made them.
//
// tests/e2e/fixtures/auth.js seeds IndexedDB under the key
// `firebase:authUser:${VUE_APP_FIREBASE_API_KEY}:[DEFAULT]`, reading that value
// from this process. Nothing put it here, so it was `undefined`, while the app
// looked up its own real key and found nothing: every authenticated test landed
// on /signin. Serving in development mode made it worse, since there is no .env
// or .env.development in the repo, so the app failed to boot at all with
// auth/invalid-api-key.
//
// Loading .env.test here and serving with the same mode gives both sides one
// source of config truth, and makes the suite runnable on a fresh checkout.
// .env.test wins when present (CI/release flow); otherwise fall back to the
// developer's own .env, which is what `npm run serve` also reads — without this
// fallback the suite silently lands on /signin on any machine that only has .env.
require('dotenv').config({ path: require('fs').existsSync('.env.test') ? '.env.test' : '.env' })

// The one origin the app is served on and the fixtures seed, route and allow: `E2E_PORT` (default
// 8080) when another process holds 8080. Seen 2026-10-22: a Docker container bound [::1]:8080,
// `localhost` resolved there first and the run got 404s mid-suite. Set here, in the config every
// worker also loads, so the fixtures read the same value (`tests/e2e/fixtures/origin.js`).
const E2E_PORT = process.env.E2E_PORT || '8080'
process.env.E2E_BASE_URL = process.env.E2E_BASE_URL || `http://localhost:${E2E_PORT}`

module.exports = defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html', { open: 'never' }], ['list']],

  use: {
    baseURL: process.env.E2E_BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'desktop',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
      },
    },
    // The visual specs run under `desktop` only, and that is not an omission.
    // They loop mobile/tablet/desktop inside each test with setViewportSize, so
    // the project would only change the snapshot filename suffix: running them
    // three times would mean maintaining three identical sets of baselines, 72
    // files instead of 24, all of the same 15 pages at the same 3 widths.
    {
      name: 'tablet',
      testIgnore: /visual\//,
      use: {
        ...devices['iPad (gen 7)'],
        viewport: { width: 768, height: 1024 },
      },
    },
    {
      name: 'mobile',
      testIgnore: /visual\//,
      use: {
        ...devices['iPhone 13'],
        viewport: { width: 375, height: 812 },
      },
    },
  ],

  webServer: {
    command: `npm run serve -- --mode test --port ${new URL(process.env.E2E_BASE_URL).port || '80'}`,
    url: process.env.E2E_BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
})
