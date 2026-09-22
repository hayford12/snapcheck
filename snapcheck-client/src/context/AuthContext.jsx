import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import api, { AUTH_EVENTS, emitUnauthorized } from '../api/axios'
import { TOKEN_KEY, USER_KEY, getRoleHome, isTokenExpired } from '../config/auth'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState(null)
  const navigate   = useNavigate()
  const location   = useLocation()
  const intentRef  = useRef(null) // preserve last visited route

  // ── Validate session on app load ──────────────────────────────────────────
  useEffect(() => {
    async function validateSession() {
      const token = localStorage.getItem(TOKEN_KEY)

      if (!token || isTokenExpired(token)) {
        // Token missing or expired — clear and show login
        clearSession()
        setLoading(false)
        return
      }

      // Set token header then validate with server
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`
      try {
        const { data: res } = await api.get('/auth/me')
        setUser(res.data || res)  // handle both { success, data } and plain response
      } catch {
        // Token invalid on server side
        clearSession()
      } finally {
        setLoading(false)
      }
    }
    validateSession()
  }, [])

  // ── Listen for global unauthorized event ─────────────────────────────────
  useEffect(() => {
    function handleUnauthorized() {
      clearSession()
      navigate('/login', { replace: true })
    }
    window.addEventListener(AUTH_EVENTS.UNAUTHORIZED, handleUnauthorized)
    return () => window.removeEventListener(AUTH_EVENTS.UNAUTHORIZED, handleUnauthorized)
  }, [navigate])


  // ── Proactive token refresh ───────────────────────────────────────────────
  useEffect(() => {
    if (!user) return
    
    const checkAndRefresh = async () => {
      const token = localStorage.getItem(TOKEN_KEY)
      if (!token) return
      
      try {
        const payload = JSON.parse(atob(token.split('.')[1]))
        const expiresIn = payload.exp * 1000 - Date.now()
        
        // Refresh if less than 1 hour remaining
        if (expiresIn < 60 * 60 * 1000 && expiresIn > 0) {
          const { data: res } = await api.post('/auth/refresh')
          const { token: newToken, user: updatedUser } = res.data || res
          api.defaults.headers.common['Authorization'] = `Bearer ${newToken}`
          localStorage.setItem(TOKEN_KEY, newToken)
          localStorage.setItem(USER_KEY, JSON.stringify(updatedUser))
          setUser(updatedUser)
        }
      } catch {
        // Refresh failed — will be caught on next request
      }
    }
    
    // Check on mount and every 15 minutes
    checkAndRefresh()
    const interval = setInterval(checkAndRefresh, 15 * 60 * 1000)
    return () => clearInterval(interval)
  }, [user])

  function clearSession() {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    delete api.defaults.headers.common['Authorization']
    setUser(null)
  }

  // ── Login ─────────────────────────────────────────────────────────────────
  const login = useCallback(async (email, password) => {
    setAuthError(null)
    try {
      const { data } = await api.post('/auth/login', { email, password })
      const { token, user: userData } = data

      api.defaults.headers.common['Authorization'] = `Bearer ${token}`
      localStorage.setItem(TOKEN_KEY, token)
      localStorage.setItem(USER_KEY, JSON.stringify(userData))
      setUser(userData)

      // Check if password change required — don't redirect yet
      if (userData.mustChangePassword || userData.passwordExpired) {
        return { success: true, user: userData, mustChangePassword: true }
      }

      // Redirect to intended page or role home
      const intended = intentRef.current
      intentRef.current = null
      navigate(intended || getRoleHome(userData.role), { replace: true })
      return { success: true, user: userData }
    } catch (err) {
      const msg = err.response?.data?.message || err.normalizedMessage || 'Login failed. Please try again.'
      setAuthError(msg)
      return { success: false, error: msg }
    }
  }, [navigate])

  // ── Logout ────────────────────────────────────────────────────────────────
  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout')
    } catch {
      // Ignore logout errors — clear session regardless
    } finally {
      clearSession()
      navigate('/login', { replace: true })
    }
  }, [navigate])

  // ── Save intended route (called by ProtectedRoute before redirect) ────────
  const saveIntendedRoute = useCallback((path) => {
    intentRef.current = path
  }, [])

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      authError,
      login,
      logout,
      saveIntendedRoute,
      isAuthenticated: !!user,
      clearAuthError: () => setAuthError(null),
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
