import { onAuthStateChanged } from 'firebase/auth'
import { auth } from './config'
import store from '../store'

let tokenRefreshInterval = null

// Setup auth state listener
export function setupAuthListener() {
  onAuthStateChanged(auth, (user) => {
    store.commit('setUser', user)
    store.commit('setAuthIsReady', true)

    // Start proactive token refresh when user is authenticated
    if (user && !user.isAnonymous) {
      // Set cross-domain cookie so mrcall.ai can detect logged-in users
      document.cookie = `mrcall_uid=${user.uid}; Domain=.mrcall.ai; Path=/; SameSite=Lax; Secure; Max-Age=${30 * 24 * 60 * 60}`
      startTokenRefresh()
    } else {
      // Clear cross-domain auth cookie
      document.cookie = 'mrcall_uid=; Domain=.mrcall.ai; Path=/; SameSite=Lax; Secure; Max-Age=0'
      stopTokenRefresh()
    }
  })
}

// Function to proactively refresh token
export async function refreshAuthToken() {
  const user = auth.currentUser
  if (user) {
    try {
      const token = await user.getIdToken(true)
      console.log('Token refreshed successfully')
      return token
    } catch (error) {
      console.error("Failed to refresh token:", error)
      return false
    }
  }
  return false
}

// Start proactive token refresh every 50 minutes (Firebase tokens expire after 1 hour)
export function startTokenRefresh() {
  // Clear any existing interval
  stopTokenRefresh()

  console.log('Starting proactive token refresh (every 50 minutes)')

  // Refresh token every 50 minutes (3000000 ms)
  tokenRefreshInterval = setInterval(async () => {
    const user = auth.currentUser
    if (user && !user.isAnonymous) {
      console.log('Proactively refreshing token...')
      await refreshAuthToken()
    } else {
      stopTokenRefresh()
    }
  }, 50 * 60 * 1000) // 50 minutes
}

// Stop token refresh interval
export function stopTokenRefresh() {
  if (tokenRefreshInterval) {
    console.log('Stopping token refresh')
    clearInterval(tokenRefreshInterval)
    tokenRefreshInterval = null
  }
}

export { auth } 