import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { LayoutGrid, ClipboardList, CheckCircle, FolderOpen, Shield, BarChart2, Edit3, Settings, Bell, LogOut, ChevronLeft, ChevronRight } from 'lucide-react'
import ChangePasswordModal from '../shared/ChangePasswordModal'
import { useAuth } from '../../context/AuthContext'
import { getInitials } from '../../utils/helpers'
import { ROLE_LABELS } from '../../config/auth'
import NotificationPanel from '../ui/NotificationPanel'
import { approvalsApi, submissionsApi } from '../../api/services'

const BASE_NAV = {
  SUBMITTER: [
    { to:'/submissions', label:'My Submissions', Icon:ClipboardList },
  ],
  MANAGER: [
    { to:'/approvals', label:'Approvals', Icon:CheckCircle, badgeKey:'managerPending' },
  ],
  RISK_TEAM: [
    { to:'/dashboard',    label:'Dashboard',       Icon:LayoutGrid },
    { to:'/rc-approvals', label:'Approvals',        Icon:CheckCircle, badgeKey:'rcPending' },
    { to:'/repository',   label:'Evidence',         Icon:FolderOpen },
    { to:'/audit',        label:'Audit Trail',      Icon:Shield },
    { to:'/reports',      label:'Reports',          Icon:BarChart2 },
    { to:'/questions',    label:'Question Library', Icon:Edit3 },
    { to:'/admin',        label:'Administration',   Icon:Settings },
  ],
}

function useLiveBadges(role) {
  const { data: pending = [] } = useQuery({
    queryKey: ['pending-approvals-badge'],
    queryFn:  () => approvalsApi.getPending().then(r => r.data),
    refetchInterval: 30000,
    enabled: role === 'MANAGER' || role === 'RISK_TEAM',
  })
  if (role === 'MANAGER') return { managerPending: pending.length || undefined }
  if (role === 'RISK_TEAM') {
    const rcPending = pending.filter(s => s.status === 'MANAGER_APPROVED').length
    return { rcPending: rcPending || undefined }
  }
  return {}
}

