import { useEffect } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { getRoleHome } from '../../config/auth'

export default function ProtectedRoute({ allowedRoles }) {
  const { user, loading, isAuthenticated, saveIntendedRoute } = useAuth()
  const location = useLocation()

  // Save intended route before redirecting to login
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      saveIntendedRoute(location.pathname)
    }
  }, [loading, isAuthenticated, location.pathname, saveIntendedRoute])

  if (loading) {
    return (
      <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'var(--canvas)', flexDirection:'column', gap:'12px' }}>
        <span className="spinner spinner-lg" />
        <p style={{ fontSize:'13px', color:'var(--ink-soft)' }}>Loading…</p>
      </div>
    )
  }

  if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: location }} />

  if (allowedRoles && !allowedRoles.includes(user?.role)) {
    return <Navigate to={getRoleHome(user?.role)} replace />
  }

  return <Outlet />
}
