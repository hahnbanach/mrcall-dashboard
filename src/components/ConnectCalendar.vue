<template>
  <div class="connect-calendar">
    <div class="p-d-flex p-jc-center">
      <div class="card">
        <div v-if="isLoading" class="loading">
          <ProgressSpinner />
        </div>

        <div v-else class="text-center">
          <div v-if="isConnected">
            <p class="connected-info mb-3">
              {{ $t('components.connectCalendar.connectedTo') }}
              <strong>{{ calendarName }}</strong>
            </p>
            <div class="p-d-flex p-jc-center" style="gap: 0.5rem; flex-wrap: wrap; justify-content: center;">
              <Button
                :label="$t('components.connectCalendar.changeCalendar')"
                icon="pi pi-refresh"
                @click="handleConnectCalendar"
                class="p-button-outlined p-mt-2 md:w-auto py-3 px-6"
              />
              <Button
                :label="$t('components.connectCalendar.disconnectButton')"
                icon="pi pi-calendar-times"
                @click="handleDisconnectCalendar"
                class="p-button-danger p-mt-2 md:w-auto py-3 px-6"
              />
            </div>
          </div>
          <Button
            v-else
            :label="$t('components.connectCalendar.connectButton')"
            icon="pi pi-calendar"
            @click="handleConnectCalendar"
            class="p-button-primary p-mt-2 md:w-auto py-3 px-6 w-full"
          />
        </div>

        <small v-if="error" class="error-message">{{ error }}</small>
      </div>
    </div>
  </div>
</template>

<script>
import { computed, onMounted } from 'vue'
import { useStore } from 'vuex'
import { getAuth } from 'firebase/auth'
import Button from 'primevue/button'
import ProgressSpinner from 'primevue/progressspinner'
import { GoogleAuthFlow, assertScopesAllowed } from '@/utils/OAuth'

const CALENDAR_SCOPES = ['https://www.googleapis.com/auth/calendar']

export default {
  name: 'ConnectCalendar',

  components: {
    Button,
    ProgressSpinner
  },

  setup() {
    const store = useStore()
    const auth = getAuth()

    const isConnected = computed(() => {
      return store.state.calendar?.isConnected
    })
    const isLoading = computed(() => store.state.calendar.isLoading)
    const error = computed(() => store.state.calendar.error)
    const calendarName = computed(() => {
      return store.state.calendar?.calendarName || store.state.calendar?.selectedCalendarId || ''
    })

    const handleConnectCalendar = async () => {
      try {
        // Mark this as the calendar-connect flow so GoogleCallback.vue routes it
        // correctly. Detection states the intent rather than inferring it from the
        // scopes Google returns, because what comes back describes the grant, not
        // the reason the user started it, and the two have already diverged once.
        localStorage.setItem('oauthFlow', 'calendar')
        const { state, codeChallenge } = await GoogleAuthFlow.begin()

        const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
        authUrl.searchParams.set('client_id', process.env.VUE_APP_GOOGLE_CLIENT_ID)
        authUrl.searchParams.set('redirect_uri', process.env.VUE_APP_GOOGLE_REDIRECT_URI)
        authUrl.searchParams.set('response_type', 'code')
        authUrl.searchParams.set('scope', assertScopesAllowed(CALENDAR_SCOPES, 'calendar-connect'))
        // access_type=offline and prompt=consent both stay: StarChat renews this
        // grant server-side with the refresh token, and Google hands out a refresh
        // token only on a first grant unless consent is re-requested, so a
        // reconnect without them yields credentials the backend cannot renew.
        authUrl.searchParams.set('access_type', 'offline')
        authUrl.searchParams.set('prompt', 'consent')
        authUrl.searchParams.set('state', state)
        authUrl.searchParams.set('code_challenge', codeChallenge)
        authUrl.searchParams.set('code_challenge_method', 'S256')
        // include_granted_scopes is gone: connecting a calendar should grant a
        // calendar and nothing else. Unioning in whatever the user happened to
        // approve before produced tokens broader than the record that stores them
        // claims to be.

        window.location.href = authUrl.toString()
      } catch (error) {
        console.error('Calendar connection error:', error)
      }
    }

    const handleDisconnectCalendar = async () => {
      try {
        await store.dispatch('calendar/disconnectCalendar', auth.currentUser)
      } catch (error) {
        console.error('Calendar disconnection error:', error)
      }
    }

    onMounted(async () => {
      if (auth.currentUser) {
        await store.dispatch('calendar/checkCalendarConnection', auth.currentUser)
      }
    })

    return {
      isConnected,
      isLoading,
      error,
      calendarName,
      handleConnectCalendar,
      handleDisconnectCalendar
    }
  }
}
</script>

<style lang="less" scoped>
@import '../assets/style/colors';
@import '../assets/style/fonts';

.connect-calendar {
  .card {
    width: auto;
  }

  .loading {
    display: flex;
    justify-content: center;
    margin: 1rem 0;
  }

  .connected-info {
    color: var(--text-color);
  }

  .error-message {
    color: var(--red-500);
    margin-top: 0.5rem;
    display: block;
    text-align: center;
  }
}
</style>
