<script>
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useStore } from 'vuex'
import { useI18n } from 'vue-i18n'
import axios from 'axios'
import { auth } from '@/firebase/config'
import { onAuthStateChanged } from 'firebase/auth'
import Sign from '@/components/templates/sign/Sign.vue'
import Signin from '@/components/templates/sign/Signin.vue'
import Button from 'primevue/button'
import ProgressSpinner from 'primevue/progressspinner'

// Scope display names mapping
const SCOPE_DISPLAY_NAMES = {
  'business:read': 'Read your business information',
  'business:write': 'Create and modify your businesses',
  'contacts:read': 'Read your contacts',
  'contacts:write': 'Create and modify your contacts',
  'sessions:read': 'Read your conversation history',
  'sessions:write': 'Modify conversation properties',
  'calendar:read': 'Read your calendar connections',
  'calendar:write': 'Manage your calendar connections',
  'payments:read': 'Read your subscription information',
  'payments:write': 'Manage your subscriptions',
  'templates:read': 'Read your templates',
  'devices:write': 'Register notification devices',
  'account:delete': 'Delete your account'
}

// Dangerous scopes that should be highlighted
const DANGEROUS_SCOPES = ['account:delete']

export default {
  name: 'OAuthConsent',
  components: {
    Sign,
    Signin,
    Button,
    ProgressSpinner
  },
  setup() {
    const router = useRouter()
    const route = useRoute()
    const store = useStore()
    const { t } = useI18n()

    // State
    const loading = ref(true)
    const submitting = ref(false)
    const error = ref(null)
    const consentData = ref(null)
    const user = computed(() => store.state.user)
    const authIsReady = computed(() => store.state.authIsReady)

    // Get query parameters
    const queryParams = computed(() => ({
      responseType: route.query.response_type,
      clientId: route.query.client_id,
      redirectUri: route.query.redirect_uri,
      scope: route.query.scope,
      state: route.query.state,
      codeChallenge: route.query.code_challenge,
      codeChallengeMethod: route.query.code_challenge_method
    }))

    // Computed states
    const showLoading = computed(() => loading.value || !authIsReady.value)
    const showLogin = computed(() => !showLoading.value && !error.value && !user.value)
    const showConsent = computed(() => !showLoading.value && !error.value && user.value && consentData.value)
    const showError = computed(() => !showLoading.value && error.value)

    // Get display name for a scope
    const getScopeDisplayName = (scope) => {
      return SCOPE_DISPLAY_NAMES[scope] || scope
    }

    // Check if scope is dangerous
    const isDangerousScope = (scope) => {
      return DANGEROUS_SCOPES.includes(scope)
    }

    // Fetch consent page data from backend
    const fetchConsentData = async () => {
      try {
        loading.value = true
        error.value = null

        const params = queryParams.value

        // Validate required parameters
        if (!params.clientId) {
          throw new Error('Missing required parameter: client_id')
        }
        if (!params.redirectUri) {
          throw new Error('Missing required parameter: redirect_uri')
        }
        if (params.responseType && params.responseType !== 'code') {
          throw new Error('Unsupported response_type. Only "code" is supported.')
        }

        // Build request URL
        const url = new URL(process.env.VUE_APP_STARCHAT_URL + '/oauth/authorize')
        url.searchParams.set('response_type', params.responseType || 'code')
        url.searchParams.set('client_id', params.clientId)
        url.searchParams.set('redirect_uri', params.redirectUri)
        if (params.scope) url.searchParams.set('scope', params.scope)
        if (params.state) url.searchParams.set('state', params.state)
        if (params.codeChallenge) url.searchParams.set('code_challenge', params.codeChallenge)
        if (params.codeChallengeMethod) url.searchParams.set('code_challenge_method', params.codeChallengeMethod)

        const response = await axios.get(url.toString())
        consentData.value = response.data
      } catch (err) {
        console.error('Failed to fetch consent data:', err)
        if (err.response?.data) {
          error.value = {
            code: err.response.data.error || 'server_error',
            message: err.response.data.error_description || err.message
          }
        } else {
          error.value = {
            code: 'request_error',
            message: err.message
          }
        }
      } finally {
        loading.value = false
      }
    }

    // Handle approval
    const handleApprove = async () => {
      if (!user.value || !consentData.value) return

      try {
        submitting.value = true

        const token = await user.value.getIdToken()

        const requestBody = {
          clientId: consentData.value.clientId,
          redirectUri: consentData.value.redirectUri,
          approvedScopes: consentData.value.requestedScopes,
          state: consentData.value.state,
          codeChallenge: consentData.value.codeChallenge,
          codeChallengeMethod: consentData.value.codeChallengeMethod,
          createDelegation: true
        }

        const response = await axios.post(
          process.env.VUE_APP_STARCHAT_URL + '/mrcall/v1/mrcall0/oauth/authorize/approve',
          requestBody,
          {
            headers: {
              'Content-Type': 'application/json',
              'auth': token
            }
          }
        )

        // Redirect to partner
        window.location.href = response.data.redirectUrl
      } catch (err) {
        console.error('Failed to approve authorization:', err)
        if (err.response?.data) {
          error.value = {
            code: err.response.data.error || 'server_error',
            message: err.response.data.error_description || err.message
          }
        } else {
          error.value = {
            code: 'request_error',
            message: err.message
          }
        }
      } finally {
        submitting.value = false
      }
    }

    // Handle denial
    const handleDeny = () => {
      if (!consentData.value?.redirectUri) {
        router.push('/')
        return
      }

      const url = new URL(consentData.value.redirectUri)
      url.searchParams.set('error', 'access_denied')
      url.searchParams.set('error_description', 'User denied access')
      if (consentData.value.state) {
        url.searchParams.set('state', consentData.value.state)
      }
      window.location.href = url.toString()
    }

    // Handle sign out
    const handleSignOut = async () => {
      await store.dispatch('logout')
    }

    // Go back to MrCall home
    const goHome = () => {
      router.push('/')
    }

    // Initialize
    onMounted(() => {
      fetchConsentData()
    })

    // Watch for auth state changes
    watch(authIsReady, (ready) => {
      if (ready && !loading.value) {
        // Re-check state when auth becomes ready
      }
    })

    return {
      t,
      loading,
      submitting,
      error,
      consentData,
      user,
      showLoading,
      showLogin,
      showConsent,
      showError,
      getScopeDisplayName,
      isDangerousScope,
      handleApprove,
      handleDeny,
      handleSignOut,
      goHome
    }
  }
}
</script>

