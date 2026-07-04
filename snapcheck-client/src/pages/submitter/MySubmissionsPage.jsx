import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Trash2, Plus, FileText } from 'lucide-react'
import toast from 'react-hot-toast'
import { submissionsApi } from '../../api/services'
import { getErrorMessage } from '../../utils/helpers'
import { PageHeader, StatusBadge, RiskBadge, PageSpinner, EmptyState, Tabs } from '../../components/ui/index.jsx'
import { formatDate } from '../../utils/helpers'
import NewSubmissionModal from './NewSubmissionModal'
import SubmissionDetailModal from './SubmissionDetailModal'

export default function MySubmissionsPage() {
  const qc = useQueryClient()
  const [activeTab, setActiveTab] = useState('pending')
  const [showNew,      setShowNew]      = useState(false)
  const [selected,     setSelected]     = useState(null)
  const [editingSub,   setEditingSub]   = useState(null)

  async function deleteSubmission(s) {
    if (!window.confirm('Delete this submission? This cannot be undone.')) return
    try {
      await submissionsApi.delete(s.id)
      toast.success('Submission deleted')
      qc.invalidateQueries(['my-submissions'])
    } catch(e) { toast.error(getErrorMessage(e)) }
  }

  const { data: subs = [], isLoading } = useQuery({
    queryKey: ['my-submissions'],
    queryFn: () => submissionsApi.getMine().then(r => r.data),
  })

  const tabs = [
    { id:'pending',   label:'Pending',   badge: subs.filter(s=>s.status==='PENDING').length || undefined },
    { id:'submitted', label:'Submitted', badge: subs.filter(s=>s.status==='SUBMITTED').length || undefined },
    { id:'approved',  label:'Approved' },
    { id:'rejected',  label:'Rejected',  badge: subs.filter(s=>['MANAGER_REJECTED','RC_REJECTED'].includes(s.status)).length || undefined },
  ]

  const filtered = subs.filter(s => {
    if (activeTab === 'pending')   return s.status === 'PENDING'
    if (activeTab === 'submitted') return s.status === 'SUBMITTED'
    if (activeTab === 'approved')  return s.status === 'RC_APPROVED'
    if (activeTab === 'rejected')  return ['MANAGER_REJECTED','RC_REJECTED'].includes(s.status)
    return true
  })

  if (isLoading) return <PageSpinner />

  return (
    <>
      <PageHeader
        title="My Submissions"
        subtitle="Track and manage your snap check submissions"
        actions={
          <button className="btn btn-accent" onClick={() => setShowNew(true)}>
            <Plus size={14} /> New Snap Check
          </button>
        }
      />

      <Tabs tabs={tabs} active={activeTab} onChange={setActiveTab} />

      {filtered.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No submissions yet"
          description={`No ${activeTab} submissions found.`}
          action={activeTab === 'pending' && <button className="btn btn-accent" onClick={() => setShowNew(true)}><Plus size={14} /> New Snap Check</button>}
        />
      ) : (
        <div className="card">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID</th><th>Snapcheck</th><th>Period</th>
                  <th>Submitted</th><th>Status</th><th>Risk</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(s => (
                  <tr key={s.id}>
                    <td style={{ fontFamily:'var(--font-mono)', fontSize:'12px', color:'var(--ink-soft)' }}>SC-{String(s.id).padStart(4,'0')}</td>
                    <td><span className="app-chip">{s.application?.name}</span></td>
                    <td style={{ fontFamily:'var(--font-mono)', fontSize:'12px' }}>{s.period}</td>
                    <td style={{ fontSize:'12px', color:'var(--ink-soft)' }}>{formatDate(s.createdAt)}</td>
                    <td><StatusBadge status={s.status} /></td>
                    <td><RiskBadge rating={s.riskRating?.rating} /></td>
                    <td>
                      <div style={{ display:'flex', gap:'6px' }}>
                        {s.status === 'PENDING' && (
                          <>
                            <button className="btn btn-accent btn-sm" onClick={() => setEditingSub(s)}>Complete</button>
                            <button className="btn btn-ghost btn-sm" onClick={() => deleteSubmission(s)} title="Delete Draft">
                              <Trash2 size={13} style={{color:'var(--accent)'}}/>
                            </button>
                          </>
                        )}
                        {['MANAGER_REJECTED','RC_REJECTED'].includes(s.status) && (
                          <>
                            <button className="btn btn-danger btn-sm" onClick={() => setEditingSub(s)}>Revise</button>
                            <button className="btn btn-ghost btn-sm" onClick={() => deleteSubmission(s)} title="Delete">
                              <Trash2 size={13} style={{color:'var(--accent)'}}/>
                            </button>
                          </>
                        )}
                        <button className="btn btn-ghost btn-sm" onClick={() => setSelected(s)}>View</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <NewSubmissionModal
        open={showNew}
        onClose={() => setShowNew(false)}
        onSuccess={() => { setShowNew(false); qc.invalidateQueries(['my-submissions']) }}
      />
      {editingSub && (
        <NewSubmissionModal
          open={!!editingSub}
          existingSubmission={editingSub}
          onClose={() => setEditingSub(null)}
          onSuccess={() => { setEditingSub(null); qc.invalidateQueries(['my-submissions']) }}
        />
      )}
      {selected && (
        <SubmissionDetailModal
          submission={selected}
          onClose={() => setSelected(null)}
          onSuccess={() => { setSelected(null); qc.invalidateQueries(['my-submissions']) }}
        />
      )}
    </>
  )
}
