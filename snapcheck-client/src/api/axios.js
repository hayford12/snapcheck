import axios from 'axios'
import { TOKEN_KEY, USER_KEY, isTokenExpired } from '../config/auth'

// ── Custom auth event (avoids window.location.href in interceptor) ────────────
export const AUTH_EVENTS = {
  UNAUTHORIZED: 'snapcheck:unauthorized',
}
export function emitUnauthorized() {
  window.dispatchEvent(new CustomEvent(AUTH_EVENTS.UNAUTHORIZED))
}

// ── Axios instance ────────────────────────────────────────────────────────────
const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
  timeout: 20000,
})

// ── Request interceptor — attach token automatically ─────────────────────────
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem(TOKEN_KEY)
    if (token) {
      // Check expiry before sending
      if (isTokenExpired(token)) {
        emitUnauthorized()
        return Promise.reject(new Error('Token expired'))
      }
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// ── Response interceptor — normalise errors, handle 401 ──────────────────────
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status  = error.response?.status
    const message = error.response?.data?.message || error.message || 'An unexpected error occurred'

    // Normalise error shape
    error.normalizedMessage = message
    error.statusCode        = status

    if (status === 401) {
      // Emit event — let AuthContext handle the redirect cleanly
      emitUnauthorized()
    }

    if (status === 403) {
      error.normalizedMessage = 'You do not have permission to perform this action.'
    }

    if (status >= 500) {
      error.normalizedMessage = 'Server error. Please try again later.'
    }

    if (!error.response) {
      error.normalizedMessage = 'Network error. Please check your connection.'
    }

    return Promise.reject(error)
  }
)

export default api
