import {createStore} from 'vuex'
import VuexPersistence from 'vuex-persist'
import SecureLS from "secure-ls";

// firebase imports
import {auth} from '@/firebase/config'
import {
  createUserWithEmailAndPassword,
  isSignInWithEmailLink,
  onAuthStateChanged,
  onIdTokenChanged,
  sendEmailVerification,
  sendSignInLinkToEmail,
  signInWithCustomToken,
  signInWithEmailAndPassword,
  signInWithEmailLink,
  signOut
} from 'firebase/auth'
import { stopTokenRefresh } from '@/firebase/authUtils'

import calendar from './modules/calendar'  // Import the calendar module
import tracking from './modules/tracking'  // Import the tracking module
import ResellerApi from '@/utils/Reseller'

const ls = new SecureLS({ isCompression: false })

const vuexLocal = new VuexPersistence({
  reducer: (state) => ({
    auth: state.auth,
    onboardingData: state.onboardingData,
    role: state.role,
  }),
  storage: {
    getItem: (key) => ls.get(key),
    setItem: (key, value) => ls.set(key, value),
    removeItem: (key) => ls.remove(key)
  }
})

const store = createStore({
  state: {
    starchat: process.env.VUE_APP_STARCHAT_URL,
    user: null,
    authIsReady: false,
    selectedBusiness: null,
    isWebview: false,
    webviewOsName: "notset",
    createBusinessWithTemplateName: null,
    onboardingData: {},
    role: 'owner',
    managedOwners: [],
    resellerProfile: null,
    managedBy: null,
    selectedOwnerId: null,
  },
  plugins: [
    vuexLocal.plugin
  ],
  mutations: {
    setUser(state, payload) {
      state.user = payload
      console.log('user state changed:', state.user)
    },
    setAuthIsReady(state, payload) {
      state.authIsReady = payload
    },
    setSelectedBusiness(state, payload) {
      state.selectedBusiness = payload
    },
    setWebviewMode(state, payload) {
      state.isWebview = payload
    },
    setOsFromWebview(state, payload) {
      state.webviewOsName = payload
    },
    setCreateBusinessTemplate(state, payload) {
      state.createBusinessWithTemplateName = payload
    },
    setOnboardingData(state, payload) {
      state.onboardingData = payload
    },
    setRole(state, payload) {
      state.role = payload
    },
    setManagedOwners(state, payload) {
      state.managedOwners = payload
    },
    setResellerProfile(state, payload) {
      state.resellerProfile = payload
    },
    setManagedBy(state, payload) {
      state.managedBy = payload
    },
    setSelectedOwnerId(state, payload) {
      state.selectedOwnerId = payload
    },
  },
  actions: {
    async updateUser({ commit }, { user }) {
      commit('setUser', user)
    },
    async logout(context) {
      console.log('logout action')
      stopTokenRefresh()  // Stop token refresh interval
      await signOut(auth)
      // Clear cross-domain auth cookie (safety net — onAuthStateChanged also clears it)
      document.cookie = 'mrcall_uid=; Domain=.mrcall.ai; Path=/; SameSite=Lax; Secure; Max-Age=0'
      context.commit('setUser', null)
      context.commit('setAuthIsReady', false)
      context.commit('setSelectedBusiness', null)
      context.commit('setCreateBusinessTemplate', null)
      context.commit('setOnboardingData', {})
      context.commit('setRole', 'owner')
      context.commit('setManagedOwners', [])
      context.commit('setResellerProfile', null)
      context.commit('setManagedBy', null)
      context.commit('setSelectedOwnerId', null)
      // Clear UTM tracking parameters on logout
      context.dispatch('tracking/clearTrackingParams')
    },
    async deleteFirebaseUser() {
      await auth.currentUser.delete()
    },
    async emailLinkSignup(context, { email }) {
      const url = process.env.VUE_APP_SERVICE_BASE_URL + process.env.VUE_APP_PUBLIC_PATH + '/login?email=' + email + '&signup=true';
      console.debug("SENDLINK:", url)
      var actionCodeSettings = {
        url: url,
        handleCodeInApp: true,
        // When multiple custom dynamic link domains are defined, specify which
        // one to use.
        //dynamicLinkDomain: "angelo.ngrok.io"
      };
      sendSignInLinkToEmail(auth, email, actionCodeSettings)
          .then(() => {
            // The link was successfully sent. Inform the user.
            // Save the email locally so you don't need to ask the user for it again
            // if they open the link on the same device.
            console.debug("Verification email:", email)
            // ...
          }).catch((error) => {
        const errorCode = error.code;
        const errorMessage = error.message;
        console.error(errorCode, errorMessage)
      });
    },
    async completeEmailLinkSignIn(context) {
      // Confirm the link is a sign-in with email link.
      //const auth = getAuth();
      console.log("Location completeEmailLinkSignIn: ", window.location.href)
      const urlParams = new URLSearchParams(window.location.search);
      if (isSignInWithEmailLink(auth, window.location.href)) {
        // Additional state parameters can also be passed via URL.
        // This can be used to continue the user's intended action before triggering
        // the sign-in operation.
        // Get the email if available. This should be available if the user completes
        // the flow on the same device where they started it.
        let email = urlParams.get('email');
        console.debug("EMAIL FOR SIGNIN:", email)
        if (!email) {
          // User opened the link on a different device. To prevent session fixation
          // attacks, ask the user to provide the associated email again. For example:
          email = window.prompt('Please provide your email for confirmation');
        }

        // The client SDK will parse the code from the link for you.
        await signInWithEmailLink(auth, email, window.location.href)
            .then((result) => {
              // Clear email from storage.
              console.debug("SignIn result", result)
              context.commit('setUser', result.user)
              // You can access the new user via result.user
              // Additional user info profile not available via:
              // result.additionalUserInfo.profile == null
              // You can check if the user is new or existing:
              // result.additionalUserInfo.isNewUser
            })
            .catch((error) => {
              console.error(error)
              // Some error occurred, you can inspect the code: error.code
              // Common errors could be invalid email and invalid or expired OTPs.
            });
        return true;
      }
      return false;
    },
    async resendEmailVerification(context) {
      console.log('resendEmailVerification action', context.state)
      const verificationSettings = {
        url: window.location.origin + '/login?confirm_email=true',  // Use current domain
        handleCodeInApp: false
      };
      await sendEmailVerification(context.state.user, verificationSettings)
    },
    async signinCustomToken(context, { token }) {
      console.log('login action')
      const res = await signInWithCustomToken(auth, token)
      if (res) {
        context.commit('setUser', res.user)
      } else {
        throw new Error('could not complete the custom token signin')
      }
    },
    async signup(context, { email, password }) {
      console.log('signup action')
      const res = await createUserWithEmailAndPassword(auth, email, password)
      if (res) {
        // Use the passed actionCodeSettings if provided, otherwise use default URL
        const verificationSettings = {
          url: window.location.origin + '/login?confirm_email=true',  // Use current domain
          handleCodeInApp: false
        };
        
        await sendEmailVerification(res.user, verificationSettings)
        context.commit('setUser', res.user)
        // Claim reseller invitation code if one was captured from ?ref=RES-xxx
        await context.dispatch('claimResellerCode')
      } else {
        throw new Error('could not complete signup')
      }
    },
    async login(context, { email, password }) {
      console.log('login action')
      const res = await signInWithEmailAndPassword(auth, email, password)
      if (res) {
        context.commit('setUser', res.user)
      } else {
        throw new Error('could not complete login')
      }
    },
    clearUser({ commit }) {
      commit('setUser', null)
    },
    async loadResellerData({ commit, state }) {
      const user = state.user
      if (!user) return
      try {
        const [ownersRes, profileRes] = await Promise.all([
          ResellerApi.getManagedOwners(user),
          ResellerApi.getProfile(user)
        ])
        const owners = ownersRes.data || []
        // Backend returns enriched ResellerOwnerMapping objects with ownerEmail, ownerDisplayName, source, invitationCode
        const enriched = owners.map(o => ({
          uid: o.ownerId || o.uid || o,
          displayName: o.ownerDisplayName || '',
          email: o.ownerEmail || '',
          source: o.source || 'admin',
          invitationCode: o.invitationCode || null,
          createdAt: o.createdAt || null
        }))
        commit('setManagedOwners', enriched)
        commit('setResellerProfile', profileRes.data)
      } catch (error) {
        console.error('Failed to load reseller data:', error)
      }
    },
    async loadManagedBy({ commit, state }) {
      const user = state.user
      if (!user) return
      try {
        const res = await ResellerApi.getManagedBy(user)
        commit('setManagedBy', res.data || null)
      } catch {
        commit('setManagedBy', null)
      }
    },
    async claimResellerCode({ state }) {
      const user = state.user
      if (!user) return
      const code = localStorage.getItem('mrcall_reseller_code')
      if (!code) return
      try {
        await ResellerApi.claimCode(user, code)
      } catch (error) {
        console.error('Failed to claim reseller code:', error)
      } finally {
        localStorage.removeItem('mrcall_reseller_code')
      }
    }
  },
  modules: {
    calendar,  // Register the calendar module
    tracking   // Register the tracking module
  }
})

// wait until auth is ready
const unsub1 = onAuthStateChanged(auth, (user) => {
  store.commit('setUser', user)
  store.commit('setAuthIsReady', true)
  unsub1()
})

// wait until auth is ready
const unsub2 = onIdTokenChanged(auth, (user) => {
  store.commit('setUser', user)
  store.commit('setAuthIsReady', true)
  unsub2()
})

// export the store
export default store