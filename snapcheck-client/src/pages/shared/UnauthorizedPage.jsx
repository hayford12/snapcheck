import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { getRoleHome } from '../../config/auth'

export default function UnauthorizedPage() {
  const navigate = useNavigate()
  const { user } = useAuth()

  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'var(--canvas)', flexDirection:'column', gap:'16px', padding:'32px', textAlign:'center' }}>
      <div style={{ fontSize:'80px', lineHeight:1 }}>403</div>
      <h1 style={{ fontSize:'24px', fontWeight:700, color:'var(--ink)', margin:0 }}>Access Denied</h1>
      <p style={{ fontSize:'14px', color:'var(--ink-soft)', maxWidth:'360px', margin:0 }}>
        You do not have permission to view this page.
      </p>
      <button className="btn btn-accent" onClick={() => navigate(user ? getRoleHome(user.role) : '/login')}>
        ← Go to My Dashboard
      </button>
    </div>
  )
}
