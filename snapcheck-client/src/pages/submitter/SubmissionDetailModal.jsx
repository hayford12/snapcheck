import { useQuery } from '@tanstack/react-query'
import api from '../../api/axios'
import { Download } from 'lucide-react'
import { submissionsApi, evidenceApi } from '../../api/services'
import { Modal, StatusBadge, RiskBadge, PageSpinner } from '../../components/ui/index.jsx'
import { formatDate, formatDateTime, formatFileSize } from '../../utils/helpers'

const RESP_LABELS = { COMPLIANT:'Effective', NON_COMPLIANT:'Ineffective', NA:'N/A' }
const RESP_COLORS = { COMPLIANT:'background:var(--green-pale);color:var(--green)', NON_COMPLIANT:'background:var(--accent-pale);color:var(--accent)', PARTIAL_COMPLIANT:'background:var(--amber-pale);color:var(--amber)', NA:'background:var(--canvas-2);color:var(--ink-ghost)' }

export default function SubmissionDetailModal({ submission, onClose }) {
  const { data: detail, isLoading } = useQuery({
    queryKey:['submission', submission.id],
    queryFn:() => submissionsApi.getById(submission.id).then(r=>r.data),
  })
  const { data: files = [] } = useQuery({
    queryKey:['evidence', submission.id],
    queryFn:() => evidenceApi.getBySubmission(submission.id).then(r=>r.data),
  })

  async function downloadFile(fileId, filename) {
    try {
      const response = await api.get(`/evidence/${fileId}/download`, { responseType: 'blob' })
      const url  = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href  = url
      link.setAttribute('download', filename)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch { }
  }

  return (
    <Modal open onClose={onClose} size="lg"
      title={`${submission.application?.name} — ${submission.period}`}
      subtitle={`SC-${String(submission.id).padStart(4,'0')} · ${formatDate(submission.createdAt)}`}
      footer={<button className="btn btn-ghost" onClick={onClose}>Close</button>}
    >
      {isLoading ? <PageSpinner /> : (
        <div>
          {/* Status */}
          <div style={{ display:'flex', gap:'10px', alignItems:'center', padding:'12px 16px', background:'var(--canvas)', borderRadius:'var(--radius)', marginBottom:'20px' }}>
            <StatusBadge status={detail?.status} />
            <RiskBadge rating={detail?.riskRating?.rating} />
          </div>

          {/* Answers */}
          {detail?.answers?.length > 0 && (
            <div style={{ marginBottom:'20px' }}>
              <p style={{ fontSize:'11px', fontWeight:700, color:'var(--ink-ghost)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:'10px' }}>Responses</p>
              {detail.answers.map((ans,idx) => (
                <div key={ans.id} className="question-card" style={{ marginBottom:'8px' }}>
                  <div className="question-card-header">
                    <span className="question-num">{idx+1}</span>
                    <p style={{ flex:1, fontSize:'13px', fontWeight:500 }}>{ans.question?.text}</p>
                    <span style={{ fontSize:'10px', fontWeight:600, padding:'2px 8px', borderRadius:'20px', flexShrink:0, ...Object.fromEntries((RESP_COLORS[ans.response]||'').split(';').filter(Boolean).map(s=>s.split(':').map(x=>x.trim()))) }}>
                      {RESP_LABELS[ans.response]||ans.response}
                    </span>
                  </div>
                  {ans.comment && <div style={{ padding:'10px 14px', borderTop:'1px solid var(--border)', fontSize:'13px', color:'var(--ink-soft)' }}>{ans.comment}</div>}
                </div>
              ))}
            </div>
          )}

          {/* Files grouped by question */}
          {files.length > 0 && (
            <div style={{ marginBottom:'20px' }}>
              <p style={{ fontSize:'11px', fontWeight:700, color:'var(--ink-ghost)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:'10px' }}>Evidence Files ({files.length})</p>
              {detail?.answers?.map(ans => {
                const qFiles = files.filter(f => String(f.answerId) === String(ans.id))
                if (!qFiles.length) return null
                async function downloadFile(fileId, filename) {
    try {
      const response = await api.get(`/evidence/${fileId}/download`, { responseType: 'blob' })
      const url  = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href  = url
      link.setAttribute('download', filename)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch { }
  }

  return (
                  <div key={ans.id} style={{ marginBottom:'12px' }}>
                    <p style={{ fontSize:'12px', fontWeight:600, color:'var(--ink-soft)', marginBottom:'6px' }}>
                      Q: {ans.question?.text}
                    </p>
                    {qFiles.map(f => (
                      <div key={f.id} className="evidence-item" style={{ marginLeft:'12px' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{color:'var(--ink-soft)'}}>
                          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
                        </svg>
                        <span className="evidence-name">{f.filename}</span>
                        <span className="evidence-size">{formatFileSize(f.size)}</span>
                        <button style={{ background:'none', border:'none', cursor:'pointer', color:'var(--ink-ghost)' }} title="Download"
                          onClick={()=>downloadFile(f.id, f.filename)}>
                          <Download size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                )
              })}
              {/* Files not linked to a specific question */}
              {files.filter(f => !f.answerId).map(f => (
                <div key={f.id} className="evidence-item">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{color:'var(--ink-soft)'}}>
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
                  </svg>
                  <span className="evidence-name">{f.filename}</span>
                  <span className="evidence-size">{formatFileSize(f.size)}</span>
                </div>
              ))}
            </div>
          )}

          {/* Approval trail */}
          {detail?.approvals?.length > 0 && (
            <div>
              <p style={{ fontSize:'11px', fontWeight:700, color:'var(--ink-ghost)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:'10px' }}>Approval Trail</p>
              {detail.approvals.map(a => (
                <div key={a.id} className="activity-item">
                  <div className="activity-avatar">{a.reviewer?.name?.split(' ').map(w=>w[0]).join('').substring(0,2)}</div>
                  <div>
                    <div className="activity-text">
                      <strong>{a.reviewer?.name}</strong>{' '}
                      <span style={{ color:a.decision.includes('APPROVED')?'var(--green)':'var(--accent)' }}>
                        {a.decision.replace(/_/g,' ').toLowerCase()}
                      </span>
                    </div>
                    {a.comment && <p style={{ fontSize:'12px', color:'var(--ink-soft)', marginTop:'2px' }}>{a.comment}</p>}
                    <div className="activity-time">{formatDateTime(a.createdAt)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}
