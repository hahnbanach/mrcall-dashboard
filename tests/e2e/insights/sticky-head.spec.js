// @ts-check
const { expect } = require('@playwright/test')
const { test } = require('../fixtures/auth')
const { mockInsights, REPORT, BUSINESS_ID } = require('../fixtures/insights')

/**
 * Brief docs/briefs/2026-10-31-analytics-ux.md, O4 (plan step A4, its first measurement): on the desktop and tablet
 * viewports a table's header row stays in view under the page's sticky filter bar while its rows scroll under it, and
 * the assistants table's frozen business column stays frozen when the table is scrolled sideways. The page scrolls
 * inside #app-central-content, not the window. Under 641 px the rows are cards and there is no header row to keep.
 *
 * Seen failing, 2026-11-01, with v-sticky-head taken off PagedTable: the header's top 120 px above the bar's bottom,
 * scrolled away with the page. With it, measured on desktop (Chromium, 1440 px: the table fits, no sideways scroll)
 * and tablet (WebKit, 768 px: sideways scroll), the header at the bar and the frozen column at the wrapper's left edge:
 * the translated header cells and the sticky-left column do not interfere, so the plan's fallback is not needed.
 */
async function geometry (page, table) {
  return page.evaluate((caption) => {
    const t = [...document.querySelectorAll('table')].find((x) => x.querySelector('caption') && x.querySelector('caption').textContent.trim() === caption)
    const bar = document.querySelector('.analytics-filter-bar')
    const wrapper = t.parentElement
    const th = t.querySelector('thead th')
    const firstBodyBusiness = t.querySelector('tbody td')
    return {
      barBottom: bar.getBoundingClientRect().bottom,
      tableTop: t.getBoundingClientRect().top,
      tableBottom: t.getBoundingClientRect().bottom,
      headTop: th.getBoundingClientRect().top,
      headLeft: th.getBoundingClientRect().left,
      bodyLeft: firstBodyBusiness.getBoundingClientRect().left,
      wrapperLeft: wrapper.getBoundingClientRect().left,
      canScrollSideways: wrapper.scrollWidth > wrapper.clientWidth,
      viewport: window.innerHeight,
    }
  }, table)
}

