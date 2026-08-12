<template>
  <Button 
    class="signin-signup-button-text" 
    type="button"
    @click="handleGoogleLogin"
    :label="$t('components.templates.sign.signup.signupWithGoogleButtonLabel')"
    :icon="'pi pi-google'"
  />
</template>

<script>
import Button from 'primevue/button'
import { GoogleAuthFlow, SIGN_IN_SCOPES, assertScopesAllowed } from '@/utils/OAuth'

export default {
  name: 'GoogleSignIn',
  components: {
    Button
  },
  setup() {
    const handleGoogleLogin = async () => {
      try {
        console.debug('Initiating Google OAuth flow with PKCE...')
        
        // A fresh login is never a calendar-connect: clear any stale flag left by
        // an abandoned ConnectCalendar redirect, else this login gets misrouted.
        localStorage.removeItem('oauthFlow')
        const { state, codeChallenge } = await GoogleAuthFlow.begin()

        const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
        authUrl.searchParams.set('client_id', process.env.VUE_APP_GOOGLE_CLIENT_ID)
        authUrl.searchParams.set('redirect_uri', process.env.VUE_APP_GOOGLE_REDIRECT_URI)
        authUrl.searchParams.set('response_type', 'code')
        // Signing in is an identity question, so it asks for identity and stops
        // there. Keeping the request inside SIGN_IN_SCOPES is what earns Google's
        // exemption from the unverified-app screen: the moment anything sensitive
        // joins the request, every user logging in meets that interstitial,
        // whether or not they ever wanted the calendar feature.
        authUrl.searchParams.set('scope', assertScopesAllowed(SIGN_IN_SCOPES, 'sign-in'))
        // Two parameters this request used to carry are deliberately gone.
        //
        // include_granted_scopes=true folded scopes the user had already granted
        // to this client back into the login request. For anyone who had connected
        // a calendar that silently turned a plain login into a sensitive-scope
        // authorization, which is the documented way to earn the unverified-app
        // screen on a request that reads as harmless. It also fed a calendar-capable
        // token into the login record and caused two production bugs on the return
        // leg (see the comment in GoogleCallback.vue).
        //
        // access_type=offline asked for a refresh token the login has no use for:
        // Firebase owns the session, and nothing in the app reads it. Google caps
        // refresh tokens per user per client and evicts the oldest, so minting one
        // on every login actively corroded the calendar connection.
        //
        // prompt was 'consent', which re-showed the consent screen on every single
        // login. select_account keeps the part that was worth having, choosing
        // which account to sign in with, without re-consenting. Calendar and skills
        // still send 'consent': they need a refresh token StarChat can renew, and
        // Google returns one only on a first grant.
        authUrl.searchParams.set('prompt', 'select_account')
        authUrl.searchParams.set('state', state)
        authUrl.searchParams.set('code_challenge', codeChallenge)
        authUrl.searchParams.set('code_challenge_method', 'S256')

        window.location.href = authUrl.toString()
      } catch (error) {
        console.error('Google sign in error:', error)
      }
    }

    return {
      handleGoogleLogin
    }
  }
}
</script> 