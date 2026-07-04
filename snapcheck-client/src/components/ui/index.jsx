import { X } from 'lucide-react'
import { STATUS_BADGE, STATUS_LABELS, RISK_BADGE, getAppColor, getAppInitials } from '../../utils/helpers'

export function StatusBadge({ status }) {
  return <span className={`badge ${STATUS_BADGE[status] || 'badge-pending'}`}>{STATUS_LABELS[status] || status}</span>
}

export function RiskBadge({ rating }) {
  if (!rating) return <span style={{color:'var(--ink-ghost)',fontSize:'12px'}}>—</span>
  return <span className={`badge ${RISK_BADGE[rating] || 'badge-pending'}`}>{rating}</span>
}

export function Spinner({ size = 'md', white }) {
  return <span className={`spinner spinner-${size}${white ? ' spinner-white' : ''}`} />
}

export function PageSpinner() {
  return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',minHeight:'200px',flexDirection:'column',gap:'12px'}}>
      <Spinner size="lg" />
      <p style={{fontSize:'13px',color:'var(--ink-soft)'}}>Loading…</p>
    </div>
  )
}

export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="empty-state">
      {Icon && <Icon />}
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {action && <div className="empty-state-action">{action}</div>}
    </div>
  )
}

export function Modal({ open, onClose, title, subtitle, children, footer, size = 'md' }) {
  if (!open) return null
  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className={`modal modal-${size}`}>
        <div className="modal-header">
          <div>
            <div className="modal-title">{title}</div>
            {subtitle && <div className="modal-subtitle">{subtitle}</div>}
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  )
}

export function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmLabel = 'Confirm', danger }) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm"
      footer={<>
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={() => { onConfirm(); onClose() }}>{confirmLabel}</button>
      </>}
    >
      <p style={{fontSize:'14px',color:'var(--ink-soft)'}}>{message}</p>
    </Modal>
  )
}

export function AppAvatar({ name, size = 'sm' }) {
  const { fg, bg } = getAppColor(name)
  const sizes = { sm: {width:32,height:32,fontSize:12,borderRadius:8}, md: {width:40,height:40,fontSize:14,borderRadius:10}, lg: {width:52,height:52,fontSize:16,borderRadius:12} }
  const s = sizes[size] || sizes.sm
  return (
    <div style={{...s, background:bg, color:fg, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, flexShrink:0}}>
      {getAppInitials(name)}
    </div>
  )
}

export function StatCard({ label, value, change, dir = 'up', accent = 'blue' }) {
  return (
    <div className={`stat-card ${accent}`}>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
      {change && <div className={`stat-change ${dir}`}>{change}</div>}
    </div>
  )
}

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="page-header">
      <div>
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  )
}

export function Tabs({ tabs, active, onChange }) {
  return (
    <div className="tabs">
      {tabs.map(tab => (
        <button key={tab.id} className={`tab${active === tab.id ? ' active' : ''}`} onClick={() => onChange(tab.id)}>
          {tab.label}
          {tab.badge != null && <span className="tab-badge">{tab.badge}</span>}
        </button>
      ))}
    </div>
  )
}

export function ProgressBar({ value, color = 'green' }) {
  return (
    <div className="progress">
      <div className={`progress-bar progress-${color}`} style={{width:`${Math.min(100,Math.max(0,value))}%`}} />
    </div>
  )
}
