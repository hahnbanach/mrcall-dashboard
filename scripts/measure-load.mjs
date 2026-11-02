#!/usr/bin/env node
// Load-time instrument of the dashboard load work (docs/execution-plans/2026-10-23-dashboard-load.md, "Measurement
// protocol"; the brief's acceptance 3 and 4). Every gated figure comes from this file and from no other.
//
//   node scripts/measure-load.mjs --base https://dashboard-test.mrcall.ai --page signin --profile 10mbps \
//        [--cold 7] [--warm 5] [--locale en-US] [--out results.json]
//
// Pages: `signin` needs no session. `businesses` and `analytics` sign in fresh in each run's own context, with
// MEASURE_EMAIL and MEASURE_PASSWORD read from the environment at run time: never an argument, never written, never
// printed. A fresh sign-in keeps the ID token under an hour old, so Firebase's start-up makes no expiry refresh
// (the protocol's "Session state").
//
// Per run it reports: the first child of #app (the splash, once there is one), the page's figure (the sign-in form,
// the first business card, the first analytics figure), bytes and requests, the securetoken and accounts:lookup
// calls, and every JavaScript chunk fetched before the figure that index.html does not name, with its encoded
// (gzip) bytes, its timings and the script that asked for it. The brief's T and R are computed from that list.
import { chromium } from '@playwright/test'
import { writeFileSync } from 'node:fs'
import { loadavg } from 'node:os'

const args = Object.fromEntries(process.argv.slice(2).reduce((pairs, arg, i, all) => {
  if (arg.startsWith('--')) pairs.push([arg.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : 'true'])
  return pairs
}, []))
const base = (args.base || '').replace(/\/$/, '')
const pageName = args.page || 'signin'
const profile = args.profile || 'unthrottled'
const coldRuns = Number(args.cold ?? 7)
const warmRuns = Number(args.warm ?? 5)
const locale = args.locale || 'en-US'
if (!base) throw new Error('--base is required')

const PROFILES = {
  unthrottled: null,
  // CDP emulation, down and up, as the protocol fixes it
  '10mbps': { downloadThroughput: 10e6 / 8, uploadThroughput: 10e6 / 8, latency: 40 },
}
if (!(profile in PROFILES)) throw new Error(`--profile must be one of ${Object.keys(PROFILES).join(', ')}`)

const PAGES = {
  signin: { path: '/signin', figure: '#email, input[type=password]', session: false },
  businesses: { path: '/businesses', figure: '.business-card', session: true },
  analytics: { path: '/analytics', figure: '.kpi-value', session: true },
}
const target = PAGES[pageName]
if (!target) throw new Error(`--page must be one of ${Object.keys(PAGES).join(', ')}`)
if (target.session && !(process.env.MEASURE_EMAIL && process.env.MEASURE_PASSWORD)) {
  throw new Error(`--page ${pageName} needs MEASURE_EMAIL and MEASURE_PASSWORD in the environment`)
}

// Marks the two moments in page time, from the first byte of the document on.
const OBSERVER = (figure) => {
  window.__load = {}
  const visible = (el) => el && el.getClientRects().length > 0
  const look = () => {
    const app = document.getElementById('app')
    if (!window.__load.child && app && app.firstElementChild) window.__load.child = performance.now()
    if (!window.__load.figure && [...document.querySelectorAll(figure)].some(visible)) window.__load.figure = performance.now()
  }
  new MutationObserver(look).observe(document, { childList: true, subtree: true, attributes: true })
}

async function signIn (page) {
  await page.goto(base + '/signin', { waitUntil: 'domcontentloaded', timeout: 120000 })
  await page.locator('#email').fill(process.env.MEASURE_EMAIL)
  await page.locator('input[type=password]').fill(process.env.MEASURE_PASSWORD)
  await page.locator('input[type=password]').press('Enter')
  await page.waitForURL((url) => !/\/(signin|login)/.test(url.pathname), { timeout: 120000 })
}

