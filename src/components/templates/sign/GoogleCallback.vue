<template>
  <div class="google-callback">
    <div v-if="showCalendarSelector" class="calendar-selector-container p-d-flex p-jc-center">
      <CalendarSelector
        :accessToken="calendarAccessToken"
        @select="handleCalendarSelected"
      />
    </div>
    <p v-else-if="isSkillFlow">{{ skillStatus || 'Connecting service...' }}</p>
    <p v-else>{{ isCalendarFlow ? 'Connecting calendar...' : 'Processing sign in...' }}</p>
  </div>
</template>

<script>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { getAuth, signInWithCredential, GoogleAuthProvider, getAdditionalUserInfo } from 'firebase/auth'
import axios from 'axios'
import { OAuthHelper, GoogleAuthFlow } from '@/utils/OAuth'
import store from '@/store'
import businessUtils from '@/utils/Business'
import CalendarSelector from '@/components/CalendarSelector.vue'

export default {
  name: 'GoogleCallback',

  components: {
    CalendarSelector
  },

  setup() {
    const router = useRouter()
    const auth = getAuth()
    const isCalendarFlow = ref(false)
    const showCalendarSelector = ref(false)
    const calendarAccessToken = ref('')
    // Store credentials temporarily while user picks a calendar
    const pendingCredentials = ref(null)
    const pendingUser = ref(null)

    // Detect if this callback is from a skill OAuth flow (AgentSkillsConfigurator)
    const oauthProvider = localStorage.getItem('oauthProvider')
    const isSkillFlow = ref(!!oauthProvider)
    const skillStatus = ref('')

    const handleCallback = async () => {
      try {
        const urlParams = new URLSearchParams(window.location.search)
        const code = urlParams.get('code')

        if (!code) {
          throw new Error('Missing authorization code')
        }

        // Checks the returned state against the one stored when the flow started,
        // and hands back the verifier. Throws on a mismatch, which is what a
        // callback forged by someone else looks like: without it an attacker can
        // plant their own code and the victim ends up signed into the attacker's
        // Google account. Consumes both values, they are single use.
        const codeVerifier = GoogleAuthFlow.consume(urlParams.get('state'))

        // Exchanged by the backend, which holds the client secret. Doing it here
        // meant shipping that secret in the bundle, where anyone could read it.
        const tokenResponse = await GoogleAuthFlow.exchangeCode(code, codeVerifier)

        const { access_token, refresh_token, expires_in, scope } = tokenResponse
        const scopes = scope.split(' ')

        // Check if this is a skill OAuth flow (Sheets, Docs, Drive, etc.)
        if (isSkillFlow.value && oauthProvider) {
          skillStatus.value = 'Storing credentials...'

          // Wait for Firebase to restore auth state
          let user = auth.currentUser
          if (!user) {
            user = await new Promise((resolve) => {
              const unsubscribe = auth.onAuthStateChanged((restoredUser) => {
                unsubscribe()
                resolve(restoredUser)
              })
            })
          }
          if (!user) {
            throw new Error('No authenticated user found. Please sign in first.')
          }

          // Store tokens in backend via /oauth/providers/{provider}/connect
          const headers = {
            'Content-type': 'application/json; charset=UTF-8',
            'auth': await user.getIdToken()
          }
          const connectUrl = process.env.VUE_APP_STARCHAT_URL +
            '/mrcall/v1/mrcall0/oauth/providers/' + encodeURIComponent(oauthProvider) + '/connect'

          await axios.post(connectUrl, {
            accessToken: access_token,
            refreshToken: refresh_token,
            expiresAt: Date.now() + (expires_in * 1000),
            scopes: scopes
          }, { headers })

          // Clean up localStorage
          localStorage.removeItem('oauthProvider')

          // Redirect back to business configuration
          const returnUrl = localStorage.getItem('oauthReturnUrl')
          localStorage.removeItem('oauthReturnUrl')
          router.replace(returnUrl || '/businesses')
          return
        }

        // Distinguish the calendar-connect flow from a normal sign-in via an
        // explicit intent flag set by ConnectCalendar.vue — NOT by sniffing the
        // returned scopes: include_granted_scopes=true makes Google echo back
        // previously-granted scopes (e.g. calendar), which misclassifies a
        // normal login as a calendar connect and bounces the user to /login.
        isCalendarFlow.value = localStorage.getItem('oauthFlow') === 'calendar'
        localStorage.removeItem('oauthFlow')

        if (isCalendarFlow.value) {
          // Wait for Firebase to restore auth state after page redirect
          let user = auth.currentUser;
          if (!user) {
            user = await new Promise((resolve) => {
              const unsubscribe = auth.onAuthStateChanged((restoredUser) => {
                unsubscribe();
                resolve(restoredUser);
              });
            });
          }

          if (!user) {
            throw new Error('No authenticated user found. Please sign in first and then connect your calendar.');
          }

          // Store credentials temporarily and show calendar picker
          pendingCredentials.value = {
            accessToken: access_token,
            refreshToken: refresh_token,
            expiresAt: Date.now() + (expires_in * 1000),
            scope: scopes
          }
          pendingUser.value = user
          calendarAccessToken.value = access_token
          showCalendarSelector.value = true

        } else {
          // Handle normal sign in flow
          const credential = GoogleAuthProvider.credential(null, access_token)
          const result = await signInWithCredential(auth, credential)
          const user = result.user

          // Firebase modular SDK exposes new-user info via getAdditionalUserInfo(),
          // not result.additionalUserInfo (which is always undefined here).
          if (getAdditionalUserInfo(result)?.isNewUser) {
            window.dataLayer.push({
              'event': 'sign_up',
              'method': 'Google',
              'user_id': user.uid,
              'user_email': user.email,
              'event_category': 'engagement',
              'event_label': 'Google Sign Up',
              'debug_timestamp': new Date().getTime()
            })
          }

          await store.dispatch('updateUser', { user })

          // The sign-in deliberately no longer writes oauth.GOOGLE.
          //
          // Nothing in this app ever read that record back: grep for
          // getGoogleCredentials. Its only consumer is StarChat, which reads
          // oauth.GOOGLE_CALENDAR and falls back to oauth.GOOGLE when the former
          // is missing (GCCalendarAtomService, FirebaseCustomerRegistryService).
          // That fallback only ever worked because include_granted_scopes quietly
          // handed the login a calendar-capable token. Now that the sign-in asks
          // for identity alone, writing here would replace a working fallback with
          // a token that cannot open a calendar, and it would do so for precisely
          // the customers who connected one early.
          //
          // Leaving the record untouched keeps them working. It goes away once
          // those records are backfilled into GOOGLE_CALENDAR and the StarChat
          // fallback is dropped. See docs/integration/google-oauth.md.
          await checkUserStatusAndRedirect(user)
        }

      } catch (error) {
        console.error('Error processing callback:', error)
        if (isSkillFlow.value) {
          localStorage.removeItem('oauthProvider')
          const returnUrl = localStorage.getItem('oauthReturnUrl')
          localStorage.removeItem('oauthReturnUrl')
          router.replace(returnUrl || '/businesses')
        } else {
          router.replace(isCalendarFlow.value ? '/account' : '/signin')
        }
      }
    }

    const handleCalendarSelected = async ({ id, summary }) => {
      try {
        const creds = pendingCredentials.value
        creds.calendarName = summary
        await OAuthHelper.updateGoogleCalendarCredentials(pendingUser.value, creds, id)
        await store.dispatch('calendar/checkCalendarConnection', pendingUser.value)
        router.replace('/account')
      } catch (error) {
        console.error('Error storing calendar selection:', error)
        router.replace('/account')
      }
    }

    const checkUserStatusAndRedirect = async (user) => {
      try {
        const hasBusinesses = await businessUtils.checkUserHasBusinesses(user, store)
        await router.replace(hasBusinesses ? '/businesses' : '/onboardinglang')
      } catch (error) {
        console.error('Error checking user status:', error)
        if (error.response?.status === 401) {
          await store.dispatch('logout')
          router.replace('/signin')
        } else {
          router.replace('/onboardinglang')
        }
      }
    }

    onMounted(() => {
      handleCallback()
    })

    return {
      isCalendarFlow,
      isSkillFlow,
      skillStatus,
      showCalendarSelector,
      calendarAccessToken,
      handleCalendarSelected
    }
  }
}
</script>

<style scoped>
.calendar-selector-container {
  padding: 2rem;
  display: flex;
  justify-content: center;
}
</style>
