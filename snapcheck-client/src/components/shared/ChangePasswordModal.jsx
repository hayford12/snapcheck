import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import api from '../../api/axios'
import toast from 'react-hot-toast'
import { Modal, Spinner } from '../ui/index.jsx'
import { Eye, EyeOff, CheckCircle, XCircle } from 'lucide-react'

function StrengthCheck({ password }) {
  const checks = [
    { label: 'At least 12 characters',                     pass: password.length >= 12 },
    { label: 'Contains uppercase letter (A-Z)',             pass: /[A-Z]/.test(password) },
    { label: 'Contains lowercase letter (a-z)',             pass: /[a-z]/.test(password) },
    { label: 'Contains digit (0-9)',                        pass: /[0-9]/.test(password) },
    { label: 'Contains special character ($,#,@,!,%...)',   pass: /[$#@!%^&*(),.]/.test(password) },
  ]

  const typesPass = [checks[1].pass, checks[2].pass, checks[3].pass, checks[4].pass].filter(Boolean).length
  const allGood   = checks[0].pass && typesPass >= 3

  if (!password) return null

  return (
    <div style={{ marginTop:'8px', padding:'12px', background:'var(--canvas)', borderRadius:'var(--radius)', border:'1px solid var(--border)' }}>
      <p style={{ fontSize:'11px', fontWeight:700, color:'var(--ink-ghost)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'8px' }}>
        Password requirements
      </p>
      {checks.map((c, i) => (
        <div key={i} style={{ display:'flex', alignItems:'center', gap:'6px', marginBottom:'4px' }}>
          {c.pass
            ? <CheckCircle size={12} style={{ color:'var(--green)', flexShrink:0 }}/>
            : <XCircle    size={12} style={{ color:'var(--ink-ghost)', flexShrink:0 }}/>
          }
          <span style={{ fontSize:'12px', color: c.pass ? 'var(--green)' : 'var(--ink-soft)' }}>{c.label}</span>
        </div>
      ))}
      {typesPass < 3 && password && (
        <p style={{ fontSize:'11px', color:'var(--accent)', marginTop:'6px' }}>
          ⚠️ Must meet at least 3 of the 4 character type requirements
        </p>
      )}
    </div>
  )
}

export default function ChangePasswordModal({ open, onClose, forced = false }) {
  const { logout } = useAuth()
  const navigate = useNavigate()
  const [current,  setCurrent]  = useState('')
  const [newPwd,   setNewPwd]   = useState('')
  const [confirm,  setConfirm]  = useState('')
  const [showCurr, setShowCurr] = useState(false)
  const [showNew,  setShowNew]  = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (newPwd !== confirm) {
      setError('New passwords do not match')
      return
    }

    setLoading(true)
    try {
      await api.post('/auth/change-password', {
        currentPassword: current,
        newPassword:     newPwd,
      })
      toast.success('Password changed successfully! Please log in with your new password.')
      if (forced) {
        // Clear session and redirect to login
        setTimeout(() => {
          logout()
        }, 1500)
      } else {
        onClose()
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to change password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={forced ? undefined : onClose}
      title={forced ? '🔒 Password Change Required' : 'Change Password'}
      subtitle={forced
        ? 'You must set a new password before you can continue.'
        : 'Update your password to keep your account secure.'
      }
      size="sm"
      footer={
        <>
          {!forced && <button className="btn btn-ghost" onClick={onClose}>Cancel</button>}
          <button className="btn btn-accent" onClick={handleSubmit} disabled={loading}>
            {loading ? <><Spinner size="sm" white/> Changing…</> : 'Change Password'}
          </button>
        </>
      }
    >
      {error && (
        <div style={{ background:'var(--accent-pale)', border:'1px solid var(--accent)', borderRadius:'var(--radius)', padding:'10px 14px', fontSize:'13px', color:'var(--accent)', marginBottom:'16px' }}>
          {error}
        </div>
      )}

      <div className="form-group">
        <label className="form-label">Current Password</label>
        <div style={{ position:'relative' }}>
          <input className="form-control" type={showCurr ? 'text' : 'password'}
            value={current} onChange={e=>setCurrent(e.target.value)}
            placeholder="Enter current password" style={{ paddingRight:'40px' }}/>
          <button type="button" onClick={()=>setShowCurr(!showCurr)}
            style={{ position:'absolute', right:'10px', top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'var(--ink-ghost)' }}>
            {showCurr ? <EyeOff size={15}/> : <Eye size={15}/>}
          </button>
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">New Password</label>
        <div style={{ position:'relative' }}>
          <input className="form-control" type={showNew ? 'text' : 'password'}
            value={newPwd} onChange={e=>setNewPwd(e.target.value)}
            placeholder="Enter new password" style={{ paddingRight:'40px' }}/>
          <button type="button" onClick={()=>setShowNew(!showNew)}
            style={{ position:'absolute', right:'10px', top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'var(--ink-ghost)' }}>
            {showNew ? <EyeOff size={15}/> : <Eye size={15}/>}
          </button>
        </div>
        <StrengthCheck password={newPwd}/>
      </div>

      <div className="form-group">
        <label className="form-label">Confirm New Password</label>
        <input className="form-control" type="password"
          value={confirm} onChange={e=>setConfirm(e.target.value)}
          placeholder="Confirm new password"
          style={{ borderColor: confirm && confirm !== newPwd ? 'var(--accent)' : undefined }}/>
        {confirm && confirm !== newPwd && (
          <p style={{ fontSize:'12px', color:'var(--accent)', marginTop:'4px' }}>Passwords do not match</p>
        )}
      </div>
    </Modal>
  )
}
