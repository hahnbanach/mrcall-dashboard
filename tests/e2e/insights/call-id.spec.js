// @ts-check
const { expect } = require('@playwright/test')
const { test } = require('../fixtures/auth')
const { mockClassifications, mockConversations, conversation, BUSINESS_ID } = require('../fixtures/classifications')
const { mockInsights, category, rome } = require('../fixtures/insights')

/**
 * The call id on every call the dashboard draws (docs/briefs/2026-11-06-call-id-copy.md): its first 16 characters
 * shown (more where two ids of the list share them), the whole id in the page and on hover, and a button that copies
 * the whole id and says so. Writes are observed, and refused, by wrapping `navigator.clipboard` the same way on every
 * project: Chromium grants writes to a focused page, WebKit grants the test no clipboard permission.
 */

const LONG = 'CON-2270d4a8-1b2c-4d5e-8f90-123456789abc'
const SANITIZATION = 'sanitization-7c9e6679-7425-40de-944b-e07fc1f90ae7'
const TWIN_A = 'sanitization-abcd1234-0000-4000-8000-000000000001'
const TWIN_B = 'sanitization-abcd1239-0000-4000-8000-000000000002'

const narrow = (page) => page.viewportSize().width < 600

/** `navigator.clipboard` replaced: `__copied` records each write, `__refuseCopy` rejects it, `__noClipboard` removes it. */
async function wrapClipboard (page) {
  await page.addInitScript(() => {
    window.__copied = []
    const fake = {
      writeText: (text) => (window.__refuseCopy ? Promise.reject(new Error('refused')) : (window.__copied.push(text), Promise.resolve())),
    }
    // the API is a getter on Navigator.prototype: an own property on the instance shadows it
    Object.defineProperty(navigator, 'clipboard', { configurable: true, get: () => (window.__noClipboard ? undefined : fake) })
  })
}

const calls = (...specs) => specs.map(([id, name], i) => conversation({
  id, startTimestamp: Date.UTC(2026, 9, 20 - i, 9, 30), contactName: name,
  details: { callerName: name, summary: `Call of ${name}.`, resolution: 'resolved', message: 'none', requests: [], unanswered: [], checks: {} },
}))

async function openList (page, docs, query = '') {
  await mockConversations(page, docs)
  await mockClassifications(page)
  await page.goto(`/conversations?id=${BUSINESS_ID}${query}`)
}

const card = (page, name) => page.locator('.conversations-list .conversation-card').filter({ hasText: `Call of ${name}.` }).first()

/** How many characters of the code's own font its box is wide. */
const widthInChars = (code) => code.evaluate((el) => {
  const probe = document.createElement('span')
  probe.style.font = getComputedStyle(el).font
  probe.style.position = 'absolute'
  probe.style.whiteSpace = 'pre'
  probe.textContent = '0'.repeat(100)
  document.body.appendChild(probe)
  const one = probe.getBoundingClientRect().width / 100
  probe.remove()
  return el.getBoundingClientRect().width / one
})