async function run (browser, kind, context) {
  const page = await context.newPage()
  const cdp = await context.newCDPSession(page)
  await cdp.send('Network.enable')
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: kind === 'cold' })
  const net = PROFILES[profile]
  if (net) await cdp.send('Network.emulateNetworkConditions', { offline: false, ...net })

  const requests = new Map()
  cdp.on('Network.requestWillBeSent', (e) => {
    const stack = e.initiator && e.initiator.stack && e.initiator.stack.callFrames && e.initiator.stack.callFrames[0]
    requests.set(e.requestId, { url: e.request.url, start: e.timestamp, initiator: (stack && stack.url) || e.initiator.url || e.initiator.type })
  })
  cdp.on('Network.loadingFinished', (e) => {
    const r = requests.get(e.requestId)
    if (r) Object.assign(r, { end: e.timestamp, bytes: e.encodedDataLength })
  })
  cdp.on('Network.responseReceived', (e) => {
    const r = requests.get(e.requestId)
    if (r) r.status = e.response.status
  })

  await page.addInitScript(OBSERVER, target.figure)
  const t0 = Date.now()
  await page.goto(base + target.path, { timeout: 120000 })
  await page.waitForFunction(() => window.__load && window.__load.figure, null, { timeout: 120000 })
  const marks = await page.evaluate(() => ({
    child: window.__load.child ?? null,
    figure: window.__load.figure,
    navStart: performance.timeOrigin / 1000,
    initialScripts: [...document.querySelectorAll('script[src]')].map((s) => s.src),
  }))
  await page.waitForTimeout(500)
  await page.close()

  const all = [...requests.values()]
  const at = (ts) => Math.round((ts - all[0].start) * 1000)
  const figureAt = marks.figure
  const initial = new Set(marks.initialScripts)
  const chunks = all
    .filter((r) => /\.js(\?|$)/.test(r.url) && !initial.has(r.url) && r.url.startsWith(base) && r.end && at(r.end) <= figureAt)
    .map((r) => ({ file: r.url.split('/').pop(), bytes: r.bytes, start: at(r.start), end: at(r.end), initiator: (r.initiator || '').split('/').pop() }))
  return {
    kind,
    child: marks.child === null ? null : Math.round(marks.child),
    figure: Math.round(figureAt),
    bytes: all.reduce((sum, r) => sum + (r.bytes || 0), 0),
    requests: all.length,
    securetoken: all.filter((r) => r.url.includes('securetoken.googleapis.com')).length,
    accountsLookup: all.filter((r) => r.url.includes('accounts:lookup')).length,
    chunksBeforeFigure: chunks,
    wall: Date.now() - t0,
  }
}

const browser = await chromium.launch()
const result = {
  base, page: pageName, profile, locale,
  chromium: browser.version(),
  loadAverage1m: Number(loadavg()[0].toFixed(2)),
  at: new Date().toISOString(),
  runs: [],
}
for (let i = 0; i < coldRuns; i++) {
  const context = await browser.newContext({ locale })
  if (target.session) await signIn(await context.newPage())
  result.runs.push(await run(browser, 'cold', context))
  await context.close()
}
if (warmRuns > 0) {
  const context = await browser.newContext({ locale })
  if (target.session) await signIn(await context.newPage())
  await run(browser, 'prime', context)
  for (let i = 0; i < warmRuns; i++) result.runs.push(await run(browser, 'warm', context))
  await context.close()
}
await browser.close()

const summary = {}
for (const kind of ['cold', 'warm']) {
  const runs = result.runs.filter((r) => r.kind === kind)
  if (!runs.length) continue
  const stat = (key) => {
    const v = runs.map((r) => r[key]).filter((x) => x !== null).sort((a, b) => a - b)
    return v.length ? { median: v[Math.floor(v.length / 2)], min: v[0], max: v[v.length - 1] } : null
  }
  summary[kind] = { runs: runs.length, child: stat('child'), figure: stat('figure'), bytes: stat('bytes'), requests: stat('requests') }
}
result.summary = summary
if (args.out) writeFileSync(args.out, JSON.stringify(result, null, 2))
console.log(JSON.stringify({ base, page: pageName, profile, locale, loadAverage1m: result.loadAverage1m, summary }, null, 2))