<template>
  <div class="oauth-consent-page">
    <!-- Loading State -->
    <div v-if="showLoading" class="oauth-container">
      <div class="oauth-card">
        <div class="logo-container">
          <div class="mrcall-logo"></div>
        </div>
        <div class="loading-content">
          <ProgressSpinner style="width: 50px; height: 50px" strokeWidth="4" />
          <p class="loading-text">Loading...</p>
        </div>
      </div>
    </div>

    <!-- Login Required State -->
    <Sign v-else-if="showLogin">
      <template #title>
        <span v-if="consentData?.clientName">
          Sign in to continue to {{ consentData.clientName }}
        </span>
        <span v-else>
          Sign in to continue
        </span>
      </template>

      <template #content>
        <Signin />
      </template>

      <template #signin-signup-alternative>
        <div class="text-center">
          <span class="companion-text">Don't have an account?</span>
          <span class="companion-text">&nbsp;</span>
          <a href="/signup" class="link">Sign up</a>
        </div>
      </template>
    </Sign>

    <!-- Consent Screen State -->
    <div v-else-if="showConsent" class="oauth-container">
      <div class="oauth-card consent-card">
        <div class="logo-container">
          <div class="mrcall-logo"></div>
        </div>

        <h1 class="consent-title">Authorize Access</h1>

        <p class="consent-description">
          <strong>"{{ consentData.clientName }}"</strong> wants to access your MrCall account
        </p>

        <div v-if="consentData.clientDescription" class="client-description">
          {{ consentData.clientDescription }}
        </div>

        <div class="scopes-container">
          <p class="scopes-title">This will allow {{ consentData.clientName }} to:</p>
          <ul class="scopes-list">
            <li
              v-for="scope in consentData.requestedScopes"
              :key="scope"
              :class="{ 'dangerous-scope': isDangerousScope(scope) }"
            >
              <i class="pi pi-check scope-icon"></i>
              <span>{{ getScopeDisplayName(scope) }}</span>
            </li>
          </ul>
        </div>

        <div class="user-info">
          <p>Signed in as: <strong>{{ user?.email }}</strong></p>
          <a href="#" @click.prevent="handleSignOut" class="link">Not you? Sign out</a>
        </div>

        <div class="button-container">
          <Button
            class="deny-button"
            label="Deny"
            @click="handleDeny"
            :disabled="submitting"
            severity="secondary"
            outlined
          />
          <Button
            class="approve-button"
            label="Approve"
            @click="handleApprove"
            :loading="submitting"
            :disabled="submitting"
          />
        </div>

        <p class="consent-footer">
          By approving, you allow this app to access your data according to their terms of service and privacy policy.
        </p>
      </div>
    </div>

    <!-- Error State -->
    <div v-else-if="showError" class="oauth-container">
      <div class="oauth-card error-card">
        <div class="logo-container">
          <div class="mrcall-logo"></div>
        </div>

        <div class="error-icon">
          <i class="pi pi-exclamation-triangle"></i>
        </div>

        <h1 class="error-title">Authorization Error</h1>

        <p class="error-message">{{ error.message }}</p>

        <p class="error-code">Error: {{ error.code }}</p>

        <Button
          class="home-button"
          label="Back to MrCall"
          @click="goHome"
        />
      </div>
    </div>
  </div>
