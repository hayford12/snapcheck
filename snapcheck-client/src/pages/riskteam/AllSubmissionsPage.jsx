import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { submissionsApi } from '../../api/services'
import { PageHeader, StatusBadge, RiskBadge, PageSpinner, EmptyState, Tabs } from '../../components/ui/index.jsx'
import { formatDate } from '../../utils/helpers'
import SubmissionDetailModal from '../submitter/SubmissionDetailModal'
import { FileText } from 'lucide-react'

const TABS = [
  { id:'all',              label:'All' },
  { id:'SUBMITTED',        label:'Awaiting Manager' },
  { id:'MANAGER_APPROVED', label:'Awaiting RC' },
  { id:'RC_APPROVED',      label:'Approved' },
  { id:'MANAGER_REJECTED', label:'Rejected' },
]

export default function AllSubmissionsPage() {
  const [tab,      setTab]      = useState('all')
  const [selected, setSelected] = useState(null)

  const { data:subs=[], isLoading } = useQuery({
    queryKey:['all-submissions-rc'],
    queryFn:()=>submissionsApi.getAll().then(r=>r.data),
  })

  const filtered = tab==='all' ? subs : subs.filter(s=>s.status===tab)

  const tabsWithBadge = TABS.map(t=>({
    ...t,
    badge: t.id==='all' ? subs.length : subs.filter(s=>s.status===t.id).length || undefined
  }))

  if (isLoading) return <PageSpinner />

  return (
    <>
      <PageHeader title="All Submissions" subtitle="View and manage all snap check submissions across the organisation" />
      <Tabs tabs={tabsWithBadge} active={tab} onChange={setTab} />

      {filtered.length===0
        ? <EmptyState icon={FileText} title="No submissions" description="No submissions match this filter." />
        : <div className="card">
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr><th>ID</th><th>Snapcheck</th><th>Period</th><th>Submitted By</th><th>Date</th><th>Status</th><th>Risk</th><th></th></tr>
                </thead>
                <tbody>
                  {filtered.map(s=>(
                    <tr key={s.id}>
                      <td style={{fontFamily:'var(--font-mono)',fontSize:'12px',color:'var(--ink-soft)'}}>SC-{String(s.id).padStart(4,'0')}</td>
                      <td><span className="app-chip">{s.application?.name}</span></td>
                      <td style={{fontFamily:'var(--font-mono)',fontSize:'12px'}}>{s.period}</td>
                      <td style={{fontSize:'13px'}}>{s.user?.name}</td>
                      <td style={{fontSize:'12px',color:'var(--ink-soft)'}}>{formatDate(s.createdAt)}</td>
                      <td><StatusBadge status={s.status}/></td>
                      <td><RiskBadge rating={s.riskRating?.rating}/></td>
                      <td><button className="btn btn-ghost btn-sm" onClick={()=>setSelected(s)}>View</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
      }

      {selected && <SubmissionDetailModal submission={selected} onClose={()=>setSelected(null)} />}
    </>
  )
}