test.describe('the call id on the conversations page', () => {
  test('a row shows the first 16 characters and the ellipsis, the whole id in the page and on hover', async ({ authenticatedPage: page }, testInfo) => {
    await wrapClipboard(page)
    await openList(page, calls([LONG, 'Anna']))
    const row = card(page, 'Anna')
    const code = row.locator('.call-id')
    await expect(code).toBeVisible({ timeout: 15000 })
    await expect(code).toHaveText(LONG)
    await expect(code).toHaveAttribute('title', LONG)
    const chars = await widthInChars(code)
    // 16 characters and the ellipsis's room, not 15 and the ellipsis
    expect(chars).toBeGreaterThan(16.5)
    expect(chars).toBeLessThan(17.5)
    await expect(row.getByRole('button', { name: `Copy call id ${LONG.slice(0, 16)}…`, exact: true })).toBeVisible()
    await row.locator('.call-id-row').screenshot({ path: testInfo.outputPath('call-id-row.png') })
  })

  test('the button copies the whole id and says so, in a region present before; then the text goes', async ({ authenticatedPage: page }) => {
    await wrapClipboard(page)
    await openList(page, calls([LONG, 'Anna']))
    const row = card(page, 'Anna')
    const status = row.locator('.call-id-status')
    await expect(status).toHaveCount(1, { timeout: 15000 })
    await expect(status).toHaveAttribute('aria-live', 'polite')
    await expect(status).toHaveText('')
    await row.getByRole('button', { name: /^Copy call id / }).click()
    expect(await page.evaluate(() => window.__copied)).toEqual([LONG])
    await expect(status).toHaveText('Copied')
    await expect(status).toHaveText('', { timeout: 4000 })
  })

  test('from the keyboard: the button is in the tab order, and Enter and Space copy', async ({ authenticatedPage: page, browserName }) => {
    await wrapClipboard(page)
    await openList(page, calls([LONG, 'Anna']))
    const button = card(page, 'Anna').getByRole('button', { name: /^Copy call id / })
    await expect(button).toBeVisible({ timeout: 15000 })
    await button.focus()
    if (browserName === 'chromium') {
      // reachable by Tab: leaving it backwards and coming forward lands on it again
      await page.keyboard.press('Shift+Tab')
      await expect(button).not.toBeFocused()
      await page.keyboard.press('Tab')
    }
    await expect(button).toBeFocused()
    await page.keyboard.press('Enter')
    await expect.poll(() => page.evaluate(() => window.__copied.length)).toBe(1)
    await page.keyboard.press('Space')
    await expect.poll(() => page.evaluate(() => window.__copied.length)).toBe(2)
    expect(await page.evaluate(() => window.__copied)).toEqual([LONG, LONG])
  })

  test('a refused copy shows the whole id, selected, and says so', async ({ authenticatedPage: page }, testInfo) => {
    await wrapClipboard(page)
    await page.addInitScript(() => { window.__refuseCopy = true })
    await openList(page, calls([SANITIZATION, 'Bruno']))
    const row = card(page, 'Bruno')
    const code = row.locator('.call-id')
    await expect(code).toBeVisible({ timeout: 15000 })
    await row.getByRole('button', { name: /^Copy call id / }).click()
    await expect(row.locator('.call-id-status')).toHaveText('Could not copy: select the id')
    await expect(code).toHaveClass(/call-id-revealed/)
    expect(await code.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true)
    expect(await page.evaluate(() => window.getSelection().toString())).toBe(SANITIZATION)
    // the whole 49 characters inside the card, and the page not wider than the screen
    const [inner, outer] = [await code.boundingBox(), await row.boundingBox()]
    expect(inner.x).toBeGreaterThanOrEqual(outer.x)
    expect(inner.x + inner.width).toBeLessThanOrEqual(outer.x + outer.width + 0.5)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
    await row.locator('.call-id-row').screenshot({ path: testInfo.outputPath('call-id-revealed.png') })
  })

  test('without a clipboard API, the same failure: the whole id selected and the text', async ({ authenticatedPage: page }) => {
    await wrapClipboard(page)
    await page.addInitScript(() => { window.__noClipboard = true })
    await openList(page, calls([LONG, 'Anna']))
    const row = card(page, 'Anna')
    await row.getByRole('button', { name: /^Copy call id / }).click({ timeout: 15000 })
    await expect(row.locator('.call-id-status')).toHaveText('Could not copy: select the id')
    expect(await page.evaluate(() => window.getSelection().toString())).toBe(LONG)
  })

  test('two ids sharing their first 20 characters show 21 each, and an unrelated one 16', async ({ authenticatedPage: page }) => {
    await wrapClipboard(page)
    await openList(page, calls([TWIN_A, 'Carla'], [TWIN_B, 'Dario'], [LONG, 'Elena']))
    await expect(card(page, 'Carla').getByRole('button', { name: `Copy call id ${TWIN_A.slice(0, 21)}…`, exact: true })).toBeVisible({ timeout: 15000 })
    await expect(card(page, 'Dario').getByRole('button', { name: `Copy call id ${TWIN_B.slice(0, 21)}…`, exact: true })).toBeVisible()
    await expect(card(page, 'Elena').getByRole('button', { name: `Copy call id ${LONG.slice(0, 16)}…`, exact: true })).toBeVisible()
    const chars = await widthInChars(card(page, 'Carla').locator('.call-id'))
    expect(chars).toBeGreaterThan(21.5)
    expect(chars).toBeLessThan(22.5)
  })

  test('the opened call shows its id too', async ({ authenticatedPage: page }) => {
    await wrapClipboard(page)
    await openList(page, calls([LONG, 'Anna']), `&conversation=${LONG}`)
    // the opened call is also a row of the list: only the opened card is looked at
    const opened = page.locator('.opened-card')
    await expect(opened.locator('.call-id')).toHaveText(LONG, { timeout: 15000 })
    await opened.getByRole('button', { name: /^Copy call id / }).click()
    expect(await page.evaluate(() => window.__copied)).toEqual([LONG])
  })

  test('chromium: the real clipboard holds the whole id', async ({ authenticatedPage: page, browserName }) => {
    test.skip(browserName !== 'chromium', 'only Chromium lets a test read the clipboard back')
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
    await openList(page, calls([LONG, 'Anna']))
    await card(page, 'Anna').getByRole('button', { name: /^Copy call id / }).click({ timeout: 15000 })
    await expect(card(page, 'Anna').locator('.call-id-status')).toHaveText('Copied')
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(LONG)
  })

  test('on a phone, a long press on the id does not start the selection; on the header it does', async ({ authenticatedPage: page }) => {
    test.skip(!narrow(page), 'the long press selects only under 600 px')
    await wrapClipboard(page)
    await openList(page, calls([LONG, 'Anna']))
    const row = card(page, 'Anna')
    const checkbox = page.getByRole('checkbox', { name: 'Select the call of Anna' })
    const press = async (locator) => {
      await locator.scrollIntoViewIfNeeded()
      const box = await locator.boundingBox()
      await page.mouse.move(box.x + 10, box.y + box.height / 2)
      await page.mouse.down()
      await page.waitForTimeout(700)
      await page.mouse.up()
    }
    await expect(row.locator('.call-id')).toBeVisible({ timeout: 15000 })
    await press(row.locator('.call-id'))
    await page.waitForTimeout(300)
    await expect(checkbox).toBeHidden()
    // the same press on the card's header does enter the selection mode: the harness presses for real
    await press(row.locator('.card-header'))
    await expect(checkbox).toBeVisible()
  })
})

