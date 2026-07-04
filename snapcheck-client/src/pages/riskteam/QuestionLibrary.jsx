import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Edit2, ToggleLeft, ToggleRight, ChevronDown, ChevronRight, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { appsApi, questionsApi } from '../../api/services'
import { PageHeader, PageSpinner, Modal, Spinner } from '../../components/ui/index.jsx'
import { getErrorMessage } from '../../utils/helpers'

function QuestionModal({ question, appId, onClose, onSuccess }) {
  const isEdit = !!question
  const [form, setForm] = useState({
    text:             question?.text||'',
    category:         question?.category||'General',
    required:         question?.required??true,
    evidenceRequired: question?.evidenceRequired??false,
  })
  const [saving, setSaving] = useState(false)
  const set = (k,v) => setForm(p=>({...p,[k]:v}))

  async function handleSave() {
    if (!form.text.trim()) return toast.error('Question text is required')
    setSaving(true)
    try {
      if (isEdit) await questionsApi.update(question.id, form)
      else        await questionsApi.create(appId, form)
      toast.success(isEdit?'Question updated':'Question added')
      onSuccess()
    } catch(e) { toast.error(getErrorMessage(e)) }
    finally { setSaving(false) }
  }

  const CATEGORIES = ['General','Access Control','Authentication','Account Hygiene','Privileged Access','Configuration','Monitoring','Change Management','Code Security','Data Protection','Integration','Patch Management','Segregation']

  return (
    <Modal open onClose={onClose} size="md" title={isEdit?'Edit Question':'Add Question'}
      footer={<>
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn btn-accent" disabled={saving} onClick={handleSave}>
          {saving?<><Spinner size="sm" white/>Saving…</>:(isEdit?'Save':'Add Question')}
        </button>
      </>}
    >
      <div className="form-group"><label className="form-label">Question Text</label>
        <textarea className="form-control" rows={3} value={form.text} onChange={e=>set('text',e.target.value)} placeholder="Enter the compliance question…" />
      </div>
      <div className="form-row">
        <div><label className="form-label">Category</label>
          <select className="form-control" value={form.category} onChange={e=>set('category',e.target.value)}>
            {CATEGORIES.map(c=><option key={c}>{c}</option>)}
          </select>
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:'12px',paddingTop:'22px'}}>
          <label style={{display:'flex',alignItems:'center',gap:'10px',cursor:'pointer',fontSize:'13px',fontWeight:500}}>
            <input type="checkbox" checked={form.required} onChange={e=>set('required',e.target.checked)} style={{width:'16px',height:'16px',accentColor:'var(--accent)'}} />
            Mandatory question
          </label>
          <label style={{display:'flex',alignItems:'center',gap:'10px',cursor:'pointer',fontSize:'13px',fontWeight:500}}>
            <input type="checkbox" checked={form.evidenceRequired} onChange={e=>set('evidenceRequired',e.target.checked)} style={{width:'16px',height:'16px',accentColor:'var(--accent)'}} />
            Evidence required
          </label>
        </div>
      </div>
    </Modal>
  )
}

