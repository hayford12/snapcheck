import { Bell, CheckCircle, XCircle, Clock, AlertTriangle, RefreshCw } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { notificationsApi } from '../../api/services'
import { formatDateTime } from '../../utils/helpers'

const TYPE_ICONS = {
  approved: <CheckCircle size={14} style={{color:'var(--green)',flexShrink:0}}/>,
  rejected: <XCircle     size={14} style={{color:'var(--accent)',flexShrink:0}}/>,
  pending:  <Clock       size={14} style={{color:'var(--amber)',flexShrink:0}}/>,
  default:  <AlertTriangle size={14} style={{color:'var(--blue)',flexShrink:0}}/>,
}

export default function NotificationPanel({ onClose }) {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['notifications'],
    queryFn:  () => notificationsApi.getAll().then(r => r.data),
    refetchInterval: 60000, // poll every 60 seconds
    staleTime: 30000,
  })

  const notifications = data?.data || data || []
  const unread = notifications.length

  return (
    <div className="notif-panel" style={{zIndex:300}}>
      <div className="notif-panel-header">
        <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
          <Bell size={14} style={{color:'var(--ink-soft)'}}/>
          <span style={{fontSize:'13px',fontWeight:700}}>Notifications</span>
          {unread > 0 && (
            <span style={{background:'var(--accent)',color:'white',fontSize:'10px',fontWeight:700,padding:'1px 7px',borderRadius:'20px'}}>{unread}</span>
          )}
        </div>
        <div style={{display:'flex',gap:'6px'}}>
          <button className="btn btn-ghost btn-sm" style={{padding:'3px 6px'}} onClick={()=>refetch()} title="Refresh">
            <RefreshCw size={12}/>
          </button>
          <button className="btn btn-ghost btn-sm" style={{fontSize:'11px',padding:'3px 8px'}} onClick={onClose}>Close</button>
        </div>
      </div>

      <div style={{maxHeight:'300px',overflowY:'auto'}}>
        {isLoading && (
          <div style={{padding:'24px',textAlign:'center',color:'var(--ink-ghost)',fontSize:'13px'}}>
            Loading notifications…
          </div>
        )}
        {isError && (
          <div style={{padding:'16px',textAlign:'center',color:'var(--accent)',fontSize:'13px'}}>
            Failed to load notifications.{' '}
            <button onClick={()=>refetch()} style={{color:'var(--blue)',background:'none',border:'none',cursor:'pointer',fontSize:'13px'}}>Retry</button>
          </div>
        )}
        {!isLoading && !isError && notifications.length === 0 && (
          <div style={{padding:'24px',textAlign:'center',color:'var(--ink-ghost)',fontSize:'13px'}}>
            No notifications
          </div>
        )}
        {!isLoading && notifications.map(n => (
          <div key={n.id} className="notif-item">
            {TYPE_ICONS[n.type] || TYPE_ICONS.default}
            <div style={{flex:1,minWidth:0}}>
              <div className="notif-text"><strong>{n.title}</strong> — {n.body}</div>
              <div className="notif-time">{formatDateTime(n.time)}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{padding:'10px 16px',textAlign:'center',borderTop:'1px solid var(--border)'}}>
        <span style={{fontSize:'12px',color:'var(--ink-ghost)'}}>Auto-refreshes every 60 seconds</span>
      </div>
    </div>
  )
}
