// @ts-check
const { expect } = require('@playwright/test')
const { test, setupAuthPage } = require('../fixtures/auth')
const { mockResellerUser } = require('../fixtures/mock-data')
const { mockInsights, BUSINESS_ID, OUTCOMES } = require('../fixtures/insights')
const { mockClassifications } = require('../fixtures/classifications')

/**
 * U19r6 of StarChat's plan docs/execution-plans/2026-10-24-insights-reports-ux.md, the brief's amendment of 2026-10-30,
 * m2: every text of the insights screens at least 4.5:1 against what it is drawn on (3:1 for large text), measured in
 * the page as the U19c attack measured it (the computed colour over the first opaque background up the tree). Desktop
 * only: the colours do not change with the width.
 *
 * Seen failing on c0a4e35: the green delta (1.81:1), the grey notes and group titles on the page's background
 * (3.7-3.8:1), the filter chips' names, the active tab.
 */
async function lowContrast (page) {
  return page.evaluate(() => {
    const parse = (c) => {
      const m = c.match(/rgba?\(([^)]+)\)/)
      if (!m) return null
      const p = m[1].split(',').map(Number)
      return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }
    }
    const lum = ({ r, g, b }) => {
      const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) }
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
    }
    const bgOf = (el) => {
      const layers = []
      for (let e = el; e; e = e.parentElement) {
        const c = parse(getComputedStyle(e).backgroundColor)
        if (c && c.a > 0) { layers.push(c); if (c.a >= 1) break }
      }
      let base = { r: 255, g: 255, b: 255 }
      for (const l of layers.reverse()) base = { r: l.r * l.a + base.r * (1 - l.a), g: l.g * l.a + base.g * (1 - l.a), b: l.b * l.a + base.b * (1 - l.a) }
      return base
    }
    const out = []
    for (const root of document.querySelectorAll('.insights-ui')) {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
      let n
      while ((n = walker.nextNode())) {
        const text = n.textContent.trim()
        if (!text) continue
        const el = n.parentElement
        const cs = getComputedStyle(el)
        if (cs.visibility === 'hidden' || el.offsetParent === null || parseFloat(cs.opacity) === 0) continue
        if (el.closest('[aria-hidden="true"], .visually-hidden, .p-disabled, :disabled')) continue
        const fg = parse(cs.color)
        if (!fg) continue
        const bg = bgOf(el)
        const mixed = { r: fg.r * fg.a + bg.r * (1 - fg.a), g: fg.g * fg.a + bg.g * (1 - fg.a), b: fg.b * fg.a + bg.b * (1 - fg.a) }
        const L1 = lum(mixed)
        const L2 = lum(bg)
        const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05)
        const size = parseFloat(cs.fontSize)
        const bold = parseInt(cs.fontWeight) >= 700
        const need = size >= 24 || (bold && size >= 18.66) ? 3 : 4.5
        if (ratio < need) out.push(`${ratio.toFixed(2)} ${cs.color} on rgb(${bg.r | 0},${bg.g | 0},${bg.b | 0}) "${text.slice(0, 30)}"`)
      }
    }
    return out
  })
}

test.describe('m2: contrast of the insights screens', () => {
  test.skip(({ viewport }) => (viewport ? viewport.width < 1024 : false), 'colours do not change with the width')

  test('the reseller\'s scope page', async ({ page }) => {
    await setupAuthPage(page, mockResellerUser, 'reseller')
    await mockInsights(page, { role: 'reseller', outcomes: { ...OUTCOMES, message: { ...OUTCOMES.message, previousTotals: { complete: 40, incomplete: 3, none: 50 } } } })
    await mockClassifications(page, { role: 'reseller' })
    await page.goto('/analytics')
    await expect(page.getByRole('table', { name: 'Assistants to review' })).toBeVisible({ timeout: 15000 })
    await page.waitForTimeout(500)
    expect(await lowContrast(page)).toEqual([])
  })

  test('a business\'s Report tab', async ({ authenticatedPage: page }) => {
    await mockInsights(page)
    await page.goto(`/analytics?id=${BUSINESS_ID}&tab=reports`)
    await expect(page.getByRole('table', { name: 'All reports' })).toBeVisible({ timeout: 15000 })
    await page.waitForTimeout(500)
    expect(await lowContrast(page)).toEqual([])
  })
})
