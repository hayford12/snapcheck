import axios from 'axios'
import { TOKEN_KEY, isTokenExpired } from '../config/auth'

export const AUTH_EVENTS = { UNAUTHORIZED: 'snapcheck:unauthorized' }
export function emitUnauthorized() {
  window.dispatchEvent(new CustomEvent(AUTH_EVENTS.UNAUTHORIZED))
}

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
  timeout: 20000,
})

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem(TOKEN_KEY)
    if (token) {
      if (isTokenExpired(token)) { emitUnauthorized(); return Promise.reject(new Error('Token expired')) }
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status  = error.response?.status
    const message = error.response?.data?.message || error.message || 'An unexpected error occurred'
    error.normalizedMessage = message
    error.statusCode        = status
    if (status === 401) emitUnauthorized()
    if (status === 403) error.normalizedMessage = 'You do not have permission to perform this action.'
    if (status >= 500) error.normalizedMessage = 'Server error. Please try again later.'
    if (!error.response) error.normalizedMessage = 'Network error. Please check your connection.'
    return Promise.reject(error)
  }
)

export default api
