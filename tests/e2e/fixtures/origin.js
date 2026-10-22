// The origin the app is served on, the one the Playwright config sets (`E2E_PORT`, default 8080):
// the fixtures seed IndexedDB on it, route its test-only paths and let only it through.
const ORIGIN = process.env.E2E_BASE_URL || 'http://localhost:8080'
const HOST = new URL(ORIGIN).host

module.exports = { ORIGIN, HOST }
