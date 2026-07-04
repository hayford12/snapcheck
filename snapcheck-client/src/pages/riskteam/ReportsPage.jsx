import { useQuery } from '@tanstack/react-query'
import { BarChart2, Download } from 'lucide-react'
import * as XLSX from 'xlsx'
import { submissionsApi, dashboardApi } from '../../api/services'
import { PageHeader, PageSpinner, RiskBadge } from '../../components/ui/index.jsx'
import { formatDate } from '../../utils/helpers'

function StatBox({ label, value, colour }) {
  return (
    <div style={{background:'var(--white)',border:'1px solid var(--border)',borderRadius:'var(--radius-lg)',padding:'20px',borderTop:`3px solid ${colour}`}}>
      <div style={{fontFamily:'var(--font-mono)',fontSize:'32px',fontWeight:500,color:'var(--ink)'}}>{value}</div>
      <div style={{fontSize:'11px',color:'var(--ink-soft)',marginTop:'6px',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.05em'}}>{label}</div>
    </div>
  )
}

export default function ReportsPage() {
  const { data:stats }         = useQuery({ queryKey:['dashboard-stats'],      queryFn:()=>dashboardApi.getStats().then(r=>r.data) })
  const { data:subs=[], isLoading } = useQuery({ queryKey:['all-submissions-rc'], queryFn:()=>submissionsApi.getAll().then(r=>r.data) })

  // Compute per-app summary
  const appSummary = Object.values(
    subs.reduce((acc, s) => {
      const name = s.application?.name || 'Unknown'
      if (!acc[name]) acc[name] = { name, total:0, approved:0, rejected:0, pending:0, high:0, med:0, low:0 }
      acc[name].total++
      if (s.status==='RC_APPROVED') acc[name].approved++
      else if (['MANAGER_REJECTED','RC_REJECTED'].includes(s.status)) acc[name].rejected++
      else acc[name].pending++
      if (s.riskRating?.rating==='High')   acc[name].high++
      if (s.riskRating?.rating==='Medium') acc[name].med++
      if (s.riskRating?.rating==='Low')    acc[name].low++
      return acc
    }, {})
  ).sort((a,b)=>b.total-a.total)

  // Recent completed submissions
  const recentCompleted = subs.filter(s=>s.status==='RC_APPROVED').slice(0,10)

  function exportToExcel() {
    const wb = XLSX.utils.book_new()
    const period = new Date().toISOString().substring(0,7)

    // Sheet 1 — All Submissions
    const subsData = subs.map(s => ({
      'ID':             `SC-${String(s.id).padStart(4,'0')}`,
      'Application':    s.application?.name || '',
      'Period':         s.period,
      'Submitted By':   s.user?.name || '',
      'Status':         s.status.replace(/_/g,' '),
      'Risk Rating':    s.riskRating?.rating || 'Not Rated',
      'Date Created':   formatDate(s.createdAt),
      'Date Updated':   formatDate(s.updatedAt),
    }))
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(subsData), 'All Submissions')

    // Sheet 2 — App Summary
    const summaryData = appSummary.map(a => ({
      'Application': a.name,
      'Total':       a.total,
      'Approved':    a.approved,
      'Rejected':    a.rejected,
      'Pending':     a.pending,
      'High Risk':   a.high,
      'Medium Risk': a.med,
      'Low Risk':    a.low,
    }))
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryData), 'App Summary')

    // Sheet 3 — Stats
    const statsData = [{
      'Total Submissions': stats?.total ?? subs.length,
      'RC Pending':        stats?.rcPending ?? 0,
      'High Risk':         stats?.highRisk ?? 0,
      'Medium Risk':       stats?.medRisk ?? 0,
      'Low Risk':          stats?.lowRisk ?? 0,
      'Compliance Rate':   stats?.rate ?? '—',
      'Export Date':       new Date().toLocaleString(),
    }]
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(statsData), 'Summary Stats')

    // Sheet 4 — Rejected Submissions
    const rejectedData = subs.filter(s=>['MANAGER_REJECTED','RC_REJECTED'].includes(s.status)).map(s=>({
      'ID':           `SC-${String(s.id).padStart(4,'0')}`,
      'Application':  s.application?.name || '',
      'Period':       s.period,
      'Submitted By': s.user?.name || '',
      'Rejected At':  s.status==='MANAGER_REJECTED'?'Manager Stage':'RC Stage',
      'Date':         formatDate(s.updatedAt),
    }))
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rejectedData.length ? rejectedData : [{'Note':'No rejections'}]), 'Rejected')

    XLSX.writeFile(wb, `SnapCheck_Report_${period}.xlsx`)
  }

  if (isLoading) return <PageSpinner />

  return (
    <>
      <PageHeader title="Reports" subtitle="Compliance summary and risk analysis"
        actions={
          <button className="btn btn-accent btn-sm" onClick={exportToExcel}>
            <Download size={13}/> Export to Excel
          </button>
        }
      />

      {/* Summary stats */}
      <div className="grid-4" style={{marginBottom:'24px'}}>
        <StatBox label="Total Submissions"  value={stats?.total??subs.length}                                      colour="var(--blue)" />
        <StatBox label="Approved"           value={subs.filter(s=>s.status==='RC_APPROVED').length}                colour="var(--green)" />
        <StatBox label="Rejected"           value={subs.filter(s=>['MANAGER_REJECTED','RC_REJECTED'].includes(s.status)).length} colour="var(--accent)" />
        <StatBox label="Compliance Rate"    value={stats?.rate??'—'}                                               colour="var(--absa-red)" />
      </div>

      <div className="grid-2" style={{marginBottom:'24px'}}>
        {/* Recently Approved */}
        <div className="card">
          <div className="card-header"><div className="card-title" style={{color:'var(--green)'}}>✓ Recently Approved</div></div>
          <table className="data-table">
            <thead><tr><th>ID</th><th>Snapcheck</th><th>Period</th><th>Submitted By</th><th>Date</th><th>Risk</th></tr></thead>
            <tbody>
              {recentCompleted.length===0
                ? <tr><td colSpan={6} style={{textAlign:'center',color:'var(--ink-ghost)',padding:'24px'}}>No approved submissions yet</td></tr>
                : recentCompleted.map(s=>(
                    <tr key={s.id}>
                      <td style={{fontFamily:'var(--font-mono)',fontSize:'12px',color:'var(--ink-soft)'}}>SC-{String(s.id).padStart(4,'0')}</td>
                      <td><span className="app-chip">{s.application?.name}</span></td>
                      <td style={{fontFamily:'var(--font-mono)',fontSize:'12px'}}>{s.period}</td>
                      <td style={{fontSize:'13px'}}>{s.user?.name}</td>
                      <td style={{fontSize:'12px',color:'var(--ink-soft)'}}>{formatDate(s.updatedAt)}</td>
                      <td><RiskBadge rating={s.riskRating?.rating}/></td>
                    </tr>
                  ))
              }
            </tbody>
          </table>
        </div>

        {/* Recently Rejected */}
        <div className="card">
          <div className="card-header"><div className="card-title" style={{color:'var(--accent)'}}>✗ Recently Rejected</div></div>
          <table className="data-table">
            <thead><tr><th>ID</th><th>Snapcheck</th><th>Period</th><th>Submitted By</th><th>Date</th><th>Stage</th></tr></thead>
            <tbody>
              {subs.filter(s=>['MANAGER_REJECTED','RC_REJECTED'].includes(s.status)).length===0
                ? <tr><td colSpan={6} style={{textAlign:'center',color:'var(--ink-ghost)',padding:'24px'}}>No rejected submissions</td></tr>
                : subs.filter(s=>['MANAGER_REJECTED','RC_REJECTED'].includes(s.status)).slice(0,10).map(s=>(
                    <tr key={s.id}>
                      <td style={{fontFamily:'var(--font-mono)',fontSize:'12px',color:'var(--ink-soft)'}}>SC-{String(s.id).padStart(4,'0')}</td>
                      <td><span className="app-chip">{s.application?.name}</span></td>
                      <td style={{fontFamily:'var(--font-mono)',fontSize:'12px'}}>{s.period}</td>
                      <td style={{fontSize:'13px'}}>{s.user?.name}</td>
                      <td style={{fontSize:'12px',color:'var(--ink-soft)'}}>{formatDate(s.updatedAt)}</td>
                      <td><span style={{fontSize:'11px',fontWeight:700,padding:'2px 8px',borderRadius:'20px',background:'var(--accent-pale)',color:'var(--accent)'}}>{s.status==='MANAGER_REJECTED'?'Manager':'RC'}</span></td>
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
