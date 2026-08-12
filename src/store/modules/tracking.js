/**
 * Vuex Module for UTM and Tracking Parameters
 *
 * This module manages tracking parameters (UTM, referral, etc.) in the Vuex store
 * and provides actions to capture, persist, and retrieve them.
 */

import { parseUtmParams, saveUtmParams, loadUtmParams, clearUtmParams } from '@/utils/UtmTracking'

const state = {
  // Current tracking parameters
  utmParams: {},

  // Flag to indicate if parameters have been captured
  paramsCaptured: false,

  // Original landing page URL
  landingUrl: null,

  // Referrer information
  referrer: null,

  // Website tracking session ID (attribution bridging from mrcall.ai)
  trackingSessionId: null
}

const mutations = {
  SET_UTM_PARAMS(state, params) {
    state.utmParams = params
  },

  SET_PARAMS_CAPTURED(state, value) {
    state.paramsCaptured = value
  },

  SET_LANDING_URL(state, url) {
    state.landingUrl = url
  },

  SET_REFERRER(state, referrer) {
    state.referrer = referrer
  },

  SET_TRACKING_SESSION_ID(state, id) {
    state.trackingSessionId = id
  },

  CLEAR_UTM_PARAMS(state) {
    state.utmParams = {}
    state.paramsCaptured = false
    state.landingUrl = null
    state.referrer = null
    state.trackingSessionId = null
  }
}

const actions = {
  /**
   * Capture UTM parameters from the current URL
   * This should be called once when the app loads
   */
  captureUtmParams({ commit, state }, { queryString, fullUrl, referrer }) {
    // Parse UTM parameters from query string
    const params = parseUtmParams(queryString)

    // _tsid: capture every time it appears in the URL. The web tracking
    // session is the most recent one we should attribute the signup to.
    // Decoupled from `paramsCaptured` so a returning visitor's _tsid is not
    // dropped when UTM was already captured on a previous visit (common case:
    // first visit lands from Google Ads with UTM but no _tsid, later visit
    // comes via mrcall.ai CTA with _tsid — without this we would lose it).
    if (params._tsid && params._tsid !== state.trackingSessionId) {
      commit('SET_TRACKING_SESSION_ID', params._tsid)
      localStorage.setItem('tracking_session_id', params._tsid)
    }

    // UTM params: capture only once to preserve original source.
    if (state.paramsCaptured) {
      return
    }

    // Only proceed if we found parameters
    if (Object.keys(params).length > 0) {
      // Add additional context
      params.landing_url = fullUrl
      params.referrer = referrer || document.referrer

      // Save to store
      commit('SET_UTM_PARAMS', params)
      commit('SET_LANDING_URL', fullUrl)
      commit('SET_REFERRER', referrer || document.referrer)
      commit('SET_PARAMS_CAPTURED', true)

      // Persist to localStorage
      saveUtmParams(params)

      console.log('UTM parameters captured:', params)
    }
  },

  /**
   * Load previously saved UTM parameters from storage
   */
  loadStoredParams({ commit }) {
    const params = loadUtmParams()

    if (Object.keys(params).length > 0) {
      commit('SET_UTM_PARAMS', params)
      commit('SET_PARAMS_CAPTURED', true)

      if (params.landing_url) {
        commit('SET_LANDING_URL', params.landing_url)
      }

      if (params.referrer) {
        commit('SET_REFERRER', params.referrer)
      }
    }

    const tsid = localStorage.getItem('tracking_session_id')
    if (tsid) {
      commit('SET_TRACKING_SESSION_ID', tsid)
    }
  },

  /**
   * Clear all tracking parameters
   */
  clearTrackingParams({ commit }) {
    commit('CLEAR_UTM_PARAMS')
    clearUtmParams()
    localStorage.removeItem('tracking_session_id')
  },

  /**
   * Manually set UTM parameters (useful for testing or special cases)
   */
  setUtmParams({ commit }, params) {
    commit('SET_UTM_PARAMS', params)
    saveUtmParams(params)
  }
}

const getters = {
  // Get all UTM parameters
  utmParams: state => state.utmParams,

  // Check if we have any UTM parameters
  hasUtmParams: state => Object.keys(state.utmParams).length > 0,

  // Get specific UTM parameter
  getUtmParam: state => key => state.utmParams[key] || null,

  // Get UTM source
  utmSource: state => state.utmParams.utm_source || state.utmParams.ref || null,

  // Get UTM medium
  utmMedium: state => state.utmParams.utm_medium || null,

  // Get UTM campaign
  utmCampaign: state => state.utmParams.utm_campaign || null,

  // Get UTM term
  utmTerm: state => state.utmParams.utm_term || null,

  // Get UTM content
  utmContent: state => state.utmParams.utm_content || null,

  // Get website tracking session ID (attribution bridging)
  trackingSessionId: state => state.trackingSessionId,

  // Get landing URL
  landingUrl: state => state.landingUrl,

  // Get referrer
  referrer: state => state.referrer,

  // Get all tracking data formatted for API
  trackingDataForApi: state => {
    if (Object.keys(state.utmParams).length === 0) {
      return null
    }

    return {
      ...state.utmParams,
      landing_url: state.landingUrl,
      referrer: state.referrer
    }
  }
}

export default {
  namespaced: true,
  state,
  mutations,
  actions,
  getters
}