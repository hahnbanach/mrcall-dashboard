/**
 * The balance of one credit category of a business, as the owner must see it: net of any debt,
 * negative while in debt (Angelo, 2026-10-06: a business 2 euro in debt reads -2 euro, so that a
 * 50 euro top-up then reads 48, instead of a top-up of 50 that shows 48 with no explanation).
 *
 * StarChat's `.../resources/count` stays "credit available, never below zero" because clients gate
 * on `count == 0`; the debt comes from a separate endpoint, `.../resources/balance`, answering
 * `{available, debt, net}` in credits (StarChat brief 2026-10-06 credit-engine-call-debt). Until a
 * StarChat with that endpoint is deployed it answers 404, and the balance falls back to the count
 * with no debt, so this dashboard can be released first without showing anything wrong.
 *
 * The path is built here and nowhere else.
 */

export const BALANCE_PATH = '/mrcall/v1/mrcall0/crm/business/resources/balance'
export const COUNT_PATH = '/mrcall/v1/mrcall0/crm/business/resources/count'

const isWholeNumber = (v) => typeof v === 'number' && Number.isInteger(v)

/**
 * The balance endpoint's answer, or null when it is not one: a malformed answer must not be
 * shown as a number.
 */
export function parseBalance(data) {
  if (!data || typeof data !== 'object') return null
  const { available, debt, net } = data
  if (![available, debt, net].every(isWholeNumber)) return null
  if (available < 0 || debt < 0) return null
  return { available, debt, net }
}

/**
 * @param http    the application's axios (the 401 interceptor lives on it)
 * @param baseUrl VUE_APP_STARCHAT_URL
 * @param headers the request headers, `auth` included
 * @param body    the count's request body: businessId, category, subcategory, subcategoryExclude
 * @returns {available, debt, net}, or null when neither endpoint gave an answer
 */
export async function fetchCreditBalance(http, baseUrl, headers, body) {
  try {
    const response = await http.post(baseUrl + BALANCE_PATH, body, { headers })
    return parseBalance(response.data)
  } catch (error) {
    const status = error?.response?.status ?? error?.status
    if (status !== 404) throw error
  }
  // A StarChat without the balance endpoint: the count, with no debt.
  const response = await http.post(baseUrl + COUNT_PATH, body, { headers })
  const available = response.data
  if (!isWholeNumber(available) || available < 0) return null
  return { available, debt: 0, net: available }
}

/** Credits as euro, 1 credit = 0.01 euro, negative while in debt. */
export function creditsToEuro(credits, locale) {
  const euro = (credits ?? 0) / 100
  return new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(euro)
}

/**
 * What the credit of a business allows, from the sign of StarChat's `net` alone: `debt` below zero
 * (calls are refused, as at zero), `empty` at zero, `ok` above. An open debt that the credit the
 * business can draw (its organization's included) still covers is `ok`: its calls are admitted and the
 * debt is repaid by its next call (StarChat brief 2026-11-04-debt-state-from-net). Unknown (no answer)
 * is null.
 */
export function creditState(balance) {
  if (!balance) return null
  if (balance.net < 0) return 'debt'
  return balance.net > 0 ? 'ok' : 'empty'
}
