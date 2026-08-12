// @ts-check
const { test: base } = require('@playwright/test')
const {
  mockUser,
  mockAdminUser,
  mockResellerUser,
  mockBusiness,
  mockSubscription,
  mockConversation,
  mockContact,
  mockAnalyticsKpi,
  mockTemplateVariable,
  mockResellerProfile,
  mockInvitationCode,
} = require('./mock-data')

// Must match the Firebase config the app is built with. This is a public
// identifier, not a secret: Firebase web API keys are protected by Security
// Rules and authorized domains. Read from the environment anyway, so the repo
// holds no copy of any project's configuration.
const FIREBASE_API_KEY = process.env.VUE_APP_FIREBASE_API_KEY
const FIREBASE_APP_NAME = '[DEFAULT]'

/**
 * Build the IndexedDB record that Firebase Auth SDK expects.
 * Firebase stores auth users in IndexedDB database "firebaseLocalStorageDb",
 * object store "firebaseLocalStorage", with key format:
 *   firebase:authUser:{apiKey}:{appName}
 */
function buildFirebaseUserRecord(user) {
  const now = Date.now()
  return {
    fbase_key: `firebase:authUser:${FIREBASE_API_KEY}:${FIREBASE_APP_NAME}`,
    value: {
      uid: user.uid,
      email: user.email,
      emailVerified: user.emailVerified,
      displayName: user.displayName,
      isAnonymous: user.isAnonymous,
      photoURL: null,
      phoneNumber: null,
      tenantId: null,
      providerData: user.providerData.map(p => ({
        providerId: p.providerId,
        uid: p.email || user.uid,
        displayName: user.displayName,
        email: p.email,
        phoneNumber: null,
        photoURL: null,
      })),
      stsTokenManager: {
        refreshToken: 'mock-refresh-token',
        accessToken: user.accessToken || 'mock-id-token',
        expirationTime: now + 3600 * 1000,
      },
      createdAt: String(now - 86400000),
      lastLoginAt: String(now),
      apiKey: FIREBASE_API_KEY,
      appName: FIREBASE_APP_NAME,
    },
  }
}

/**
 * Seeds Firebase Auth's IndexedDB so the SDK finds a persisted user on init.
 * Must run on the same origin as the app (http://localhost:8080).
 */
async function seedFirebaseIndexedDB(page, user) {
  const record = buildFirebaseUserRecord(user)
  await page.evaluate(async (record) => {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('firebaseLocalStorageDb', 1)
      request.onupgradeneeded = (event) => {
        const db = event.target.result
        if (!db.objectStoreNames.contains('firebaseLocalStorage')) {
          db.createObjectStore('firebaseLocalStorage', { keyPath: 'fbase_key' })
        }
      }
      request.onsuccess = (event) => {
        const db = event.target.result
        const txn = db.transaction('firebaseLocalStorage', 'readwrite')
        const store = txn.objectStore('firebaseLocalStorage')
        store.put(record)
        txn.oncomplete = () => { db.close(); resolve() }
        txn.onerror = (e) => { db.close(); reject(e.target.error) }
      }
      request.onerror = (event) => reject(event.target.error)
    })
  }, record)
}

/**
 * Intercept Firebase Auth REST endpoints so the SDK never hits real servers.
 */
async function interceptFirebaseEndpoints(page, user) {
  const now = Date.now()

  // Token refresh
  await page.route('**/securetoken.googleapis.com/**', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        access_token: user.accessToken || 'mock-id-token',
        expires_in: '3600',
        token_type: 'Bearer',
        refresh_token: 'mock-refresh-token',
        id_token: user.accessToken || 'mock-id-token',
        user_id: user.uid,
        project_id: 'mrcall-project',
      }),
    })
  })

  // Account lookup & other identity toolkit calls
  await page.route('**/identitytoolkit.googleapis.com/**', (route) => {
    const url = route.request().url()
    if (url.includes('accounts:lookup')) {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          kind: 'identitytoolkit#GetAccountInfoResponse',
          users: [{
            localId: user.uid,
            email: user.email,
            emailVerified: user.emailVerified,
            displayName: user.displayName,
            providerUserInfo: user.providerData.map(p => ({
              providerId: p.providerId,
              federatedId: p.email,
              email: p.email,
              rawId: p.email,
            })),
            photoUrl: '',
            validSince: String(Math.floor((now - 86400000) / 1000)),
            lastLoginAt: String(now),
            createdAt: String(now - 86400000),
            lastRefreshAt: new Date().toISOString(),
          }],
        }),
      })
    } else {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          idToken: user.accessToken || 'mock-id-token',
          refreshToken: 'mock-refresh-token',
          expiresIn: '3600',
          localId: user.uid,
        }),
      })
    }
  })

  // Block external services
  await page.route('**/firebaseinstallations.googleapis.com/**', route => route.abort())
  await page.route('**/google-analytics.com/**', route => route.abort())
  await page.route('**/googletagmanager.com/**', route => route.abort())
  await page.route('**/googleapis.com/identitytoolkit/**', route => route.abort())
}

