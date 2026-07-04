import { useState } from 'react'
import api from '../../api/axios'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle, XCircle, Eye, Download, Paperclip } from 'lucide-react'
import toast from 'react-hot-toast'
import { approvalsApi, submissionsApi, evidenceApi } from '../../api/services'
import { PageHeader, StatusBadge, PageSpinner, EmptyState, Modal, Tabs, Spinner } from '../../components/ui/index.jsx'
import { formatDate, formatFileSize, getErrorMessage } from '../../utils/helpers'

const RESP_LABELS  = { COMPLIANT:'Effective', NON_COMPLIANT:'Ineffective', NA:'N/A' }
const RESP_COLOURS = {
  COMPLIANT:     { bg:'#e8f7ef', color:'#2d6e4e', border:'#b7dfc9' },
  NON_COMPLIANT: { bg:'#fdecea', color:'#B0001A', border:'#f5bcb5' },
  NA:            { bg:'#f3f4f6', color:'#6b7280', border:'#e5e7eb' },
}

export default function ApprovalsPage() {
  const qc = useQueryClient()
  const [activeTab, setActiveTab] = useState('pending')
  const [reviewing, setReviewing] = useState(null)
  const [comment,   setComment]   = useState('')
  const [acting,    setActing]    = useState(false)

  const { data: pending = [], isLoading } = useQuery({
    queryKey:['approvals-pending'],
    queryFn:() => approvalsApi.getPending().then(r=>r.data),
  })
  const { data: allSubs = [] } = useQuery({
    queryKey:['all-submissions'],
    queryFn:() => submissionsApi.getAll().then(r=>r.data),
  })
  const { data: reviewDetail } = useQuery({
    queryKey:['submission-detail', reviewing?.id],
    queryFn:() => submissionsApi.getById(reviewing.id).then(r=>r.data),
    enabled:!!reviewing,
  })
  const { data: reviewFiles = [] } = useQuery({
    queryKey:['evidence', reviewing?.id],
    queryFn:() => evidenceApi.getBySubmission(reviewing.id).then(r=>r.data),
    enabled:!!reviewing,
  })

  async function handleDecision(decision) {
    if (!comment.trim()) { toast.error('Please add a comment before actioning.'); return }
    setActing(true)
    try {
      if (decision === 'approve') {
        await approvalsApi.managerApprove(reviewing.id, comment)
        toast.success('Approved — Risk & Compliance team notified.')
      } else {
        await approvalsApi.managerReject(reviewing.id, comment)
        toast.error('Rejected — Submitter notified.')
      }
      qc.invalidateQueries(['approvals-pending'])
      qc.invalidateQueries(['all-submissions'])
      setReviewing(null); setComment('')
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setActing(false)
    }
  }

  async function downloadFile(fileId, filename) {
    try {
      const response = await api.get(`/evidence/${fileId}/download`, { responseType:'blob' })
      const url  = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href  = url
      link.setAttribute('download', filename)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (e) { toast.error('Failed to download file: ' + (e.message||'unknown error')) }
  }

  const completed = allSubs.filter(s => ['MANAGER_APPROVED','MANAGER_REJECTED','RC_APPROVED','RC_REJECTED'].includes(s.status))
  const tabs = [
    { id:'pending',   label:'Awaiting My Review', badge: pending.length||undefined },
    { id:'completed', label:'Completed' },
  ]

  if (isLoading) return <PageSpinner />

  return (
    <>
      <PageHeader title="Approvals" subtitle="Review and action snap check submissions from your team" />
      <Tabs tabs={tabs} active={activeTab} onChange={setActiveTab} />

      {activeTab === 'pending' && (
        pending.length === 0
          ? <EmptyState icon={CheckCircle} title="All caught up!" description="No submissions are currently awaiting your review." />
          : <div>
              {pending.map(s => (
                <div key={s.id} className="card" style={{ marginBottom:'12px' }}>
                  <div className="card-body" style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:'16px' }}>
                    <div style={{ flex:1 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'8px' }}>
                        <span className="app-chip">{s.application?.name}</span>
                        <span style={{ fontFamily:'var(--font-mono)', fontSize:'12px', color:'var(--ink-soft)' }}>{s.period}</span>
                        <StatusBadge status={s.status} />
                      </div>
                      <p style={{ fontSize:'12px', color:'var(--ink-soft)' }}>
                        Submitted by <strong style={{ color:'var(--ink)' }}>{s.user?.name}</strong> · {formatDate(s.createdAt)}
                      </p>
                      <p style={{ fontSize:'12px', color:'var(--ink-soft)', marginTop:'6px' }}>
                        📄 {s._count?.answers||0} questions &nbsp;·&nbsp; 📎 {s._count?.evidenceFiles||0} evidence files
                      </p>
                    </div>
                    <div style={{ display:'flex', gap:'8px', flexShrink:0 }}>
                      <button className="btn btn-outline btn-sm" onClick={()=>{ setReviewing(s); setComment('') }}>
                        <Eye size={13}/> Review
                      </button>
                      <button className="btn btn-danger btn-sm" onClick={()=>{ setReviewing(s); setComment('') }}>
                        <XCircle size={13}/> Reject
                      </button>
                      <button className="btn btn-success btn-sm" onClick={()=>{ setReviewing(s); setComment('') }}>
                        <CheckCircle size={13}/> Approve
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
      )}

      {activeTab === 'completed' && (
        <div className="card">
          <table className="data-table">
            <thead><tr><th>ID</th><th>Snapcheck</th><th>Period</th><th>Submitter</th><th>Status</th><th>Date</th><th></th></tr></thead>
            <tbody>
              {completed.map(s => (
                <tr key={s.id}>
                  <td style={{ fontFamily:'var(--font-mono)', fontSize:'12px', color:'var(--ink-soft)' }}>SC-{String(s.id).padStart(4,'0')}</td>
                  <td><span className="app-chip">{s.application?.name}</span></td>
                  <td style={{ fontFamily:'var(--font-mono)', fontSize:'12px' }}>{s.period}</td>
                  <td style={{ fontSize:'13px' }}>{s.user?.name}</td>
                  <td><StatusBadge status={s.status} /></td>
                  <td style={{ fontSize:'12px', color:'var(--ink-soft)' }}>{formatDate(s.updatedAt)}</td>
                  <td><button className="btn btn-ghost btn-sm" onClick={()=>setReviewing(s)}>View</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Review modal */}
      {reviewing && (
        <Modal open onClose={()=>{ setReviewing(null); setComment('') }} size="lg"
          title={`Review: ${reviewing.application?.name} — ${reviewing.period}`}
          subtitle={`Submitted by ${reviewing.user?.name} · ${formatDate(reviewing.createdAt)}`}
          footer={
            reviewing.status === 'SUBMITTED'
              ? <>
                  <button className="btn btn-ghost" onClick={()=>{ setReviewing(null); setComment('') }}>Cancel</button>
                  <button className="btn btn-danger" disabled={acting} onClick={()=>handleDecision('reject')}>
                    {acting ? <Spinner size="sm" white /> : <XCircle size={14}/>} Reject
                  </button>
                  <button className="btn btn-success" disabled={acting} onClick={()=>handleDecision('approve')}>
                    {acting ? <Spinner size="sm" white /> : <CheckCircle size={14}/>} Approve
                  </button>
                </>
              : <button className="btn btn-ghost" onClick={()=>{ setReviewing(null); setComment('') }}>Close</button>
          }
        >
          {/* Questions with responses, comments and evidence together */}
          {reviewDetail?.answers?.length > 0 && (
            <div style={{ marginBottom:'20px' }}>
              <p style={{ fontSize:'11px', fontWeight:700, color:'var(--ink-ghost)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:'12px' }}>
                Questions & Responses
              </p>
              {reviewDetail.answers.map((ans, idx) => {
                const colours  = RESP_COLOURS[ans.response] || RESP_COLOURS.NA
                const qFiles   = reviewFiles.filter(f => String(f.answerId) === String(ans.id))
                const noFileQ  = reviewFiles.filter(f => !f.answerId)
                return (
                  <div key={ans.id} style={{
                    marginBottom:'12px',
                    border:`1px solid ${colours.border}`,
                    borderRadius:'var(--radius)',
                    overflow:'hidden',
                  }}>
                    {/* Question + response badge */}
                    <div style={{
                      display:'flex', alignItems:'flex-start', gap:'12px',
                      padding:'12px 16px',
                      background: colours.bg,
                    }}>
                      <span style={{
                        width:'24px', height:'24px', borderRadius:'50%',
                        background: colours.color, color:'white',
                        fontSize:'11px', fontWeight:700,
                        display:'flex', alignItems:'center', justifyContent:'center',
                        flexShrink:0, marginTop:'1px',
                      }}>{idx+1}</span>
                      <p style={{ flex:1, fontSize:'13px', fontWeight:500, color:'#1a1a2e', margin:0, lineHeight:1.5 }}>
                        {ans.question?.text}
                      </p>
                      <span style={{
                        fontSize:'11px', fontWeight:700, padding:'3px 12px',
                        borderRadius:'20px', flexShrink:0, whiteSpace:'nowrap',
                        background:'white', color: colours.color,
                        border:`1px solid ${colours.border}`,
                      }}>
                        {RESP_LABELS[ans.response] || ans.response}
                      </span>
                    </div>

                    {/* Comment */}
                    {ans.comment && (
                      <div style={{ padding:'10px 16px', background:'white', borderTop:`1px solid ${colours.border}` }}>
                        <span style={{ fontSize:'10px', fontWeight:700, color:'var(--ink-ghost)', textTransform:'uppercase', letterSpacing:'0.06em' }}>Comment: </span>
                        <span style={{ fontSize:'13px', color:'var(--ink-soft)' }}>{ans.comment}</span>
                      </div>
                    )}
                    {!ans.comment && ans.response === 'NA' && (
                      <div style={{ padding:'8px 16px', background:'white', borderTop:`1px solid ${colours.border}`, fontSize:'12px', color:'var(--amber)', fontStyle:'italic' }}>
                        ⚠️ No reason provided for N/A
                      </div>
                    )}

                    {/* Evidence files for this question */}
                    {qFiles.length > 0 && (
                      <div style={{ background:'#f9fafb', borderTop:`1px solid ${colours.border}`, padding:'8px 16px' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:'6px', marginBottom:'6px' }}>
                          <Paperclip size={11} style={{ color:'var(--ink-ghost)' }}/>
                          <span style={{ fontSize:'10px', fontWeight:700, color:'var(--ink-ghost)', textTransform:'uppercase', letterSpacing:'0.06em' }}>
                            Evidence ({qFiles.length})
                          </span>
                        </div>
                        {qFiles.map(f => (
                          <div key={f.id} className="evidence-item" style={{ marginLeft:'4px', background:'white' }}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{color:'var(--ink-soft)',flexShrink:0}}>
                              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
                            </svg>
                            <span className="evidence-name">{f.filename}</span>
                            <span className="evidence-size">{formatFileSize(f.size)}</span>
                            <button className="btn btn-ghost btn-sm" style={{ marginLeft:'auto', padding:'3px 8px' }}
                              onClick={()=>downloadFile(f.id, f.filename)} title="Download">
                              <Download size={12}/>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}

              {/* Files not linked to any specific question */}
              {reviewFiles.filter(f => !f.answerId).length > 0 && (
                <div style={{ marginTop:'16px' }}>
                  <p style={{ fontSize:'11px', fontWeight:700, color:'var(--ink-ghost)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:'8px' }}>
                    General Evidence Files
                  </p>
                  {reviewFiles.filter(f => !f.answerId).map(f => (
                    <div key={f.id} className="evidence-item">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{color:'var(--ink-soft)'}}>
                        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
                      </svg>
                      <span className="evidence-name">{f.filename}</span>
                      <span className="evidence-size">{formatFileSize(f.size)}</span>
                      <button className="btn btn-ghost btn-sm" style={{ marginLeft:'auto', padding:'4px 8px' }}
                        onClick={()=>downloadFile(f.id, f.filename)} title="Download">
                        <Download size={13}/>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Manager comment box */}
          {reviewing.status === 'SUBMITTED' && (
            <div>
              <label className="form-label">
                Your Comments <span style={{ color:'var(--accent)' }}>*</span>
                <span style={{ color:'var(--ink-ghost)', fontWeight:400, textTransform:'none', letterSpacing:0, marginLeft:'6px' }}>Required before actioning</span>
              </label>
              <textarea className="form-control" rows={3}
                placeholder="Add your review comments or reasons for rejection…"
                value={comment} onChange={e=>setComment(e.target.value)}
              />
            </div>
          )}
        </Modal>
      )}
    </>
  )
}
