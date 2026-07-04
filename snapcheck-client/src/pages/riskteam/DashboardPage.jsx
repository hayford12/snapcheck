import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { CheckCircle, Clock, AlertTriangle, TrendingUp, FileText, Users, Search } from 'lucide-react'
import { dashboardApi, submissionsApi, approvalsApi } from '../../api/services'
import { PageHeader, PageSpinner, StatusBadge, RiskBadge } from '../../components/ui/index.jsx'
import { formatDate } from '../../utils/helpers'

function StatCard({ label, value, colour, sub, onClick, Icon }) {
  return (
    <div onClick={onClick} style={{
      background:'var(--white)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)',
      padding:'20px 24px', borderLeft:`4px solid ${colour}`, cursor: onClick?'pointer':'default',
      transition:'box-shadow 0.15s', display:'flex', alignItems:'center', gap:'16px'
    }}
    onMouseEnter={e=>{ if(onClick) e.currentTarget.style.boxShadow='0 4px 16px rgba(0,0,0,0.08)' }}
    onMouseLeave={e=>{ e.currentTarget.style.boxShadow='none' }}
    >
      <div style={{width:'48px',height:'48px',borderRadius:'12px',background:colour+'18',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
        <Icon size={22} style={{color:colour}}/>
      </div>
      <div style={{flex:1}}>
        <div style={{fontFamily:'var(--font-mono)',fontSize:'36px',fontWeight:600,color:'var(--ink)',lineHeight:1}}>{value??'—'}</div>
        <div style={{fontSize:'12px',fontWeight:600,color:'var(--ink)',marginTop:'6px'}}>{label}</div>
        {sub && <div style={{fontSize:'11px',color:'var(--ink-ghost)',marginTop:'2px'}}>{sub}</div>}
      </div>
      {onClick && <div style={{color:'var(--ink-ghost)',fontSize:'18px'}}>›</div>}
    </div>
  )
}

export default function DashboardPage() {
  const navigate  = useNavigate()
  const [search, setSearch] = useState(null)
  const { data:stats, isLoading } = useQuery({ queryKey:['dashboard-stats'], queryFn:()=>dashboardApi.getStats().then(r=>r.data) })
  const { data:allSubs=[] } = useQuery({ queryKey:['recent-submissions'], queryFn:()=>submissionsApi.getAll().then(r=>r.data) })
  const { data:pending=[] } = useQuery({ queryKey:['pending-approvals-badge'], queryFn:()=>approvalsApi.getPending().then(r=>r.data), refetchInterval:30000 })

  if (isLoading) return <PageSpinner />

  const period          = new Date().toLocaleString('default',{month:'long',year:'numeric'})
  const managerPending  = allSubs.filter(s=>s.status==='SUBMITTED').length
  const rcPending       = pending.filter(s=>s.status==='MANAGER_APPROVED').length
  const allRecent       = [...allSubs].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt))
  const recent          = allRecent.filter(s => {
    if (!search || search === null) return true
    const q = search.toLowerCase()
    return (
      s.application?.name?.toLowerCase().includes(q) ||
      s.user?.name?.toLowerCase().includes(q) ||
      s.period?.includes(q) ||
      s.status?.toLowerCase().includes(q) ||
      `SC-${String(s.id).padStart(4,'0')}`.toLowerCase().includes(q)
    )
  }).slice(0, 10)

  return (
    <>
      <PageHeader title="Dashboard" subtitle={`Compliance overview — ${period}`} />

      {/* Stat cards */}
      <div className="grid-4" style={{marginBottom:'24px'}}>
        <StatCard label="Total Submissions"         value={stats?.total}   colour="var(--blue)"     sub="Click to view recent"      Icon={FileText} onClick={()=>document.getElementById('recent-submissions')?.scrollIntoView({behavior:'smooth'})} />
        <StatCard label="Awaiting Manager Approval"  value={managerPending} colour="var(--amber)"    sub="Pending line manager review"  Icon={Users}    />
        <StatCard label="Awaiting RC Review"         value={rcPending}      colour="var(--absa-red)" sub="Click to review"              Icon={Clock}    onClick={()=>navigate('/rc-approvals')} />
        <StatCard label="Compliance Rate"           value={stats?.rate}     colour="var(--green)"    sub="RC approved / total"   Icon={TrendingUp} />
      </div>

      <div className="grid-2" style={{marginBottom:'24px'}}>
        {/* Risk Distribution */}
        <div className="card">
          <div className="card-header"><div className="card-title">Risk Distribution</div><div className="card-subtitle">All time</div></div>
          <div className="card-body">
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'12px',marginBottom:'20px'}}>
              {[
                {label:'Low',   val:stats?.lowRisk??0,  bg:'#e8f7ef', color:'var(--green)',  border:'#b7dfc9', icon:'🟢'},
                {label:'Medium',val:stats?.medRisk??0,  bg:'#fef8ec', color:'var(--amber)',  border:'#f3d99d', icon:'🟡'},
                {label:'High',  val:stats?.highRisk??0, bg:'#fdecea', color:'var(--accent)', border:'#f5bcb5', icon:'🔴'},
              ].map(r=>(
                <div key={r.label} style={{background:r.bg,border:`1px solid ${r.border}`,borderRadius:'var(--radius-lg)',padding:'20px',textAlign:'center'}}>
                  <div style={{fontSize:'20px',marginBottom:'6px'}}>{r.icon}</div>
                  <div style={{fontFamily:'var(--font-mono)',fontSize:'32px',fontWeight:600,color:r.color}}>{r.val}</div>
                  <div style={{fontSize:'11px',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.06em',color:r.color,marginTop:'4px',opacity:0.8}}>{r.label} Risk</div>
                </div>
              ))}
            </div>

            {/* Status breakdown */}
            <p style={{fontSize:'11px',fontWeight:700,color:'var(--ink-ghost)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:'10px'}}>Status Breakdown</p>
            {[
              {label:'Pending Submission', count:allSubs.filter(s=>s.status==='PENDING').length,          color:'var(--ink-ghost)'},
              {label:'Awaiting Manager',   count:allSubs.filter(s=>s.status==='SUBMITTED').length,        color:'var(--amber)'},
              {label:'Awaiting RC',        count:allSubs.filter(s=>s.status==='MANAGER_APPROVED').length, color:'var(--blue)'},
              {label:'Fully Approved',     count:allSubs.filter(s=>s.status==='RC_APPROVED').length,      color:'var(--green)'},
              {label:'Rejected',           count:allSubs.filter(s=>['MANAGER_REJECTED','RC_REJECTED'].includes(s.status)).length, color:'var(--accent)'},
            ].map(s=>(
              <div key={s.label} style={{display:'flex',alignItems:'center',gap:'10px',marginBottom:'8px'}}>
                <span style={{fontSize:'12px',color:'var(--ink-soft)',flex:1}}>{s.label}</span>
                <div style={{flex:2,height:'6px',background:'var(--canvas-2)',borderRadius:'3px',overflow:'hidden'}}>
                  <div style={{width:`${allSubs.length?Math.round((s.count/allSubs.length)*100):0}%`,height:'100%',background:s.color,borderRadius:'3px',transition:'width 0.6s ease'}}/>
                </div>
                <span style={{fontFamily:'var(--font-mono)',fontSize:'12px',fontWeight:600,color:s.color,width:'24px',textAlign:'right'}}>{s.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Quick actions */}
        <div style={{display:'flex',flexDirection:'column',gap:'16px'}}>
          <div className="card">
            <div className="card-header"><div className="card-title">Quick Actions</div></div>
            <div className="card-body" style={{display:'flex',flexDirection:'column',gap:'10px'}}>
              {[
                {label:'Review RC Approvals', sub:`${rcPending} pending`, colour:'var(--absa-red)', Icon:CheckCircle, path:'/rc-approvals'},
                {label:'View All Submissions', sub:`${allSubs.length} total`, colour:'var(--blue)', Icon:FileText, path:'/rc-approvals', key:'all-submissions'},
                {label:'Evidence Repository', sub:'Browse uploaded files', colour:'var(--amber)', Icon:AlertTriangle, path:'/repository'},
                {label:'Audit Trail', sub:'View all activity', colour:'var(--ink-soft)', Icon:Clock, path:'/audit'},
              ].map((a,i)=>(
                <button key={i} className="btn btn-ghost" onClick={()=>navigate(a.path)}
                  style={{display:'flex',alignItems:'center',gap:'12px',padding:'12px 16px',textAlign:'left',border:'1px solid var(--border)',borderRadius:'var(--radius)',justifyContent:'flex-start'}}>
                  <div style={{width:'36px',height:'36px',borderRadius:'8px',background:a.colour+'18',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                    <a.Icon size={16} style={{color:a.colour}}/>
                  </div>
                  <div>
                    <div style={{fontSize:'13px',fontWeight:600,color:'var(--ink)'}}>{a.label}</div>
                    <div style={{fontSize:'11px',color:'var(--ink-ghost)'}}>{a.sub}</div>
                  </div>
                  <span style={{marginLeft:'auto',color:'var(--ink-ghost)'}}>›</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Recent Submissions — full width */}
      <div className="card" id="recent-submissions">
        <div className="card-header">
          <div>
            <div className="card-title">Recent Submissions</div>
            <div className="card-subtitle">Latest activity across all applications</div>
          </div>
          <button className="btn btn-outline btn-sm" onClick={()=>setSearch(v => v === null ? '' : null)}>
            <Search size={13}/> Search
          </button>
        </div>
        {search !== null && (
          <div style={{padding:'12px 16px',borderBottom:'1px solid var(--border)',background:'var(--canvas)'}}>
            <div style={{position:'relative',maxWidth:'360px'}}>
              <Search size={13} style={{position:'absolute',left:'10px',top:'50%',transform:'translateY(-50%)',color:'var(--ink-ghost)',pointerEvents:'none'}}/>
              <input
                autoFocus
                className="form-control"
                style={{paddingLeft:'32px',fontSize:'13px'}}
                placeholder="Search by app, user, period, status or ID…"
                value={search}
                onChange={e=>setSearch(e.target.value)}
              />
            </div>
          </div>
        )}
        <div style={{overflowX:'auto'}}>
          <table className="data-table">
            <thead>
              <tr><th>ID</th><th>Snapcheck</th><th>Submitted By</th><th>Period</th><th>Date</th><th>Status</th><th>Risk</th></tr>
            </thead>
            <tbody>
              {recent.length===0
                ? <tr><td colSpan={7} style={{textAlign:'center',color:'var(--ink-ghost)',padding:'32px'}}>No submissions yet</td></tr>
                : recent.map(s=>(
                    <tr key={s.id}>
                      <td style={{fontFamily:'var(--font-mono)',fontSize:'12px',color:'var(--ink-soft)'}}>SC-{String(s.id).padStart(4,'0')}</td>
                      <td><span className="app-chip">{s.application?.name}</span></td>
                      <td style={{fontSize:'13px'}}>{s.user?.name}</td>
                      <td style={{fontFamily:'var(--font-mono)',fontSize:'12px'}}>{s.period}</td>
                      <td style={{fontSize:'12px',color:'var(--ink-soft)'}}>{formatDate(s.createdAt)}</td>
                      <td><StatusBadge status={s.status}/></td>
                      <td><RiskBadge rating={s.riskRating?.rating}/></td>
                    </tr>
                  ))
              }
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