/**
 * Sets up API route mocking for all StarChat endpoints.
 * Route order matters: more specific routes must be registered first.
 * The actual API returns data directly (not wrapped in { result: [...] }).
 */
async function setupApiMocks(page, overrides = {}) {
  // IMPORTANT: Playwright tests routes in REVERSE registration order (LIFO).
  // Register catch-all/generic routes FIRST (checked last),
  // and specific routes LAST (checked first).

  // Catch-all for any other mrcall API calls (registered first, checked last)
  await page.route('**/mrcall/v1/**', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    })
  })

  // Stripe endpoints
  await page.route('**/stripe/**', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({}),
    })
  })

  // Admin endpoints
  await page.route('**/crm/admin/user*', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(overrides.users || []),
    })
  })

  await page.route('**/crm/admin/reseller*', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(overrides.resellers || [mockResellerProfile]),
    })
  })

  // Reseller endpoints
  await page.route('**/crm/reseller/owner*', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(overrides.managedOwners || []),
    })
  })

  await page.route('**/crm/reseller/code*', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(overrides.invitationCodes || [mockInvitationCode]),
    })
  })

  await page.route('**/crm/reseller/profile*', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(overrides.resellerProfile || mockResellerProfile),
    })
  })

  // Analytics
  await page.route('**/crm/analytics*', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(overrides.analytics || mockAnalyticsKpi),
    })
  })

  // Contacts
  await page.route('**/crm/contact*', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(overrides.contacts || [mockContact]),
    })
  })

  // Conversations
  await page.route('**/crm/conversation*', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(overrides.conversations || [mockConversation]),
    })
  })

  // Template variables
  await page.route('**/crm/variable*', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(overrides.templateVariables || [mockTemplateVariable]),
    })
  })

  // Templates
  await page.route('**/crm/template*', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(overrides.templates || [{
        name: 'generic_onboarding',
        humanName: 'Generic Assistant',
        description: 'A generic assistant template',
      }]),
    })
  })

  // Customer record
  await page.route('**/crm/customer*', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(overrides.customer || { stripePartnerPromotionCode: null }),
    })
  })

  // Business CRUD - GET/POST/PUT /business (generic, checked after specific)
  await page.route('**/crm/business*', (route) => {
    if (route.request().method() === 'GET') {
      // GET /crm/business?id= answers with an array, which is why
      // Business.getBusiness does response.data.find(...). Returning a bare
      // object made that throw, the promise rejected, and any page waiting on it
      // sat on its spinner forever, with no failed request to point at.
      const detail = overrides.businessDetail || mockBusiness
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(Array.isArray(detail) ? detail : [detail]),
      })
    } else {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockBusiness),
      })
    }
  })

  // Business search - POST /business/search (specific, checked before generic)
  // Returns array of business objects, each with totalHits
  await page.route('**/crm/business/search*', (route) => {
    const businesses = overrides.businesses || [{ ...mockBusiness, totalHits: 1 }]
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(businesses),
      headers: { 'x-mrcall-role': 'owner' },
    })
  })

  // Business resources count - POST /business/resources/count
  // Returns a number directly
  await page.route('**/crm/business/resources/count*', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(100),
    })
  })

  // Business subscription info - GET /business/subscription?id=X
  // Returns subscription object directly (registered last, checked first)
  await page.route('**/crm/business/subscription*', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(overrides.subscription || mockSubscription),
    })
  })
}

/**
 * Setup an authenticated page fixture.
 *
 * Strategy:
 * 1. Serve a stub page on the app origin to get the right IndexedDB scope
 * 2. Seed Firebase's IndexedDB with a mock user record
 * 3. Intercept Firebase REST endpoints + StarChat API
 * 4. When the app loads, Firebase reads IndexedDB, finds the user,
 *    fires onAuthStateChanged(user), and authIsReady becomes true
 */
async function setupAuthPage(page, user, role) {
  // Serve a minimal HTML page on the app origin to seed IndexedDB
  await page.route('**/localhost:8080/__e2e_seed__', route => {
    route.fulfill({ status: 200, contentType: 'text/html', body: '<html><body></body></html>' })
  })
  await page.goto('http://localhost:8080/__e2e_seed__')

  // Seed Firebase IndexedDB on the correct origin
  await seedFirebaseIndexedDB(page, user)

  // Remove the seed route
  await page.unroute('**/localhost:8080/__e2e_seed__')

  // Set up all network interceptions
  await interceptFirebaseEndpoints(page, user)
  await setupApiMocks(page)
}

const test = base.extend({
  authenticatedPage: async ({ page }, use) => {
    await setupAuthPage(page, mockUser, 'owner')
    await use(page)
  },

  adminPage: async ({ page }, use) => {
    await setupAuthPage(page, mockAdminUser, 'admin')
    await use(page)
  },

  resellerPage: async ({ page }, use) => {
    await setupAuthPage(page, mockResellerUser, 'reseller')
    await use(page)
  },
})

module.exports = {
  test,
  setupApiMocks,
  setupAuthPage,
  seedFirebaseIndexedDB,
  interceptFirebaseEndpoints,
  buildFirebaseUserRecord,
}