test.describe('the call id in the analytics call dialog', () => {
  const VIEW = {
    total: 1, asOf: 1761300000000, from: rome(2026, 9, 24), to: rome(2026, 10, 24), calls: 14, businesses: 2, businessesWithCalls: 2, backlog: { calls: 0 },
    items: [category('prices', {
      label: 'Prices and rates', unclassified: false, calls: 14, businesses: 2, share: 0.5, outcomes: { taken: 3, neither: 9, met: 2 },
      dominantOutcome: 'neither', kind: 'business_info', nextActionKind: 'business_info', nextAction: 'Ask the businesses to add their prices',
      examples: [],
    })],
  }
  const REQUESTS = {
    total: 1, calls: 1, asOf: 1761300000001,
    items: [{ requestId: 301, conversationId: 'CON-p1', callStart: rome(2026, 10, 20), businessId: 'biz-2', name: 'Studio Bianchi', text: 'How much is a whitening?', outcome: 'taken', outcomeModel: 'taken', category: 'prices', categoryModel: 'prices', corrected: false, resolution: 'forwarded' }],
  }

  test('admin: a request\'s call shows its short id whole, copyable, read-only', async ({ adminPage: page }, testInfo) => {
    await wrapClipboard(page)
    await mockInsights(page, { role: 'admin', categories: VIEW })
    await mockClassifications(page, { role: 'admin', categoryRequests: () => REQUESTS })
    await mockConversations(page, [], { byId: [conversation({ id: 'CON-p1', owner: 'someone-else', details: { summary: 'Asked the price of a whitening.' } })] })
    await page.goto('/analytics-admin')
    await page.getByRole('region', { name: 'Callers\' requests' }).getByRole('button', { name: 'Show the requests of Prices and rates (14 calls)' }).click()
    const row = page.getByRole('table', { name: 'Requests of Prices and rates' }).getByRole('row').filter({ hasText: 'How much is a whitening?' })
    await row.getByRole('button', { name: 'Open the call: How much is a whitening?' }).click({ timeout: 15000 })
    const dialog = page.locator('.call-dialog')
    await expect(dialog).toContainText('Asked the price of a whitening.', { timeout: 15000 })
    await expect(dialog.getByText('Read-only view')).toBeVisible()
    const code = dialog.locator('.call-id')
    await expect(code).toHaveText('CON-p1')
    expect(await code.evaluate((el) => el.style.maxWidth)).toBe('')
    await expect(dialog.getByRole('button', { name: /^Copy call id / })).toHaveCount(1)
    await dialog.getByRole('button', { name: 'Copy call id CON-p1', exact: true }).click()
    expect(await page.evaluate(() => window.__copied)).toEqual(['CON-p1'])
    await expect(dialog.locator('.call-id-status')).toHaveText('Copied')
    await dialog.screenshot({ path: testInfo.outputPath('call-id-dialog.png') })
  })
})
