import { useState } from 'react'
import api from '../../api/axios'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle, XCircle, Download } from 'lucide-react'
import toast from 'react-hot-toast'
import { approvalsApi, submissionsApi, evidenceApi } from '../../api/services'
import { PageHeader, StatusBadge, PageSpinner, EmptyState, Modal, Spinner } from '../../components/ui/index.jsx'
import { formatDate, formatFileSize, getErrorMessage } from '../../utils/helpers'

const RESP_LABELS  = { COMPLIANT:'Effective', NON_COMPLIANT:'Ineffective', NA:'N/A' }
const RESP_COLOURS = {
  COMPLIANT:         { bg:'var(--green-pale)',  color:'var(--green)'  },
  NON_COMPLIANT:     { bg:'var(--accent-pale)', color:'var(--accent)' },
  NA:                { bg:'var(--canvas-2)',    color:'var(--ink-ghost)' },
}
const RESP_BG      = { COMPLIANT:'var(--green-pale)', NON_COMPLIANT:'var(--accent-pale)', PARTIAL_COMPLIANT:'var(--amber-pale)', NA:'var(--canvas-2)' }
const RESP_COLOUR  = { COMPLIANT:'var(--green)',      NON_COMPLIANT:'var(--accent)',           NA:'var(--ink-ghost)' }

