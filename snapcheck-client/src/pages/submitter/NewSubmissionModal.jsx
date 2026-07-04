import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Upload, X, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { appsApi, questionsApi, submissionsApi, evidenceApi } from '../../api/services'
import { Modal, Spinner } from '../../components/ui/index.jsx'
import { getErrorMessage, formatFileSize } from '../../utils/helpers'

const RESPONSE_OPTIONS = [
  { value:'COMPLIANT',         label:'Effective' },
  { value:'NON_COMPLIANT',     label:'Ineffective' },
  { value:'NA',                label:'N/A' },
]

export default function NewSubmissionModal({ open, onClose, onSuccess, existingSubmission }) {
  const qc = useQueryClient()
  const isEditing = !!existingSubmission

  const [step,        setStep]        = useState(1)
  const [selectedApp, setSelectedApp] = useState('')
  const [period,      setPeriod]      = useState(new Date().toISOString().substring(0,7))
  const [answers,     setAnswers]     = useState({})
  const [files,       setFiles]       = useState({})       // new files to upload
  const [existingFiles, setExistingFiles] = useState([])  // already uploaded files
  const [submitting,  setSubmitting]  = useState(false)
  const [errors,      setErrors]      = useState({})

  const { data: apps = [] } = useQuery({
    queryKey:['applications'], queryFn:() => appsApi.getAll().then(r=>r.data), enabled:open,
  })
  const { data: questions = [], isLoading: loadingQ } = useQuery({
    queryKey:['questions-app', selectedApp],
    queryFn:() => questionsApi.getByApp(selectedApp).then(r=>r.data),
    enabled:!!selectedApp && step===2,
  })

  // Load existing submission data when editing
  const { data: existingDetail } = useQuery({
    queryKey:['submission', existingSubmission?.id],
    queryFn:() => submissionsApi.getById(existingSubmission.id).then(r=>r.data),
    enabled:!!existingSubmission,
  })
  const { data: existingEvidenceFiles = [] } = useQuery({
    queryKey:['evidence', existingSubmission?.id],
    queryFn:() => evidenceApi.getBySubmission(existingSubmission.id).then(r=>r.data),
    enabled:!!existingSubmission,
  })

  // Populate form when editing
  useEffect(() => {
    if (existingSubmission) {
      const appId = existingSubmission.applicationId || existingSubmission.application?.id
      setSelectedApp(String(appId || ''))
      setPeriod(existingSubmission.period || new Date().toISOString().substring(0,7))
    }
  }, [existingSubmission])

  useEffect(() => {
    if (existingSubmission && existingDetail) {
      const loadedAnswers = {}
      existingDetail.answers?.forEach(a => {
        loadedAnswers[a.questionId] = { response: a.response, comment: a.comment || '' }
      })
      setAnswers(loadedAnswers)
      setStep(2)
    }
  }, [existingDetail])

  useEffect(() => {
    if (existingEvidenceFiles.length) setExistingFiles(existingEvidenceFiles)
  }, [existingEvidenceFiles])

  const setAnswer = (qId, field, value) => {
    setAnswers(prev => ({ ...prev, [qId]: { ...prev[qId], [field]: value } }))
    if (field === 'response') setErrors(prev => ({ ...prev, [qId]: undefined }))
  }
  const addFile    = (qId, file) => setFiles(prev => ({ ...prev, [qId]: [...(prev[qId]||[]), file] }))
  const removeFile = (qId, idx) => setFiles(prev => ({ ...prev, [qId]: prev[qId].filter((_,i)=>i!==idx) }))

  // Validate mandatory questions
  function validate() {
    const activeQ = questions.filter(q => q.active)
    const newErrors = {}
    let valid = true
    activeQ.forEach(q => {
      if (q.required && !answers[q.id]?.response) {
        newErrors[q.id] = 'This question is mandatory'
        valid = false
      }
      // N/A requires a comment explaining why
      if (answers[q.id]?.response === 'NA' && !answers[q.id]?.comment?.trim()) {
        newErrors[`na_${q.id}`] = 'Please provide a reason for N/A'
        valid = false
      }
      if (q.evidenceRequired && !files[q.id]?.length && !existingFiles.some(f => String(f.answerId) === String(q.id))) {
        newErrors[`evidence_${q.id}`] = 'Evidence is required for this question'
        valid = false
      }
    })
    setErrors(newErrors)
    if (!valid) toast.error('Please complete all mandatory fields before submitting.')
    return valid
  }

  async function handleSubmit(isDraft=false) {
    if (!isDraft && !validate()) return

    setSubmitting(true)
    try {
      let subId = existingSubmission?.id

      if (!subId) {
        const { data: sub } = await submissionsApi.create({ applicationId:Number(selectedApp), period })
        subId = sub.id
      }

      const answersPayload = Object.entries(answers).map(([questionId, ans]) => ({
        questionId: Number(questionId), response: ans.response||'NA', comment: ans.comment||'',
      }))
      await submissionsApi.saveAnswers(subId, answersPayload)

      // Fetch saved answers to get the real answer IDs (not question IDs)
      const savedAnswers = await submissionsApi.getAnswers(subId)
      const answerList = savedAnswers.data?.data || savedAnswers.data || []
      const questionToAnswerId = {}
      answerList.forEach(a => {
        questionToAnswerId[a.questionId] = a.id
      })

      // Upload files using the real answerId
      for (const [qId, fileList] of Object.entries(files)) {
        const realAnswerId = questionToAnswerId[Number(qId)] || null
        for (const file of fileList) await evidenceApi.upload(subId, realAnswerId, file)
      }

      if (!isDraft) await submissionsApi.submit(subId)
      toast.success(isDraft ? 'Draft saved' : 'Submitted! Line manager notified.')
      qc.invalidateQueries(['my-submissions'])
      onSuccess()
      handleClose()
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  function handleClose() {
    setStep(1); setSelectedApp(''); setAnswers({}); setFiles({})
    setErrors({}); setExistingFiles([])
    onClose()
  }

  const activeQ  = questions.filter(q=>q.active)
  const answered = activeQ.filter(q=>answers[q.id]?.response).length
  const progress = activeQ.length ? Math.round((answered/activeQ.length)*100) : 0
  const appName  = apps.find(a=>a.id===Number(selectedApp))?.name || existingSubmission?.application?.name || ''
  const mandatoryCount = activeQ.filter(q=>q.required).length
  const completedMandatory = activeQ.filter(q=>q.required && answers[q.id]?.response).length

  return (
    <Modal
      open={open} onClose={handleClose} size="lg"
      title={step===1 ? (isEditing ? 'Edit Snap Check' : 'New Snap Check') : `${appName} Snap Check`}
      subtitle={step===1
        ? (isEditing ? `Editing ${existingSubmission?.period}` : 'Select the control and period')
        : `Period: ${period} · ${answered}/${activeQ.length} answered · ${completedMandatory}/${mandatoryCount} mandatory`}
      footer={
        step===1 ? (
          <>
            <button className="btn btn-ghost" onClick={handleClose}>Cancel</button>
            <button className="btn btn-primary" disabled={!selectedApp||!period} onClick={()=>setStep(2)}>Continue →</button>
          </>
        ) : (
          <>
            {!isEditing && <button className="btn btn-ghost" onClick={()=>setStep(1)}>← Back</button>}
            <button className="btn btn-ghost" onClick={handleClose}>Cancel</button>
            <button className="btn btn-outline" disabled={submitting} onClick={()=>handleSubmit(true)}>Save Draft</button>
            <button className="btn btn-accent" disabled={submitting} onClick={()=>handleSubmit(false)}>
              {submitting ? <><Spinner size="sm" white /> Submitting…</> : 'Submit Snap Check'}
            </button>
          </>
        )
      }
    >
      {/* Step 1 — Select control */}
      {step===1 && (
        <div>
          <div className="form-row" style={{marginBottom:'24px'}}>
            <div>
              <label className="form-label">Control <span style={{color:'var(--accent)'}}>*</span></label>
              <select className="form-control" value={selectedApp} onChange={e=>setSelectedApp(e.target.value)}>
                <option value="">Select snapcheck…</option>
                {apps.filter(a=>a.active).map(a=><option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Period <span style={{color:'var(--accent)'}}>*</span></label>
              <input className="form-control" type="month" value={period} onChange={e=>setPeriod(e.target.value)} />
            </div>
          </div>
          <div style={{background:'var(--canvas)',borderRadius:'var(--radius)',padding:'20px'}}>
            <p style={{fontSize:'11px',fontWeight:700,color:'var(--ink-ghost)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:'16px'}}>Approval Workflow</p>
            <div className="flow">
              {[{label:'You',sublabel:'Submitter',active:true},{label:'Line Manager',sublabel:'Review'},{label:'Risk & Compliance',sublabel:'Final Review'}].map((s,i,arr)=>(
                <div key={i} style={{display:'flex',alignItems:'center',flex:1}}>
                  <div style={{flex:1,textAlign:'center'}}>
                    <div className={`flow-icon ${s.active?'active':'pending'}`}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        {i<2 ? <><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></> : <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>}
                      </svg>
                    </div>
                    <div className="flow-label">{s.label}</div>
                    <div className="flow-sublabel">{s.sublabel}</div>
                  </div>
                  {i<arr.length-1 && <div className="flow-line" />}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Step 2 — Questions */}
      {step===2 && (
        <div>
          {/* Progress */}
          <div style={{display:'flex',alignItems:'center',gap:'12px',padding:'12px',background:'var(--canvas)',borderRadius:'var(--radius)',marginBottom:'20px'}}>
            <div style={{flex:1}}>
              <div style={{display:'flex',justifyContent:'space-between',fontSize:'12px',marginBottom:'6px'}}>
                <span style={{color:'var(--ink-soft)'}}>Completion</span>
                <span style={{fontFamily:'var(--font-mono)',fontWeight:600,color:progress===100?'var(--green)':'var(--ink)'}}>{progress}%</span>
              </div>
              <div className="progress">
                <div className={`progress-bar ${progress===100?'progress-green':'progress-amber'}`} style={{width:`${progress}%`}} />
              </div>
            </div>
            {Object.keys(errors).length > 0 && (
              <div style={{display:'flex',alignItems:'center',gap:'6px',fontSize:'12px',color:'var(--accent)',flexShrink:0}}>
                <AlertCircle size={14}/> {Object.keys(errors).filter(k=>!k.startsWith('evidence_')).length} required
              </div>
            )}
          </div>

          {loadingQ ? <div style={{textAlign:'center',padding:'40px'}}><Spinner /></div> : (
            activeQ.map((q,idx) => (
              <div key={q.id} className="question-card" style={{marginBottom:'12px',border:errors[q.id]?'1.5px solid var(--accent)':'1px solid var(--border)'}}>
                <div className="question-card-header">
                  <span className="question-num">{idx+1}</span>
                  <div style={{flex:1}}>
                    <div className="question-text">{q.text}</div>
                    <div className="question-tags">
                      <span className={`q-tag ${q.required?'q-tag-required':'q-tag-optional'}`}>{q.required?'Mandatory':'Optional'}</span>
                      {q.evidenceRequired && <span className="q-tag q-tag-evidence">Evidence Required</span>}
                      <span className="q-tag q-tag-category">{q.category}</span>
                    </div>
                  </div>
                </div>
                <div className="question-card-body">
                  {/* Error message */}
                  {errors[q.id] && (
                    <div style={{display:'flex',alignItems:'center',gap:'6px',fontSize:'12px',color:'var(--accent)',marginBottom:'8px',padding:'6px 10px',background:'var(--accent-pale)',borderRadius:'4px'}}>
                      <AlertCircle size={12}/> {errors[q.id]}
                    </div>
                  )}

                  {/* Response options */}
                  <div className="radio-opts" style={{marginBottom:'12px'}}>
                    {RESPONSE_OPTIONS.map(opt => (
                      <label key={opt.value}
                        className={`radio-opt${answers[q.id]?.response===opt.value?' selected':''}`}
                        onClick={() => setAnswer(q.id,'response',opt.value)}
                      >
                        <input type="radio" name={`q-${q.id}`} style={{display:'none'}} />
                        {opt.label}
                      </label>
                    ))}
                  </div>

                  {/* Comment */}
                  <textarea className="form-control" rows={2} style={{marginBottom: errors[`na_${q.id}`] ? '4px' : '10px', borderColor: errors[`na_${q.id}`] ? 'var(--accent)' : undefined}}
                    placeholder={answers[q.id]?.response === 'NA' ? 'Required: Explain why this is N/A…' : 'Add comments or observations…'}
                    value={answers[q.id]?.comment||''}
                    onChange={e=>setAnswer(q.id,'comment',e.target.value)}
                  />
                  {errors[`na_${q.id}`] && (
                    <div style={{display:'flex',alignItems:'center',gap:'6px',fontSize:'12px',color:'var(--accent)',marginBottom:'8px',padding:'6px 10px',background:'var(--accent-pale)',borderRadius:'4px'}}>
                      <AlertCircle size={12}/> {errors[`na_${q.id}`]}
                    </div>
                  )}

                  {/* Existing uploaded files for this question */}
                  {existingFiles.filter(f => String(f.answerId) === String(q.id)).map(f => (
                    <div key={f.id} className="evidence-item" style={{background:'var(--canvas)',marginBottom:'4px'}}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{color:'var(--green)',flexShrink:0}}>
                        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
                      </svg>
                      <span className="evidence-name">{f.filename}</span>
                      <span className="evidence-size">{formatFileSize(f.size)}</span>
                      <span style={{fontSize:'10px',color:'var(--green)',fontWeight:600}}>Uploaded</span>
                    </div>
                  ))}

                  {/* New file upload */}
                  {errors[`evidence_${q.id}`] && (
                    <div style={{display:'flex',alignItems:'center',gap:'6px',fontSize:'12px',color:'var(--accent)',marginBottom:'6px',padding:'6px 10px',background:'var(--accent-pale)',borderRadius:'4px'}}>
                      <AlertCircle size={12}/> {errors[`evidence_${q.id}`]}
                    </div>
                  )}

                  {!(files[q.id]?.length) ? (
                    <label className="upload-zone" data-upload-zone="true" style={{borderColor:errors[`evidence_${q.id}`]?'var(--accent)':undefined}}>
                      <Upload size={24} style={{color:'var(--ink-ghost)',display:'block',margin:'0 auto'}} />
                      <p><strong>Click to upload</strong> or drag & drop</p>
                      <small>PDF, Excel, Word, Images up to 25MB</small>
                      <input type="file" style={{display:'none'}} multiple
                        accept=".pdf,.xlsx,.xls,.docx,.doc,.png,.jpg,.jpeg,.eml,.msg"
                        onChange={e=>Array.from(e.target.files).forEach(f=>addFile(q.id,f))} />
                    </label>
                  ) : (
                    <div>
                      {files[q.id].map((f,i)=>(
                        <div key={i} className="evidence-item">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{color:'var(--ink-soft)',flexShrink:0}}>
                            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
                          </svg>
                          <span className="evidence-name">{f.name}</span>
                          <span className="evidence-size">{formatFileSize(f.size)}</span>
                          <button className="evidence-remove" onClick={()=>removeFile(q.id,i)}><X size={13}/></button>
                        </div>
                      ))}
                      <label style={{display:'flex',alignItems:'center',gap:'6px',fontSize:'12px',color:'var(--blue)',cursor:'pointer',marginTop:'6px'}}>
                        <Upload size={12}/> Add another file
                        <input type="file" style={{display:'none'}} multiple onChange={e=>Array.from(e.target.files).forEach(f=>addFile(q.id,f))} />
                      </label>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </Modal>
  )
}
