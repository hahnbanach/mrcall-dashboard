// @ts-check
const { expect } = require('@playwright/test')
const { test } = require('../fixtures/auth')
const { mockInsights, BUSINESS_ID } = require('../fixtures/insights')
const { mockClassifications } = require('../fixtures/classifications')

/**
 * Every chart fills its box and stays inside it. PrimeVue's Chart puts the canvas in a `.p-chart` wrapper with no
 * height; with `maintainAspectRatio: false` Chart.js took the wrapper's height, which was the canvas's own, so a chart
 * kept whatever height its first measure found: 150 px in a 278 px box on test (2026-11-01), sometimes far taller than
 * its box, over the hourly map below it, until a reload. Measured on the admin page, the scope page and a business's
 * Overview.
 *
 * Seen failing, 2026-11-01, before `.chart-container > .p-chart` took its box's height: every canvas 150 px high.
 */
async function charts (page) {
  return page.evaluate(() => [...document.querySelectorAll('.chart-container')].map((box) => {
    const canvas = box.querySelector('canvas')
    const style = getComputedStyle(box)
    const content = box.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom)
    const b = box.getBoundingClientRect()
    const c = canvas.getBoundingClientRect()
    return { content: Math.round(content), canvas: Math.round(c.height), inside: c.top >= b.top - 1 && c.bottom <= b.bottom + 1 }
  }))
}

async function expectChartsFit (page) {
  await expect.poll(async () => (await charts(page)).length, { timeout: 15000 }).toBeGreaterThan(0)
  // Chart.js resizes on the next frame: poll until every canvas fills its box
  await expect.poll(async () => (await charts(page)).every((c) => c.inside && Math.abs(c.canvas - c.content) <= 2), { timeout: 10000 }).toBe(true)
}

test.describe('every chart fills its box and stays inside it', () => {
  test('the admin page', async ({ adminPage: page }) => {
    await mockInsights(page, { role: 'admin' })
    await mockClassifications(page, { role: 'admin' })
    await page.goto('/analytics-admin')
    await expectChartsFit(page)
  })

  test('a business\'s Overview', async ({ authenticatedPage: page }) => {
    await mockInsights(page)
    await page.goto(`/analytics?id=${BUSINESS_ID}`)
    await expectChartsFit(page)
  })

  test('the reseller\'s scope page', async ({ resellerPage: page }) => {
    await mockInsights(page, { role: 'reseller' })
    await mockClassifications(page, { role: 'reseller' })
    await page.goto('/analytics')
    await expectChartsFit(page)
  })
})