</template>

<style scoped lang="less">
@import '../../assets/style/colors';

.oauth-consent-page {
  min-height: 100vh;
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  background: @mrcall_background;
  padding: 24px;
  box-sizing: border-box;
}

.oauth-container {
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
}

.oauth-card {
  background: @mrcall_white;
  border-radius: 6px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12), 0 1px 1px rgba(0, 0, 0, 0.14), 0 2px 1px -1px rgba(0, 0, 0, 0.02);
  padding: 48px;
  width: 100%;
  max-width: 500px;
  text-align: center;
}

.logo-container {
  margin-bottom: 32px;
}

.mrcall-logo {
  width: 150px;
  height: 42px;
  margin: 0 auto;
  background: url(../../assets/images/mrcall/logo_menu_mrcall.svg) no-repeat center;
  background-size: contain;
}

// Loading state
.loading-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.loading-text {
  color: @mrcall_grey_text;
  font-size: 16px;
}

// Consent card
.consent-card {
  text-align: left;
}

.consent-title {
  font-family: 'Inter', serif;
  font-weight: 700;
  font-size: 24px;
  color: @mrcall_grey_text;
  margin: 0 0 16px 0;
  text-align: center;
}

.consent-description {
  font-size: 16px;
  color: @mrcall_grey_text;
  margin-bottom: 16px;
  text-align: center;
}

.client-description {
  font-size: 14px;
  color: @mrcall_grey_text2;
  margin-bottom: 24px;
  text-align: center;
}

.scopes-container {
  background: @mrcall_light_grey_2;
  border-radius: 6px;
  padding: 16px;
  margin-bottom: 24px;
}

.scopes-title {
  font-size: 14px;
  font-weight: 600;
  color: @mrcall_dark_grey_text;
  margin: 0 0 12px 0;
}

.scopes-list {
  list-style: none;
  padding: 0;
  margin: 0;

  li {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    padding: 8px 0;
    font-size: 14px;
    color: @mrcall_grey_text;

    &.dangerous-scope {
      color: @mrcall_red;
      font-weight: 600;
    }
  }
}

.scope-icon {
  color: @mrcall_blue;
  font-size: 14px;
  margin-top: 2px;

  .dangerous-scope & {
    color: @mrcall_red;
  }
}

.user-info {
  text-align: center;
  margin-bottom: 24px;

  p {
    font-size: 14px;
    color: @mrcall_grey_text;
    margin: 0 0 8px 0;
  }
}

.link {
  color: @mrcall_blue;
  text-decoration: none;
  font-size: 14px;

  &:hover {
    text-decoration: underline;
  }
}

.button-container {
  display: flex;
  gap: 16px;
  justify-content: center;
  margin-bottom: 24px;
}

.deny-button,
.approve-button {
  min-width: 120px;
}

.approve-button {
  background-color: @mrcall_blue;
  border-color: @mrcall_blue;
}

.consent-footer {
  font-size: 12px;
  color: @mrcall_grey_text2;
  text-align: center;
  margin: 0;
}

// Error card
.error-card {
  text-align: center;
}

.error-icon {
  margin-bottom: 16px;

  i {
    font-size: 48px;
    color: @mrcall_orange;
  }
}

.error-title {
  font-family: 'Inter', serif;
  font-weight: 700;
  font-size: 24px;
  color: @mrcall_grey_text;
  margin: 0 0 16px 0;
}

.error-message {
  font-size: 16px;
  color: @mrcall_grey_text;
  margin-bottom: 8px;
}

.error-code {
  font-size: 14px;
  color: @mrcall_grey_text2;
  margin-bottom: 24px;
}

.home-button {
  background-color: @mrcall_blue;
  border-color: @mrcall_blue;
}

// Mobile responsive
@media screen and (max-width: 640px) {
  .oauth-consent-page {
    padding: 16px;
    align-items: flex-start;
    padding-top: 48px;
  }

  .oauth-card {
    padding: 24px;
  }

  .button-container {
    flex-direction: column-reverse;

    .deny-button,
    .approve-button {
      width: 100%;
    }
  }
}

// Text center helper for Sign component slots
.text-center {
  text-align: center;
}

.companion-text {
  color: @mrcall_grey_text;
  font-size: 14px;
}
</style>