export default function RCApprovalsPage() {
  const qc = useQueryClient()
  const [reviewing, setReviewing] = useState(null)
  const [comment,   setComment]   = useState('')
  const [rating,    setRating]    = useState('Low')
  const [acting,    setActing]    = useState(false)

  const { data:pending=[], isLoading } = useQuery({
    queryKey:['rc-pending'],
    queryFn:()=>approvalsApi.getPending().then(r=>r.data),
  })
  const { data:detail } = useQuery({
    queryKey:['submission-detail', reviewing?.id],
    queryFn:()=>submissionsApi.getById(reviewing.id).then(r=>r.data),
    enabled:!!reviewing,
  })
  const { data:files=[] } = useQuery({
    queryKey:['evidence', reviewing?.id],
    queryFn:()=>evidenceApi.getBySubmission(reviewing.id).then(r=>r.data),
    enabled:!!reviewing,
  })

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

    async function handleDecision(decision) {
    if (!comment.trim()) { toast.error('A comment is required'); return }
    setActing(true)
    try {
      if (decision==='approve') {
        await approvalsApi.rcApprove(reviewing.id, { comment, riskRating: rating })
        toast.success(`Approved — Risk rating: ${rating}`)
      } else {
        await approvalsApi.rcReject(reviewing.id, comment)
        toast.error('Rejected — Submitter notified')
      }
      qc.invalidateQueries(['rc-pending'])
      setReviewing(null); setComment(''); setRating('Low')
    } catch(e) { toast.error(getErrorMessage(e)) }
    finally { setActing(false) }
  }

  if (isLoading) return <PageSpinner />

  return (
    <>
      <PageHeader title="RC Approvals" subtitle="Final review and risk rating for manager-approved submissions" />

      {pending.length===0
        ? <EmptyState icon={CheckCircle} title="All clear!" description="No submissions awaiting RC review." />
        : <div>
            {pending.map(s=>(
              <div key={s.id} className="card" style={{marginBottom:'12px'}}>
                <div className="card-body" style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:'16px'}}>
                  <div style={{flex:1}}>
                    <div style={{display:'flex',alignItems:'center',gap:'10px',marginBottom:'8px'}}>
                      <span className="app-chip">{s.application?.name}</span>
                      <span style={{fontFamily:'var(--font-mono)',fontSize:'12px',color:'var(--ink-soft)'}}>{s.period}</span>
                      <StatusBadge status={s.status}/>
                    </div>
                    <p style={{fontSize:'12px',color:'var(--ink-soft)'}}>
                      Submitted by <strong style={{color:'var(--ink)'}}>{s.user?.name}</strong> · {formatDate(s.createdAt)}
                    </p>
                    <p style={{fontSize:'12px',color:'var(--ink-soft)',marginTop:'4px'}}>
                      📄 {s._count?.answers||0} questions &nbsp;·&nbsp; 📎 {s._count?.evidenceFiles||0} files
                    </p>
                  </div>
                  <div style={{display:'flex',gap:'8px',flexShrink:0}}>
                    <button className="btn btn-outline btn-sm" onClick={()=>{setReviewing(s);setComment('');setRating('Low')}}>Review</button>
                    <button className="btn btn-danger btn-sm" onClick={()=>{setReviewing(s);setComment('');setRating('Low')}}><XCircle size={13}/> Reject</button>
                    <button className="btn btn-success btn-sm" onClick={()=>{setReviewing(s);setComment('');setRating('Low')}}><CheckCircle size={13}/> Approve</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
      }

      {reviewing && (
        <Modal open onClose={()=>{setReviewing(null);setComment('')}} size="lg"
          title={`RC Review: ${reviewing.application?.name} — ${reviewing.period}`}
          subtitle={`Submitted by ${reviewing.user?.name} · Manager approved`}
          footer={<>
            <button className="btn btn-ghost" onClick={()=>{setReviewing(null);setComment('')}}>Cancel</button>
            <button className="btn btn-danger" disabled={acting} onClick={()=>handleDecision('reject')}>
              {acting?<Spinner size="sm" white/>:<XCircle size={14}/>} Reject
            </button>
            <button className="btn btn-success" disabled={acting} onClick={()=>handleDecision('approve')}>
              {acting?<Spinner size="sm" white/>:<CheckCircle size={14}/>} Approve
            </button>
          </>}
        >
          {/* Questions with responses and evidence grouped together */}
          {detail?.answers?.length > 0 && (
            <div style={{marginBottom:'20px'}}>
              <p style={{fontSize:'11px',fontWeight:700,color:'var(--ink-ghost)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:'12px'}}>Questions & Responses</p>
              {detail.answers.map((ans, idx) => {
                const colours = { COMPLIANT:{bg:'#e8f7ef',color:'#2d6e4e',border:'#b7dfc9'}, NON_COMPLIANT:{bg:'#fdecea',color:'#B0001A',border:'#f5bcb5'}, NA:{bg:'#f3f4f6',color:'#6b7280',border:'#e5e7eb'} }[ans.response] || {bg:'#f3f4f6',color:'#6b7280',border:'#e5e7eb'}
                const qFiles  = files.filter(f => String(f.answerId) === String(ans.id))
                return (
                  <div key={ans.id} style={{marginBottom:'12px',border:`1px solid ${colours.border}`,borderRadius:'var(--radius)',overflow:'hidden'}}>
                    <div style={{display:'flex',alignItems:'flex-start',gap:'12px',padding:'12px 16px',background:colours.bg}}>
                      <span style={{width:'24px',height:'24px',borderRadius:'50%',background:colours.color,color:'white',fontSize:'11px',fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,marginTop:'1px'}}>{idx+1}</span>
                      <p style={{flex:1,fontSize:'13px',fontWeight:500,color:'#1a1a2e',margin:0,lineHeight:1.5}}>{ans.question?.text}</p>
                      <span style={{fontSize:'11px',fontWeight:700,padding:'3px 12px',borderRadius:'20px',flexShrink:0,whiteSpace:'nowrap',background:'white',color:colours.color,border:`1px solid ${colours.border}`}}>
                        {RESP_LABELS[ans.response]||ans.response}
                      </span>
                    </div>
                    {ans.comment && (
                      <div style={{padding:'10px 16px',background:'white',borderTop:`1px solid ${colours.border}`}}>
                        <span style={{fontSize:'10px',fontWeight:700,color:'var(--ink-ghost)',textTransform:'uppercase',letterSpacing:'0.06em'}}>Comment: </span>
                        <span style={{fontSize:'13px',color:'var(--ink-soft)'}}>{ans.comment}</span>
                      </div>
                    )}
                    {qFiles.length > 0 && (
                      <div style={{background:'#f9fafb',borderTop:`1px solid ${colours.border}`,padding:'8px 16px'}}>
                        <span style={{fontSize:'10px',fontWeight:700,color:'var(--ink-ghost)',textTransform:'uppercase',letterSpacing:'0.06em',display:'block',marginBottom:'6px'}}>Evidence ({qFiles.length})</span>
                        {qFiles.map(f=>(
                          <div key={f.id} className="evidence-item" style={{marginLeft:'4px',background:'white'}}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{color:'var(--ink-soft)',flexShrink:0}}>
                              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
                            </svg>
                            <span className="evidence-name">{f.filename}</span>
                            <span className="evidence-size">{formatFileSize(f.size)}</span>
                            <button className="btn btn-ghost btn-sm" style={{marginLeft:'auto',padding:'3px 8px'}} onClick={()=>downloadFile(f.id,f.filename)} title="Download">
                              <Download size={12}/>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
              {files.filter(f=>!f.answerId).map(f=>(
                <div key={f.id} className="evidence-item">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{color:'var(--ink-soft)'}}>
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
                  </svg>
                  <span className="evidence-name">{f.filename}</span>
                  <span className="evidence-size">{formatFileSize(f.size)}</span>
                  <button className="btn btn-ghost btn-sm" style={{marginLeft:'auto',padding:'4px 8px'}} onClick={()=>downloadFile(f.id,f.filename)} title="Download">
                    <Download size={13}/>
                  </button>
                </div>
              ))}
            </div>
          )}

                    {/* Risk rating + comment */}
          <div style={{display:'grid',gridTemplateColumns:'1fr 2fr',gap:'16px',marginBottom:'4px'}}>
            <div>
              <label className="form-label">Risk Rating <span style={{color:'var(--accent)'}}>*</span></label>
              <select className="form-control" value={rating} onChange={e=>setRating(e.target.value)}>
                {['Low','Medium','High'].map(r=><option key={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">RC Comments <span style={{color:'var(--accent)'}}>*</span></label>
              <textarea className="form-control" rows={3} placeholder="Required before actioning…" value={comment} onChange={e=>setComment(e.target.value)}/>
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}
