<template>
  <div class="google-callback">
    <p v-if="isSkillFlow">{{ skillStatus || $t('widgets.agentSkills.handoff.connecting') }}</p>
    <p v-else>Processing sign in...</p>
  </div>
</template>

<script>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { getAuth, signInWithCredential, GoogleAuthProvider, getAdditionalUserInfo } from 'firebase/auth'
import axios from 'axios'
import { isSessionEnded } from '@/firebase/axiosConfig'
import { GoogleAuthFlow, assertScopesAllowed } from '@/utils/OAuth'
import store from '@/store'
import businessUtils from '@/utils/Business'
import { confirmBookingConnection, clearBookingIntent } from '@/utils/BookingConnection'
import { confirmSheetsConnection, clearSheetsIntent } from '@/utils/SheetsConnection'

export default {
  name: 'GoogleCallback',

  setup() {
    const router = useRouter()
    const { t } = useI18n()
    const auth = getAuth()

    // Detect if this callback is from a skill OAuth flow (AgentSkillsConfigurator)
    const oauthProvider = localStorage.getItem('oauthProvider')
    const oauthBusinessId = localStorage.getItem('oauthBusinessId') || ''
    const oauthGrantName = localStorage.getItem('oauthGrantName') || ''
    const boundSkillFlow = !!localStorage.getItem('oauthSkillContext') ||
      String(new URLSearchParams(window.location.search).get('state') || '').startsWith('skill.')
    const isSkillFlow = ref(!!oauthProvider || !!localStorage.getItem('oauthSkillContext') ||
      String(new URLSearchParams(window.location.search).get('state') || '').startsWith('skill.'))
    const skillStatus = ref('')

    const handleCallback = async () => {
      try {
        const urlParams = new URLSearchParams(window.location.search)
        const code = urlParams.get('code')

        // Checks the returned state against the one stored when the flow started,
        // and hands back the verifier. Throws on a mismatch, which is what a
        // callback forged by someone else looks like: without it an attacker can
        // plant their own code and the victim ends up signed into the attacker's
        // Google account. Consumes both values, they are single use.
        const { codeVerifier, context } = await GoogleAuthFlow.consumeWithContext(urlParams.get('state'))
        if (urlParams.has('error') || !code) throw new Error('Missing authorization code')
        if (boundSkillFlow && !context) throw new Error('missing_skill_oauth_context')
        // StarChat stores a connect without a business as the owner's account-level row, which no
        // skill reads; refused before the code is exchanged, so no token is minted for it.
        if (oauthProvider && !context && !oauthBusinessId) throw new Error('missing_skill_oauth_business')
        let skillUser = null
        if (context) {
          skillUser = auth.currentUser || await new Promise(resolve => {
            const unsubscribe = auth.onAuthStateChanged(restoredUser => { unsubscribe(); resolve(restoredUser) })
          })
          if (!skillUser || skillUser.uid !== context.ownerUid) throw new Error('skill_oauth_owner_changed')
        }

        // Exchanged by the backend, which holds the client secret. Doing it here
        // meant shipping that secret in the bundle, where anyone could read it.
        const tokenResponse = await GoogleAuthFlow.exchangeCode(code, codeVerifier)

        const { access_token, refresh_token, expires_in, scope, id_token } = tokenResponse
        const scopes = scope.split(' ')

        if (context) {
          skillStatus.value = t('widgets.agentSkills.handoff.connecting')
          const grantedScopes = assertScopesAllowed(scopes, 'skill-callback', context.provider).split(' ')
          if (!context.scopes.every(item => grantedScopes.includes(item))) throw new Error('skill_oauth_scope_missing')
          const firebaseToken = await skillUser.getIdToken()
          if (auth.currentUser?.uid !== context.ownerUid) throw new Error('skill_oauth_owner_changed')
          const connectUrl = process.env.VUE_APP_STARCHAT_URL +
            '/mrcall/v1/mrcall0/oauth/providers/' + encodeURIComponent(context.provider) + '/connect'
          await axios.post(connectUrl, {
            accessToken: access_token, refreshToken: refresh_token,
            expiresAt: Date.now() + (expires_in * 1000), scopes: grantedScopes,
            businessId: context.businessId, grantName: context.grantName,
            providerAccountId: accountEmailFrom(id_token)
          }, { headers: { 'Content-type': 'application/json; charset=UTF-8', auth: firebaseToken } })
          localStorage.removeItem('oauthProvider')
          localStorage.removeItem('oauthReturnUrl')
          if (auth.currentUser?.uid !== context.ownerUid) throw new Error('skill_oauth_owner_changed')
          confirmBookingConnection(context, urlParams.get('state'))
          confirmSheetsConnection(context, urlParams.get('state'))
          await router.replace(context.returnUrl)
          return
        }

        if (isSkillFlow.value && oauthProvider) {
          const user = auth.currentUser || await new Promise(resolve => {
            const unsubscribe = auth.onAuthStateChanged(restored => { unsubscribe(); resolve(restored) })
          })
          if (!user) throw new Error('No authenticated user found')
          const connectUrl = process.env.VUE_APP_STARCHAT_URL +
            '/mrcall/v1/mrcall0/oauth/providers/' + encodeURIComponent(oauthProvider) + '/connect'
          await axios.post(connectUrl, {
            accessToken: access_token, refreshToken: refresh_token,
            expiresAt: Date.now() + (expires_in * 1000), scopes,
            businessId: oauthBusinessId, grantName: oauthGrantName,
            providerAccountId: accountEmailFrom(id_token)
          }, { headers: { 'Content-type': 'application/json; charset=UTF-8', auth: await user.getIdToken() } })
          returnToConfiguration()
          return
        }

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

        await checkUserStatusAndRedirect(user)

      } catch (error) {
        console.error('Error processing callback:', error.response?.status || 'oauth_callback_failed')
        if (isSkillFlow.value) {
          clearBookingIntent()
          clearSheetsIntent()
          if (!boundSkillFlow) { returnToConfiguration(); return }
          localStorage.removeItem('oauthProvider')
          localStorage.removeItem('oauthReturnUrl')
          localStorage.removeItem('oauthSkillContext')
          skillStatus.value = t('widgets.agentSkills.handoff.callbackFailed')
        } else {
          router.replace('/signin')
        }
      }
    }

    /** Back to the page that started this, with the localStorage it used cleared. */
    const returnToConfiguration = () => {
      localStorage.removeItem('oauthProvider')
      localStorage.removeItem('oauthBusinessId')
      localStorage.removeItem('oauthGrantName')
      const returnUrl = localStorage.getItem('oauthReturnUrl')
      localStorage.removeItem('oauthReturnUrl')
      router.replace(returnUrl || '/businesses')
    }

    /** The email on the id token, used as the account's identity.
     *
     * Read without verifying the signature, which is safe for this use and for no other: the token
     * came from our own backend, which had just received it from Google over TLS in exchange for a
     * code bound to this session's PKCE verifier. It decides nothing — no access is granted or
     * refused on it — it names the account a grant belongs to.
     */
    const accountEmailFrom = (idToken) => {
      try {
        const payload = idToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
        return JSON.parse(decodeURIComponent(escape(atob(payload)))).email || undefined
      } catch (e) {
        console.debug('id_token carried no readable email:', e)
        return undefined
      }
    }

    const checkUserStatusAndRedirect = async (user) => {
      try {
        const hasBusinesses = await businessUtils.checkUserHasBusinesses(user, store)
        await router.replace(hasBusinesses ? '/businesses' : '/onboardinglang')
      } catch (error) {
        console.error('Error checking user status:', error)
        // The session ended: the interceptor has already sent the person to sign in, and a second
        // navigation here would race it.
        if (isSessionEnded(error)) return
        router.replace('/onboardinglang')
      }
    }

    onMounted(() => {
      handleCallback()
    })

    return {
      isSkillFlow,
      skillStatus
    }
  }
}
</script>
