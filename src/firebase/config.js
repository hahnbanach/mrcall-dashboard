import { initializeApp } from 'firebase/app'
import { browserLocalPersistence, initializeAuth, indexedDBLocalPersistence } from 'firebase/auth'

// Firebase config from environment variables
const firebaseConfig = {
  apiKey: process.env.VUE_APP_FIREBASE_API_KEY,
  authDomain: process.env.VUE_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VUE_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VUE_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VUE_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VUE_APP_FIREBASE_APP_ID,
  measurementId: process.env.VUE_APP_FIREBASE_MEASUREMENT_ID
};

// init firebase
const app = initializeApp(firebaseConfig)

// init firebase auth
const auth = initializeAuth(app, {
  persistence: [indexedDBLocalPersistence, browserLocalPersistence]
})
auth.useDeviceLanguage()

// No setPersistence after initializeAuth: it moved the persisted user to localStorage after the SDK had chosen
// IndexedDB, one more write at every start. The SDK finds a user in either persistence of the list and moves it to the
// first available, so a session that releases up to v2.2.47 kept in localStorage survives (plan
// docs/execution-plans/2026-10-23-dashboard-load.md, M6; tests/e2e/public/persisted-session.spec.js).

export { auth }