test.describe('a table\'s header stays in view', () => {
  test('the assistants table: header under the filter bar while its rows scroll, business column frozen sideways', async ({ adminPage: page }) => {
    test.skip(page.viewportSize().width < 641, 'phones draw the rows as cards, with no header row')
    await mockInsights(page, { role: 'admin' })
    await page.goto('/analytics-admin')
    const table = page.getByRole('table', { name: 'Assistants to review' })
    await expect(table.getByRole('row')).toHaveCount(11, { timeout: 15000 })

    // with the mocks the page ends soon after the table, so the container could not scroll the table under the bar: a
    // spacer after the page's content gives it the room a real page has (it changes nothing above it)
    await page.evaluate(() => {
      const spacer = document.createElement('div')
      spacer.style.minHeight = '2000px'
      spacer.style.flexShrink = '0' // #app-central-content is a flex container: an empty item would shrink to nothing
      document.getElementById('app-central-content').appendChild(spacer)
    })
    // the table's top 120 px above the bar's bottom: rows are still on screen, the header must sit at the bar
    await page.evaluate(() => {
      const t = [...document.querySelectorAll('table')].find((x) => x.querySelector('caption') && x.querySelector('caption').textContent.trim() === 'Assistants to review')
      const scroller = document.getElementById('app-central-content')
      const bar = document.querySelector('.analytics-filter-bar')
      // the bar is sticky: it moves with the page until it reaches the container's top, so the distance is taken again
      // until it holds
      for (let i = 0; i < 4; i++) scroller.scrollTop += t.getBoundingClientRect().top - bar.getBoundingClientRect().bottom + 120
    })
    await expect.poll(async () => {
      const g = await geometry(page, 'Assistants to review')
      return Math.round(g.headTop - g.barBottom)
    }).toBe(0)
    let g = await geometry(page, 'Assistants to review')
    expect(g.tableTop).toBeLessThan(g.barBottom - 100)
    expect(g.tableBottom).toBeGreaterThan(g.barBottom + 100)

    // sideways: the business cells, header and body, stay at the wrapper's left edge
    // at 1440 px the table fits its 1280 px card; at the tablet's 768 px it scrolls sideways, and that case must run
    if (page.viewportSize().width < 1000) expect(g.canScrollSideways).toBe(true)
    if (g.canScrollSideways) {
      await page.evaluate(() => {
        const t = [...document.querySelectorAll('table')].find((x) => x.querySelector('caption') && x.querySelector('caption').textContent.trim() === 'Assistants to review')
        t.parentElement.scrollLeft = 300
      })
      await page.waitForTimeout(100)
      g = await geometry(page, 'Assistants to review')
      expect(Math.round(g.headLeft - g.wrapperLeft)).toBeLessThanOrEqual(1)
      expect(Math.round(g.bodyLeft - g.wrapperLeft)).toBeLessThanOrEqual(1)
      expect(Math.round(g.headTop - g.barBottom)).toBe(0)
    }

    // back to the top: the header returns to its place above the first row
    await page.evaluate(() => { document.getElementById('app-central-content').scrollTop = 0 })
    await expect.poll(async () => {
      const g2 = await geometry(page, 'Assistants to review')
      return Math.round(g2.headTop - g2.tableTop)
    }).toBeLessThanOrEqual(1)
  })

  test('the report page, which has no filter bar: the quality table\'s header stops at the scroll container\'s top, below the navbar', async ({ authenticatedPage: page }) => {
    test.skip(page.viewportSize().width < 641, 'phones draw the rows as cards, with no header row')
    await mockInsights(page)
    await page.goto(`/analytics/report?id=${BUSINESS_ID}&start=${REPORT.periodStart}&requestId=job-req-1`)
    const name = 'Questions without an answer, compared with the period before'
    await expect(page.getByRole('table', { name })).toBeVisible({ timeout: 15000 })
    const read = () => page.evaluate((caption) => {
      const t = [...document.querySelectorAll('table')].find((x) => x.querySelector('caption') && x.querySelector('caption').textContent.trim() === caption)
      const scroller = document.getElementById('app-central-content')
      const navbar = document.getElementById('navbar')
      return {
        containerTop: scroller.getBoundingClientRect().top,
        navbarBottom: navbar ? navbar.getBoundingClientRect().bottom : 0,
        tableTop: t.getBoundingClientRect().top,
        tableHeight: t.getBoundingClientRect().height,
        headTop: t.querySelector('thead th').getBoundingClientRect().top,
        headHeight: t.querySelector('thead th').getBoundingClientRect().height,
      }
    }, name)
    await page.evaluate((caption) => {
      const scroller = document.getElementById('app-central-content')
      const spacer = document.createElement('div')
      spacer.style.minHeight = '2000px'
      spacer.style.flexShrink = '0' // #app-central-content is a flex container: an empty item would shrink to nothing
      scroller.appendChild(spacer)
      const t = [...document.querySelectorAll('table')].find((x) => x.querySelector('caption') && x.querySelector('caption').textContent.trim() === caption)
      // the table's top 20 px above the container's top, its rows still on screen
      scroller.scrollTop += t.getBoundingClientRect().top - scroller.getBoundingClientRect().top + 20
    }, name)
    await expect.poll(async () => { const g = await read(); return Math.round(g.headTop - g.containerTop) }).toBe(0)
    const g = await read()
    expect(g.tableTop).toBeLessThan(g.containerTop)
    expect(g.tableTop + g.tableHeight).toBeGreaterThan(g.containerTop + g.headHeight)
    expect(g.headTop).toBeGreaterThanOrEqual(g.navbarBottom - 1)
  })
  // The final review (2026-11-03) found these two scrolling away: the Quality table and the calls without a
  // conversation, both rewritten as ruled tables after the last milestone review, without v-sticky-head.
  for (const caption of ['Quality', 'Calls without a conversation']) {
    test(`the owner's "${caption}" table: header under the filter bar while its rows scroll`, async ({ authenticatedPage: page }) => {
      test.skip(page.viewportSize().width < 641, 'phones draw the rows as cards, with no header row')
      await mockInsights(page)
      await page.goto(`/analytics?id=${BUSINESS_ID}`)
      const table = page.getByRole('table', { name: caption, exact: true })
      await expect(table).toBeVisible({ timeout: 15000 })
      await page.evaluate((name) => {
        const spacer = document.createElement('div')
        spacer.style.minHeight = '2000px'
        spacer.style.flexShrink = '0' // #app-central-content is a flex container: an empty item would shrink to nothing
        document.getElementById('app-central-content').appendChild(spacer)
        const t = [...document.querySelectorAll('table')].find((x) => x.querySelector('caption') && x.querySelector('caption').textContent.trim() === name)
        const scroller = document.getElementById('app-central-content')
        const bar = document.querySelector('.analytics-filter-bar')
        // the table's top past the bar by a third of its height (at most 80 px): rows still on screen below the header
        const past = Math.min(80, Math.round(t.getBoundingClientRect().height / 3))
        for (let i = 0; i < 4; i++) scroller.scrollTop += t.getBoundingClientRect().top - bar.getBoundingClientRect().bottom + past
      }, caption)
      await expect.poll(async () => {
        const g = await geometry(page, caption)
        return Math.round(g.headTop - g.barBottom)
      }).toBe(0)
      const g = await geometry(page, caption)
      expect(g.tableTop).toBeLessThan(g.barBottom)
    })
  }
})