function AppAccordion({ app }) {
  const qc = useQueryClient()
  const [open, setOpen]     = useState(false)
  const [modal, setModal]   = useState(null) // null | 'new' | question obj

  const { data:questions=[] } = useQuery({
    queryKey:['questions-app', app.id],
    queryFn:()=>questionsApi.getByApp(app.id).then(r=>r.data),
    enabled:open,
  })

  async function toggleQuestion(q) {
    try {
      await questionsApi.toggleActive(q.id)
      toast.success(q.active?'Question deactivated':'Question activated')
      qc.invalidateQueries(['questions-app', app.id])
    } catch(e) { toast.error(getErrorMessage(e)) }
  }

  async function deleteQuestion(q) {
    if (!window.confirm('Delete this question? This cannot be undone.')) return
    try {
      await questionsApi.delete(q.id)
      toast.success('Question deleted')
      qc.invalidateQueries(['questions-app', app.id])
    } catch(e) { toast.error(getErrorMessage(e)) }
  }

  return (
    <div className="card" style={{marginBottom:'8px'}}>
      <div style={{display:'flex',alignItems:'center',gap:'12px',padding:'14px 20px',cursor:'pointer'}} onClick={()=>setOpen(v=>!v)}>
        {open?<ChevronDown size={16} style={{color:'var(--ink-soft)',flexShrink:0}}/>:<ChevronRight size={16} style={{color:'var(--ink-soft)',flexShrink:0}}/>}
        <span style={{fontWeight:600,flex:1}}>{app.name}</span>
        <span style={{fontSize:'12px',color:'var(--ink-ghost)'}}>{app._count?.questions||0} questions</span>
        <span className={`badge ${app.active?'badge-approved':'badge-rejected'}`} style={{marginLeft:'8px'}}>{app.active?'Active':'Inactive'}</span>
        <button className="btn btn-accent btn-sm" style={{marginLeft:'8px'}} onClick={e=>{e.stopPropagation();setOpen(true);setModal('new')}}>
          <Plus size={12}/> Add
        </button>
      </div>

      {open && (
        <div style={{borderTop:'1px solid var(--border)'}}>
          {questions.length===0
            ? <p style={{padding:'16px 20px',fontSize:'13px',color:'var(--ink-ghost)'}}>No questions yet. Click Add to create one.</p>
            : questions.map((q,i)=>(
                <div key={q.id} style={{display:'flex',alignItems:'flex-start',gap:'12px',padding:'12px 20px',borderBottom:'1px solid var(--border)',opacity:q.active?1:0.5}}>
                  <span style={{width:'22px',height:'22px',background:'var(--ink)',color:'white',borderRadius:'50%',fontSize:'11px',fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,marginTop:'1px'}}>{i+1}</span>
                  <div style={{flex:1}}>
                    <p style={{fontSize:'13px',fontWeight:500,color:'var(--ink)'}}>{q.text}</p>
                    <div style={{display:'flex',gap:'6px',marginTop:'5px'}}>
                      <span className="q-tag q-tag-category">{q.category}</span>
                      <span className={`q-tag ${q.required?'q-tag-required':'q-tag-optional'}`}>{q.required?'Mandatory':'Optional'}</span>
                      {q.evidenceRequired&&<span className="q-tag q-tag-evidence">Evidence</span>}
                    </div>
                  </div>
                  <div style={{display:'flex',gap:'6px',flexShrink:0}}>
                    <button className="btn btn-ghost btn-sm" onClick={()=>setModal(q)} title="Edit"><Edit2 size={12}/></button>
                    <button className="btn btn-ghost btn-sm" onClick={()=>toggleQuestion(q)} title={q.active?'Deactivate':'Activate'}>
                      {q.active?<ToggleRight size={14} style={{color:'var(--green)'}}/>:<ToggleLeft size={14} style={{color:'var(--ink-ghost)'}}/>}
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={()=>deleteQuestion(q)} title="Delete Question">
                      <Trash2 size={13} style={{color:'var(--accent)'}}/>
                    </button>
                  </div>
                </div>
              ))
          }
        </div>
      )}

      {modal && (
        <QuestionModal
          question={modal==='new'?null:modal}
          appId={app.id}
          onClose={()=>setModal(null)}
          onSuccess={()=>{ setModal(null); qc.invalidateQueries(['questions-app', app.id]) }}
        />
      )}
    </div>
  )
}

export default function QuestionLibrary() {
  const { data:apps=[], isLoading } = useQuery({
    queryKey:['applications'],
    queryFn:()=>appsApi.getAll().then(r=>r.data),
  })

  if (isLoading) return <PageSpinner />

  return (
    <>
      <PageHeader title="Question Library" subtitle="Manage compliance questions per snapcheck" />
      {apps.map(app=><AppAccordion key={app.id} app={app} />)}
    </>
  )
}
