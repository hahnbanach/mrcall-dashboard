import axios from 'axios'
import { auth } from './config'
import store from '../store'
import router from '@/router'

// Track if we're currently refreshing the token to avoid multiple simultaneous refreshes
let isRefreshing = false
let failedQueue = []

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error)
    } else {
      prom.resolve(token)
    }
  })

  failedQueue = []
}

// Response interceptor to handle 401 errors and refresh tokens
axios.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    // If error is 401 and we haven't retried yet
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // If already refreshing, queue this request
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        }).then(token => {
          if (originalRequest.headers['auth']) {
            originalRequest.headers['auth'] = token
          } else {
            originalRequest.headers['Authorization'] = 'Bearer ' + token
          }
          return axios(originalRequest)
        }).catch(err => {
          return Promise.reject(err)
        })
      }

      originalRequest._retry = true
      isRefreshing = true

      const user = auth.currentUser

      if (!user) {
        // No user, logout and redirect
        isRefreshing = false
        await store.dispatch('logout')
        router.push('/login')
        return Promise.reject(error)
      }

      try {
        // Try to refresh the token
        console.log('Token expired, refreshing...')
        const newToken = await user.getIdToken(true)

        // Update the failed request with new token (preserve original auth format)
        if (originalRequest.headers['auth']) {
          originalRequest.headers['auth'] = newToken
        } else {
          originalRequest.headers['Authorization'] = 'Bearer ' + newToken
        }

        // Process any queued requests
        processQueue(null, newToken)

        isRefreshing = false

        // Retry the original request
        return axios(originalRequest)
      } catch (refreshError) {
        // Token refresh failed, logout user
        console.error('Token refresh failed:', refreshError)
        processQueue(refreshError, null)
        isRefreshing = false

        await store.dispatch('logout')
        router.push('/login')

        return Promise.reject(refreshError)
      }
    }

    return Promise.reject(error)
  }
)

export default axios
