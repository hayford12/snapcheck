import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Download, FolderOpen, Search } from 'lucide-react'
import { submissionsApi, evidenceApi } from '../../api/services'
import { PageHeader, PageSpinner, EmptyState, StatusBadge } from '../../components/ui/index.jsx'
import { formatDate, formatFileSize } from '../../utils/helpers'
import api from '../../api/axios'

export default function RepositoryPage() {
  const [search, setSearch] = useState('')
  const [appFilter, setAppFilter] = useState('')

  const { data:subs=[], isLoading } = useQuery({
    queryKey:['all-submissions-evidence'],
    queryFn:()=>submissionsApi.getAll().then(r=>r.data),
  })

  // Only show submissions that have evidence
  const withEvidence = subs.filter(s=>s._count?.evidenceFiles>0)
  const filtered = withEvidence.filter(s=>{
    const matchApp  = !appFilter || s.application?.name===appFilter
    const matchSearch = !search || s.application?.name.toLowerCase().includes(search.toLowerCase()) || s.user?.name.toLowerCase().includes(search.toLowerCase()) || s.period.includes(search)
    return matchApp && matchSearch
  })

  const apps = [...new Set(subs.map(s=>s.application?.name).filter(Boolean))].sort()

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
    } catch { }
  }

  if (isLoading) return <PageSpinner />

  return (
    <>
      <PageHeader title="Evidence Repository" subtitle="Browse and download evidence files from all submissions" />

      {/* Filters */}
      <div style={{display:'flex',gap:'12px',marginBottom:'20px'}}>
        <div style={{position:'relative',flex:1,maxWidth:'320px'}}>
          <Search size={14} style={{position:'absolute',left:'10px',top:'50%',transform:'translateY(-50%)',color:'var(--ink-ghost)'}}/>
          <input className="form-control" style={{paddingLeft:'32px'}} placeholder="Search by app, user, or period…" value={search} onChange={e=>setSearch(e.target.value)} />
        </div>
        <select className="form-control" style={{width:'200px'}} value={appFilter} onChange={e=>setAppFilter(e.target.value)}>
          <option value="">All Snapchecks</option>
          {apps.map(a=><option key={a}>{a}</option>)}
        </select>
      </div>

      {filtered.length===0
        ? <EmptyState icon={FolderOpen} title="No evidence files" description="Evidence files uploaded with submissions will appear here." />
        : <div>
            {filtered.map(s=>(
              <EvidenceRow key={s.id} submission={s} onDownload={downloadFile} />
            ))}
          </div>
      }
    </>
  )
}

function EvidenceRow({ submission:s, onDownload }) {
  const [expanded, setExpanded] = useState(false)

  const { data:files=[] } = useQuery({
    queryKey:['evidence', s.id],
    queryFn:()=>evidenceApi.getBySubmission(s.id).then(r=>r.data),
    enabled:expanded,
  })

  return (
    <div className="card" style={{marginBottom:'8px'}}>
      <div className="card-body" style={{display:'flex',alignItems:'center',gap:'16px',cursor:'pointer',padding:'14px 20px'}} onClick={()=>setExpanded(v=>!v)}>
        <span className="app-chip">{s.application?.name}</span>
        <span style={{fontFamily:'var(--font-mono)',fontSize:'12px',color:'var(--ink-soft)'}}>{s.period}</span>
        <span style={{fontSize:'13px',color:'var(--ink-soft)'}}>{s.user?.name}</span>
        <StatusBadge status={s.status}/>
        <span style={{fontSize:'12px',color:'var(--ink-soft)',marginLeft:'auto'}}>{s._count?.evidenceFiles} file{s._count?.evidenceFiles!==1?'s':''}</span>
        <span style={{fontSize:'12px',color:'var(--ink-ghost)'}}>{formatDate(s.createdAt)}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{color:'var(--ink-ghost)',transform:expanded?'rotate(180deg)':'none',transition:'transform 0.2s'}}>
          <path d="M6 9l6 6 6-6"/>
        </svg>
      </div>

      {expanded && (
        <div style={{borderTop:'1px solid var(--border)',padding:'12px 20px',background:'var(--canvas)'}}>
          {files.length===0
            ? <p style={{fontSize:'13px',color:'var(--ink-ghost)'}}>Loading files…</p>
            : files.map(f=>(
                <div key={f.id} className="evidence-item" style={{background:'var(--white)'}}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{color:'var(--ink-soft)'}}>
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
                  </svg>
                  <span className="evidence-name">{f.filename}</span>
                  <span className="evidence-size">{formatFileSize(f.size)}</span>
                  <span style={{fontSize:'11px',color:'var(--ink-ghost)',marginLeft:'auto'}}>{f.uploadedBy?.name}</span>
                  <button className="btn btn-ghost btn-sm" style={{padding:'4px 8px'}} onClick={()=>onDownload(f.id, f.filename)} title="Download">
                    <Download size={13}/>
                  </button>
                </div>
              ))
          }
        </div>
      )}
    </div>
  )
}
