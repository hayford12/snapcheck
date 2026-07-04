import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Shield, Download } from 'lucide-react'
import * as XLSX from 'xlsx'
import { auditApi } from '../../api/services'
import { PageHeader, PageSpinner, EmptyState } from '../../components/ui/index.jsx'
import { formatDateTime } from '../../utils/helpers'

const ACTION_COLOURS = {
  LOGIN:'var(--blue)', LOGOUT:'var(--ink-ghost)',
  CREATE_SUBMISSION:'var(--green)', SUBMIT:'var(--green)',
  MANAGER_APPROVE:'var(--green)', RC_APPROVE:'var(--green)',
  MANAGER_REJECT:'var(--accent)', RC_REJECT:'var(--accent)',
  UPLOAD_EVIDENCE:'var(--blue)', DELETE_EVIDENCE:'var(--accent)',
  CREATE_USER:'var(--gold)', UPDATE_USER:'var(--gold)',
  CREATE_APP:'var(--gold)', UPDATE_APP:'var(--gold)',
}

export default function AuditPage() {
  const [page, setPage] = useState(1)
  const [exporting, setExporting] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey:['audit', page],
    queryFn:()=>auditApi.getAll({ page, limit:50 }).then(r=>r.data),
    keepPreviousData:true,
  })

  // Fetch all logs for export (no pagination)
  const { data: allData } = useQuery({
    queryKey:['audit-all'],
    queryFn:()=>auditApi.getAll({ page:1, limit:10000 }).then(r=>r.data),
    enabled: false, // only fetch when export is triggered
  })

  const logs  = data?.logs  || []
  const total = data?.total || 0
  const pages = data?.pages || 1

  async function handleExport() {
    setExporting(true)
    try {
      // Fetch all records for export
      const res  = await auditApi.getAll({ page:1, limit:10000 })
      const all  = res.data?.logs || []
      const date = new Date().toISOString().substring(0,10)

      const rows = all.map(l => ({
        'Timestamp':   formatDateTime(l.createdAt),
        'User':        l.user?.name || 'System',
        'Action':      l.action.replace(/_/g,' '),
        'Detail':      l.detail || '',
        'Entity Type': l.entityType || '',
        'Entity ID':   l.entityId || '',
      }))

      const wb = XLSX.utils.book_new()
      const ws = XLSX.utils.json_to_sheet(rows)

      // Set column widths
      ws['!cols'] = [
        { wch:20 }, { wch:20 }, { wch:22 }, { wch:40 }, { wch:14 }, { wch:10 }
      ]

      XLSX.utils.book_append_sheet(wb, ws, 'Audit Trail')
      XLSX.writeFile(wb, `SnapCheck_AuditTrail_${date}.xlsx`)
    } catch {
      // silent fail
    } finally {
      setExporting(false)
    }
  }

  if (isLoading) return <PageSpinner />

  return (
    <>
      <PageHeader
        title="Audit Trail"
        subtitle={`${total} total events recorded`}
        actions={
          <button className="btn btn-accent btn-sm" onClick={handleExport} disabled={exporting}>
            <Download size={13}/> {exporting ? 'Exporting…' : 'Export to Excel'}
          </button>
        }
      />

      {logs.length===0
        ? <EmptyState icon={Shield} title="No audit events" description="Activity will appear here as users interact with the system." />
        : <>
            <div className="card">
              <table className="data-table">
                <thead>
                  <tr><th>Time</th><th>User</th><th>Action</th><th>Detail</th><th>Entity</th></tr>
                </thead>
                <tbody>
                  {logs.map(l=>(
                    <tr key={l.id}>
                      <td style={{fontFamily:'var(--font-mono)',fontSize:'11px',color:'var(--ink-soft)',whiteSpace:'nowrap'}}>{formatDateTime(l.createdAt)}</td>
                      <td style={{fontSize:'13px',fontWeight:500}}>{l.user?.name||'System'}</td>
                      <td>
                        <span style={{fontSize:'11px',fontWeight:700,padding:'2px 8px',borderRadius:'20px',background:(ACTION_COLOURS[l.action]||'var(--ink-ghost)')+'22',color:ACTION_COLOURS[l.action]||'var(--ink-ghost)',whiteSpace:'nowrap'}}>
                          {l.action.replace(/_/g,' ')}
                        </span>
                      </td>
                      <td style={{fontSize:'12px',color:'var(--ink-soft)',maxWidth:'300px'}}>{l.detail||'—'}</td>
                      <td style={{fontSize:'11px',color:'var(--ink-ghost)',fontFamily:'var(--font-mono)'}}>{l.entityType||'—'}{l.entityId?` #${l.entityId}`:''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pages>1 && (
              <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:'8px',marginTop:'16px'}}>
                <button className="btn btn-outline btn-sm" disabled={page===1} onClick={()=>setPage(p=>p-1)}>← Previous</button>
                <span style={{fontSize:'13px',color:'var(--ink-soft)'}}>Page {page} of {pages}</span>
                <button className="btn btn-outline btn-sm" disabled={page===pages} onClick={()=>setPage(p=>p+1)}>Next →</button>
              </div>
            )}
          </>
      }
    </>
  )
}
