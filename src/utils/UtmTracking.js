import businessUtils from "@/utils/Business"
import businessVariablesUtils from "@/utils/BusinessVariables"

/**
 * UTM Tracking Utility
 *
 * This module handles capturing and managing UTM parameters and other tracking
 * information from URL query strings.
 *
 * Supported parameters:
 * - utm_source: Identifies which site sent the traffic
 * - utm_medium: Identifies what type of link was used (e.g., email, cpc, social)
 * - utm_campaign: Identifies a specific product promotion or strategic campaign
 * - utm_term: Identifies search terms
 * - utm_content: Identifies what specifically was clicked
 * - ref: Referral parameter (alternative to utm_source)
 * - Any custom parameters you want to track
 */

/**
 * Parse UTM parameters from a URL query string
 * @param {string} queryString - The query string (e.g., window.location.search)
 * @returns {Object} Object containing UTM parameters and other tracking data
 */
export function parseUtmParams(queryString) {
  const params = new URLSearchParams(queryString)
  const utmParams = {}

  // Standard UTM parameters
  const utmKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content']

  utmKeys.forEach(key => {
    const value = params.get(key)
    if (value) {
      utmParams[key] = value
    }
  })

  // Alternative referral parameter
  const ref = params.get('ref')
  if (ref) {
    utmParams.ref = ref
  }

  // Website tracking session ID (attribution bridging)
  const tsid = params.get('_tsid')
  if (tsid) {
    utmParams._tsid = tsid
  }

  // Capture any custom parameters you want to track
  // You can add more custom parameters here
  const customParams = ['source', 'partner', 'promo', 'affiliate']
  customParams.forEach(key => {
    const value = params.get(key)
    if (value) {
      utmParams[key] = value
    }
  })

  // Add timestamp when parameters were captured
  if (Object.keys(utmParams).length > 0) {
    utmParams.captured_at = new Date().toISOString()
  }

  return utmParams
}

/**
 * Save UTM parameters to localStorage for persistence
 * @param {Object} params - UTM parameters to save
 * @param {string} key - Storage key (default: 'utm_params')
 */
export function saveUtmParams(params, key = 'utm_params') {
  if (Object.keys(params).length > 0) {
    localStorage.setItem(key, JSON.stringify(params))
  }
}

/**
 * Load UTM parameters from localStorage
 * @param {string} key - Storage key (default: 'utm_params')
 * @returns {Object} Stored UTM parameters or empty object
 */
export function loadUtmParams(key = 'utm_params') {
  try {
    const stored = localStorage.getItem(key)
    return stored ? JSON.parse(stored) : {}
  } catch (error) {
    console.error('Error loading UTM params:', error)
    return {}
  }
}

/**
 * Clear stored UTM parameters
 * @param {string} key - Storage key (default: 'utm_params')
 */
export function clearUtmParams(key = 'utm_params') {
  localStorage.removeItem(key)
}

/**
 * Get the current UTM parameters (from storage)
 * @returns {Object} Current UTM parameters
 */
export function getCurrentUtmParams() {
  return loadUtmParams()
}

/**
 * Attach UTM parameters to an API request payload
 * @param {Object} payload - The request payload
 * @param {Object} utmParams - UTM parameters to attach (optional, will use stored if not provided)
 * @returns {Object} Payload with UTM parameters attached
 */
export function attachUtmToPayload(payload, utmParams = null) {
  const params = utmParams || getCurrentUtmParams()

  if (Object.keys(params).length > 0) {
    return {
      ...payload,
      tracking: params
    }
  }

  return payload
}

/**
 * Check if UTM parameters exist
 * @returns {boolean} True if UTM parameters are stored
 */
export function hasUtmParams() {
  const params = getCurrentUtmParams()
  return Object.keys(params).length > 0
}

/**
 * Sets UTM variables from Vuex tracking store onto a business object's variables (in-place).
 * Returns true if any UTM param was applied, false otherwise.
 *
 * @param {Object} store - Vuex store instance
 * @param {Object} business - Business object (will be mutated)
 * @returns {boolean} Whether any UTM params were set
 */
export function applyUtmVariablesToBusiness(store, business) {
  const utmSource = store.getters['tracking/utmSource']
  if (!utmSource) return false

  if (!business.variables) business.variables = {}
  business.variables['UTM_SOURCE'] = utmSource
  const utmCampaign = store.getters['tracking/utmCampaign']
  if (utmCampaign) business.variables['UTM_CAMPAIGN'] = utmCampaign
  const utmMedium = store.getters['tracking/utmMedium']
  if (utmMedium) business.variables['UTM_MEDIUM'] = utmMedium
  const utmTerm = store.getters['tracking/utmTerm']
  if (utmTerm) business.variables['UTM_TERM'] = utmTerm
  const utmContent = store.getters['tracking/utmContent']
  if (utmContent) business.variables['UTM_CONTENT'] = utmContent
  return true
}

/**
 * Writes UTM parameters from the Vuex tracking store onto the business variables
 * and updates the business on the backend.
 * Called before Stripe session creation so the backend can apply UTM-based discounts.
 *
 * @param {Object} store - Vuex store instance
 * @param {Object} user - Firebase user (has getIdToken)
 * @param {Object} business - Current business object from store
 */
export async function writeUtmParamsToBusiness(store, user, business) {
  const utmSource = store.getters['tracking/utmSource']
  if (!utmSource) return

  try {
    const businessCopy = JSON.parse(JSON.stringify(business))
    applyUtmVariablesToBusiness(store, businessCopy)
    const serialized = businessVariablesUtils.businessVariablesToSerializable(businessCopy)
    await businessUtils.updateBusiness(user, serialized)
    console.debug("UTM params written to business:", utmSource, store.getters['tracking/utmCampaign'])
  } catch (e) {
    console.error("Failed to write UTM params to business:", e)
  }
}

export default {
  parseUtmParams,
  saveUtmParams,
  loadUtmParams,
  clearUtmParams,
  getCurrentUtmParams,
  attachUtmToPayload,
  hasUtmParams,
  applyUtmVariablesToBusiness,
  writeUtmParamsToBusiness
}