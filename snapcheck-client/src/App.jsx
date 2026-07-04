import { Routes, Route, Navigate } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/shared/ProtectedRoute'
import ErrorBoundary  from './components/shared/ErrorBoundary'
import AppLayout      from './components/layout/AppLayout'
import { PageSpinner } from './components/ui/index.jsx'

// Always loaded
import LoginPage            from './pages/shared/LoginPage'
import NotFoundPage         from './pages/shared/NotFoundPage'
import UnauthorizedPage     from './pages/shared/UnauthorizedPage'
import MySubmissionsPage    from './pages/submitter/MySubmissionsPage'
import ManagerApprovalsPage from './pages/manager/ApprovalsPage'
import DashboardPage        from './pages/riskteam/DashboardPage'

// Lazy loaded RC pages
const RCApprovalsPage = lazy(() => import('./pages/riskteam/RCApprovalsPage'))
const RepositoryPage  = lazy(() => import('./pages/riskteam/RepositoryPage'))
const AuditPage       = lazy(() => import('./pages/riskteam/AuditPage'))
const ReportsPage     = lazy(() => import('./pages/riskteam/ReportsPage'))
const QuestionLibrary = lazy(() => import('./pages/riskteam/QuestionLibrary'))
const AdminPage       = lazy(() => import('./pages/riskteam/AdminPage'))

function Lazy({ children }) {
  return (
    <ErrorBoundary>
      <Suspense fallback={<PageSpinner />}>{children}</Suspense>
    </ErrorBoundary>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <ErrorBoundary>
        <Routes>
          {/* Public */}
          <Route path="/login"        element={<LoginPage />} />
          <Route path="/unauthorized" element={<UnauthorizedPage />} />

          {/* ── Submitter ─────────────────────────────── */}
          <Route element={<ProtectedRoute allowedRoles={['SUBMITTER']} />}>
            <Route element={<AppLayout />}>
              <Route path="/submissions" element={<Lazy><MySubmissionsPage /></Lazy>} />
            </Route>
          </Route>

          {/* ── Manager ───────────────────────────────── */}
          <Route element={<ProtectedRoute allowedRoles={['MANAGER']} />}>
            <Route element={<AppLayout />}>
              <Route path="/approvals" element={<Lazy><ManagerApprovalsPage /></Lazy>} />
            </Route>
          </Route>

          {/* ── Risk & Compliance ─────────────────────── */}
          <Route element={<ProtectedRoute allowedRoles={['RISK_TEAM']} />}>
            <Route element={<AppLayout />}>
              <Route path="/dashboard"    element={<Lazy><DashboardPage /></Lazy>} />
              <Route path="/rc-approvals" element={<Lazy><RCApprovalsPage /></Lazy>} />
              <Route path="/repository"   element={<Lazy><RepositoryPage /></Lazy>} />
              <Route path="/audit"        element={<Lazy><AuditPage /></Lazy>} />
              <Route path="/reports"      element={<Lazy><ReportsPage /></Lazy>} />
              <Route path="/questions"    element={<Lazy><QuestionLibrary /></Lazy>} />
              <Route path="/admin"        element={<Lazy><AdminPage /></Lazy>} />
            </Route>
          </Route>

          {/* Fallback */}
          <Route path="/"  element={<Navigate to="/login" replace />} />
          <Route path="*"  element={<NotFoundPage />} />
        </Routes>
      </ErrorBoundary>
    </AuthProvider>
  )
}
