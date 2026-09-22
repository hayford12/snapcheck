import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { getErrorMessage } from '../../utils/helpers'
import { Spinner } from '../../components/ui/index.jsx'
import ChangePasswordModal from '../../components/shared/ChangePasswordModal'

export default function LoginPage() {
  const { login } = useAuth()
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')
  const [forcedChange, setForcedChange] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">

        {/* Left — form */}
        <div className="login-left">
          <div className="login-brand">
            <img src="/absa-logo.png" alt="ABSA" className="login-logo" />
            <div>
              <div className="login-brand-name">SnapCheck</div>
              <div className="login-brand-sub">Compliance Platform</div>
            </div>
          </div>

          <h1 className="login-title">Sign in</h1>
          <p className="login-sub">Enter your credentials to access the platform</p>

          {error && (
            <div className="login-error">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input className="form-control" type="email" required
                value={email} onChange={e => setEmail(e.target.value)}
                placeholder="you@company.com" />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <input className="form-control" type="password" required
                value={password} onChange={e => setPassword(e.target.value)}
                placeholder="••••••••" />
            </div>
            <button type="submit" className="btn btn-accent" disabled={loading}
              style={{ width:'100%', padding:'12px', marginTop:'8px', fontSize:'14px', display:'flex', alignItems:'center', justifyContent:'center', gap:'8px' }}>
              {loading
                ? <><Spinner size="sm" white /> Signing in…</>
                : <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                      <path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4M10 17l5-5-5-5M15 12H3"/>
                    </svg>
                    Sign In
                  </>
              }
            </button>
          </form>
        </div>

        {/* Right — branding panel */}
        <div className="login-right">
          <div className="login-right-content">
            <div className="login-right-logo">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="1.5">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                <path d="M9 12l2 2 4-4" stroke="rgba(255,255,255,0.9)" strokeWidth="1.5"/>
              </svg>
            </div>
            <h2 className="login-right-title">SnapCheck</h2>
            <p className="login-right-sub">Compliance Management Platform</p>

            <div className="login-right-divider" />

            <div className="login-right-features">
              {[
                'Structured snap check questionnaires',
                'Two-stage approval workflow',
                'Evidence file upload & repository',
                'Full audit trail & Excel export',
                'Risk rating & compliance reporting',
              ].map((f, i) => (
                <div key={i} className="login-feature-item">
                  <div className="login-feature-dot" />
                  <span>{f}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="login-right-footer">
            <span>Powered by ABSA · Internal use only</span>
          </div>
        </div>
      </div>
      {forcedChange && (
        <ChangePasswordModal
          open={forcedChange}
          forced={true}
          onClose={() => setForcedChange(false)}
        />
      )}
    </div>
  )
}