export default function AppLayout() {
  const { user, logout }       = useAuth()
  const [showNotif, setShowNotif]       = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [collapsed, setCollapsed]       = useState(false)
  const [showChangePwd, setShowChangePwd] = useState(false)

  const badges    = useLiveBadges(user?.role)
  const baseItems = BASE_NAV[user?.role] || []
  const navItems  = baseItems.map(item => ({
    ...item,
    badge: item.badgeKey ? badges[item.badgeKey] : undefined,
  }))
  const initials  = getInitials(user?.name)
  const roleLabel = ROLE_LABELS[user?.role] || ''

  const { data: allSubs = [] } = useQuery({
    queryKey: ['sidebar-progress'],
    queryFn:  () => submissionsApi.getAll().then(r => r.data),
    refetchInterval: 60000,
    enabled: user?.role === 'RISK_TEAM',
  })
  const currentPeriod = new Date().toISOString().substring(0, 7)
  const periodSubs    = allSubs.filter(s => s.period === currentPeriod)
  const totalApps     = 12

  const hasSidebar = user?.role === 'RISK_TEAM' || user?.role === 'MANAGER' || user?.role === 'SUBMITTER'

  return (
    <div className="app-shell" style={{ flexDirection:'row' }}>

      {/* Sidebar */}
      {hasSidebar && (
        <aside style={{
          width: collapsed ? '60px' : '220px',
          minHeight: '100vh',
          background: 'var(--white)',
          borderRight: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
          transition: 'width 0.2s ease',
          overflow: 'hidden',
          position: 'sticky',
          top: 0,
          height: '100vh',
        }}>

          {/* Brand */}
          <div style={{ padding: collapsed ? '16px 0' : '20px 16px', display:'flex', alignItems:'center', gap:'10px', borderBottom:'2px solid var(--absa-red)', justifyContent: collapsed ? 'center' : 'flex-start', flexShrink:0 }}>
            <img src="/absa-logo.png" alt="ABSA" style={{ width:'32px', height:'32px', borderRadius:'5px', objectFit:'cover', flexShrink:0 }} />
            {!collapsed && (
              <div style={{ lineHeight:1.2, overflow:'hidden' }}>
                <div style={{ fontSize:'13px', fontWeight:700, color:'var(--ink)', whiteSpace:'nowrap' }}>SnapCheck</div>
                <div style={{ fontSize:'10px', color:'var(--ink-ghost)', textTransform:'uppercase', letterSpacing:'0.05em' }}>Compliance</div>
              </div>
            )}
          </div>

          {/* Nav links */}
          <nav style={{ flex:1, padding:'12px 0', overflowY:'auto' }}>
            {!collapsed && <p style={{ fontSize:'10px', fontWeight:700, color:'var(--ink-ghost)', textTransform:'uppercase', letterSpacing:'0.1em', padding:'0 16px', marginBottom:'6px' }}>Navigation</p>}
            {navItems.map(({ to, label, Icon, badge }) => (
              <NavLink key={to} to={to}
                className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
                style={{ justifyContent: collapsed ? 'center' : 'flex-start', padding: collapsed ? '10px 0' : '9px 16px', position:'relative' }}
                title={collapsed ? label : undefined}
              >
                <Icon size={16} style={{ flexShrink:0 }} />
                {!collapsed && <span style={{ flex:1 }}>{label}</span>}
                {!collapsed && badge && <span className="sidebar-badge">{badge}</span>}
                {collapsed && badge && (
                  <span style={{ position:'absolute', top:'6px', right:'6px', background:'var(--accent)', color:'white', fontSize:'9px', fontWeight:700, padding:'1px 4px', borderRadius:'10px', minWidth:'14px', textAlign:'center' }}>{badge}</span>
                )}
              </NavLink>
            ))}
          </nav>

          {/* Period widget — only when expanded */}
          {!collapsed && user?.role === 'RISK_TEAM' && (
            <div style={{ margin:'0 12px 12px', padding:'12px', border:'1px solid var(--border)', borderRadius:'var(--radius)', flexShrink:0 }}>
              <p style={{ fontSize:'10px', fontWeight:700, color:'var(--ink-ghost)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:'6px' }}>Current Period</p>
              <p style={{ fontSize:'13px', fontWeight:600 }}>{new Date().toLocaleString('en-GB', { month:'long', year:'numeric' })}</p>
              <p style={{ fontSize:'11px', color:'var(--ink-soft)', marginTop:'2px' }}>
                Due: {new Date(new Date().getFullYear(), new Date().getMonth()+1, 0).getDate()}{' '}
                {new Date().toLocaleString('en-GB', { month:'short' })}
              </p>
              <div className="progress" style={{ marginTop:'8px' }}>
                <div className="progress-bar" style={{ width:`${Math.round((periodSubs.length/totalApps)*100)}%`, background:'var(--absa-red)' }} />
              </div>
              <p style={{ fontSize:'10px', color:'var(--ink-ghost)', marginTop:'4px' }}>{periodSubs.length} of {totalApps} submitted</p>
            </div>
          )}

          {/* User section */}
          <div style={{ borderTop:'1px solid var(--border)', padding: collapsed ? '12px 0' : '12px 16px', flexShrink:0 }}>
            {!collapsed && (
              <div style={{ marginBottom:'8px' }}>
                <div style={{ fontSize:'13px', fontWeight:600, color:'var(--ink)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{user?.name}</div>
                <div style={{ fontSize:'11px', color:'var(--ink-ghost)' }}>{roleLabel}</div>
              </div>
            )}
            <div style={{ display:'flex', gap:'6px', justifyContent: collapsed ? 'center' : 'flex-start' }}>
              {/* Notifications */}
              <div style={{ position:'relative' }}>
                <button className="topbar-notif" style={{ background:'var(--canvas)', border:'1px solid var(--border)' }}
                  onClick={() => { setShowNotif(v => !v); setShowUserMenu(false) }} title="Notifications">
                  <Bell size={14} style={{ color:'var(--ink-soft)' }} />
                  <span className="notif-dot" />
                </button>
                {showNotif && <NotificationPanel onClose={() => setShowNotif(false)} />}
              </div>
              {/* Sign out */}
              <button title="Sign out" onClick={logout}
                style={{ width:'32px', height:'32px', borderRadius:'50%', background:'var(--canvas)', border:'1px solid var(--border)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <LogOut size={14} style={{ color:'var(--accent)' }} />
              </button>
            </div>
          </div>

          {/* Collapse toggle */}
          <button onClick={() => setCollapsed(v => !v)}
            style={{ position:'absolute', top:'50%', right:'-12px', transform:'translateY(-50%)', width:'24px', height:'24px', borderRadius:'50%', background:'var(--white)', border:'1px solid var(--border)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', zIndex:10, boxShadow:'0 1px 4px rgba(0,0,0,0.1)' }}>
            {collapsed ? <ChevronRight size={12}/> : <ChevronLeft size={12}/>}
          </button>
        </aside>
      )}

      {/* Main content */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', minHeight:'100vh', overflow:'hidden' }}>
        <main className="app-content" style={{ flex:1 }}>
          <div className="page-wrap">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Mobile bottom nav */}
      {user?.role === 'RISK_TEAM' && (
        <nav className="mobile-nav">
          {navItems.slice(0,5).map(({ to, label, Icon, badge }) => (
            <NavLink key={to} to={to} className={({ isActive }) => `mobile-nav-link${isActive?' active':''}`}>
              {badge && <span className="mobile-nav-badge">{badge}</span>}
              <Icon size={18}/>
              <span>{label.split(' ')[0]}</span>
            </NavLink>
          ))}
        </nav>
      )}
      {user?.role === 'MANAGER' && (
        <nav className="mobile-nav">
          {navItems.map(({ to, label, Icon, badge }) => (
            <NavLink key={to} to={to} className={({ isActive }) => `mobile-nav-link${isActive?' active':''}`}>
              {badge && <span className="mobile-nav-badge">{badge}</span>}
              <Icon size={18}/>
              <span>{label.split(' ')[0]}</span>
            </NavLink>
          ))}
        </nav>
      )}

      {(showNotif || showUserMenu) && (
        <div style={{ position:'fixed', inset:0, zIndex:99 }}
          onClick={() => { setShowNotif(false); setShowUserMenu(false) }} />
      )}
      {showChangePwd && (
        <ChangePasswordModal
          open={showChangePwd}
          onClose={()=>setShowChangePwd(false)}
        />
      )}
    </div>
  )
}
