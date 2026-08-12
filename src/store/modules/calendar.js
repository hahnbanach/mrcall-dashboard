import { OAuthHelper } from '@/utils/OAuth'

export default {
  namespaced: true,

  state: {
    isConnected: false,
    isLoading: false,
    error: null,
    selectedCalendarId: null,
    calendarName: null
  },

  mutations: {
    SET_CONNECTED(state, value) {
      state.isConnected = value
    },
    SET_LOADING(state, value) {
      state.isLoading = value
    },
    SET_ERROR(state, error) {
      state.error = error
    },
    SET_CALENDAR_INFO(state, { calendarId, calendarName }) {
      state.selectedCalendarId = calendarId || null
      state.calendarName = calendarName || null
    }
  },

  actions: {
    async checkCalendarConnection({ commit }, user) {
      try {
        commit('SET_LOADING', true)
        const credentials = await OAuthHelper.getGoogleCalendarCredentials(user)
        // Connected means StarChat holds a refresh token it can use, not that the
        // access token is currently fresh. The access token is never used
        // server-side: GCCalendarAtomService builds credentials from the refresh
        // token alone and refreshes on every call, so its expiry says nothing about
        // whether the calendar works.
        //
        // This used to read that expiry, and got it wrong twice over: the field is
        // returned as expirationTime rather than expiresAt, so the check saw
        // undefined and reported every calendar as disconnected, and even reading
        // the right field would have reported disconnected an hour after connecting.
        // connected is asserted by StarChat. The refreshToken leg is a bridge for
        // the window where this ships before the backend does, and should be
        // deleted once StarChat readForWire is live everywhere: the endpoint
        // deliberately no longer returns any credential, so after that the field
        // is simply absent.
        const connected = !!(credentials?.connected || credentials?.refreshToken)
        commit('SET_CONNECTED', connected)
        if (connected && credentials.calendarId) {
          commit('SET_CALENDAR_INFO', {
            calendarId: credentials.calendarId,
            calendarName: credentials.calendarName || credentials.calendarId
          })
        } else {
          commit('SET_CALENDAR_INFO', { calendarId: null, calendarName: null })
        }
      } catch (error) {
        console.error('Failed to check calendar connection:', error)
        commit('SET_ERROR', error.message)
      } finally {
        commit('SET_LOADING', false)
      }
    },

    async disconnectCalendar({ commit }, user) {
      try {
        commit('SET_LOADING', true)
        await OAuthHelper.updateGoogleCalendarCredentials(user, null)
        commit('SET_CONNECTED', false)
        commit('SET_CALENDAR_INFO', { calendarId: null, calendarName: null })
      } catch (error) {
        console.error('Failed to disconnect calendar:', error)
        commit('SET_ERROR', error.message)
      } finally {
        commit('SET_LOADING', false)
      }
    }
  }
}
