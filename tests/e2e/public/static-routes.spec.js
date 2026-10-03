// @ts-check
const fs = require('fs')
const path = require('path')
const { test, expect } = require('@playwright/test')
const { declaredPaths, staticRoutes, isStatic } = require('../../../scripts/static-routes')

// The deploy writes index.html under every key scripts/static-routes.js prints, so a deep link
// answers 200 instead of the bucket's 404. That script reads the router as source; this test
// holds it to the router the running app actually built. A route the script misses would go
// back to answering 404; one it invents would be a key serving the app for no route.
//
// Seen failing on 2026-10-03 with the script made to drop /signin: the comparison reports
// "/signin" missing. (Dropping the first route showed nothing, because that one is "/".)

const ROUTER = path.join(__dirname, '..', '..', '..', 'src', 'router', 'index.js')

test.describe('Static routes written by the deploy', () => {
  test('match the static routes of the running router, one key each', async ({ page }) => {
    await page.goto('/')
    await page.waitForFunction(() => {
      const app = /** @type {any} */ (document.querySelector('#app'))
      return app && app.__vue_app__ && app.__vue_app__.config.globalProperties.$router
    })
    const runtime = await page.evaluate(() => {
      const app = /** @type {any} */ (document.querySelector('#app'))
      return app.__vue_app__.config.globalProperties.$router.getRoutes().map(r => r.path)
    })

    const fromRouter = [...new Set(runtime.filter(isStatic))].sort()
    expect(staticRoutes()).toEqual(fromRouter)

    // Read from the declaration, not from the set it collapses into: two routes on one path
    // would silently become one key.
    const declared = declaredPaths(fs.readFileSync(ROUTER, 'utf8'))
    const duplicated = declared.filter((p, i) => declared.indexOf(p) !== i)
    expect(duplicated).toEqual([])
  })
})
