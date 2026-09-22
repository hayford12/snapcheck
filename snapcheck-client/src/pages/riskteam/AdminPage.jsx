import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, UserCheck, UserX, Edit2, RefreshCw, Trash2, LockOpen, RotateCcw } from 'lucide-react'
import toast from 'react-hot-toast'
import { usersApi, appsApi } from '../../api/services'
import { PageHeader, Tabs, Modal, Spinner } from '../../components/ui/index.jsx'
import { formatDate, getErrorMessage } from '../../utils/helpers'

const ROLE_LABELS = { SUBMITTER:'Submitter', MANAGER:'Line Manager', RISK_TEAM:'Risk & Compliance' }
const ROLE_COLOURS = { SUBMITTER:'var(--blue)', MANAGER:'var(--amber)', RISK_TEAM:'var(--absa-red)' }

function UserModal({ user, onClose, onSuccess }) {
  const isEdit = !!user
  const [form, setForm] = useState({ name: user?.name||'', email: user?.email||'', role: user?.role||'SUBMITTER', password: '' })
  const [saving, setSaving] = useState(false)
  const set = (k,v) => setForm(p=>({...p,[k]:v}))

  async function handleSave() {
    if (!form.name || !form.email) return toast.error('Name and email are required')
    if (!isEdit && !form.password) return toast.error('Password is required for new users')
    setSaving(true)
    try {
      if (isEdit) await usersApi.update(user.id, { name:form.name, email:form.email, role:form.role, ...(form.password?{password:form.password}:{}) })
      else        await usersApi.create(form)
      toast.success(isEdit ? 'User updated' : 'User created')
      onSuccess()
    } catch(e) { toast.error(getErrorMessage(e)) }
    finally { setSaving(false) }
  }

  return (
    <Modal open onClose={onClose} size="sm" title={isEdit?'Edit User':'New User'}
      footer={<>
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn btn-accent" disabled={saving} onClick={handleSave}>
          {saving?<><Spinner size="sm" white/>Saving…</>:(isEdit?'Save Changes':'Create User')}
        </button>
      </>}
    >
      <div className="form-group"><label className="form-label">Full Name</label>
        <input className="form-control" value={form.name} onChange={e=>set('name',e.target.value)} placeholder="e.g. John Smith" />
      </div>
      <div className="form-group"><label className="form-label">Email Address</label>
        <input className="form-control" type="email" value={form.email} onChange={e=>set('email',e.target.value)} placeholder="john@company.com" />
      </div>
      <div className="form-group"><label className="form-label">Role</label>
        <select className="form-control" value={form.role} onChange={e=>set('role',e.target.value)}>
          {Object.entries(ROLE_LABELS).map(([k,v])=><option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      <div className="form-group"><label className="form-label">{isEdit?'New Password (leave blank to keep current)':'Password'}</label>
        <input className="form-control" type="password" value={form.password} onChange={e=>set('password',e.target.value)} placeholder="Min 12 chars, uppercase, lowercase, digit, special char" />
      </div>
    </Modal>
  )
}

function AppModal({ app, onClose, onSuccess }) {
  const isEdit = !!app
  const [form, setForm] = useState({ name:app?.name||'', description:app?.description||'', frequency:app?.frequency||'Monthly' })
  const [saving, setSaving] = useState(false)
  const set = (k,v) => setForm(p=>({...p,[k]:v}))

  async function handleSave() {
    if (!form.name) return toast.error('Snapcheck name is required')
    setSaving(true)
    try {
      if (isEdit) await appsApi.update(app.id, form)
      else        await appsApi.create(form)
      toast.success(isEdit?'Snapcheck updated':'Snapcheck created')
      onSuccess()
    } catch(e) { toast.error(getErrorMessage(e)) }
    finally { setSaving(false) }
  }

  return (
    <Modal open onClose={onClose} size="sm" title={isEdit?'Edit Snapcheck':'New Snapcheck'}
      footer={<>
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn btn-accent" disabled={saving} onClick={handleSave}>
          {saving?<><Spinner size="sm" white/>Saving…</>:(isEdit?'Save Changes':'Create')}
        </button>
      </>}
    >
      <div className="form-group"><label className="form-label">Snapcheck Name</label>
        <input className="form-control" value={form.name} onChange={e=>set('name',e.target.value)} placeholder="e.g. Active Directory" />
      </div>
      <div className="form-group"><label className="form-label">Description</label>
        <textarea className="form-control" rows={2} value={form.description} onChange={e=>set('description',e.target.value)} placeholder="Brief description" />
      </div>
      <div className="form-group"><label className="form-label">Check Frequency</label>
        <select className="form-control" value={form.frequency} onChange={e=>set('frequency',e.target.value)}>
          {['Monthly','Quarterly','Bi-Annual','Annual'].map(f=><option key={f}>{f}</option>)}
        </select>
      </div>
    </Modal>
  )
}

export default function AdminPage() {
  const qc = useQueryClient()
  const [tab, setTab]       = useState('users')
  const [userModal, setUserModal] = useState(null) // null | 'new' | user obj
  const [appModal,  setAppModal]  = useState(null)

  const { data:users=[], isLoading:loadingU } = useQuery({ queryKey:['users'], queryFn:()=>usersApi.getAll().then(r=>r.data) })
  const { data:apps=[],  isLoading:loadingA } = useQuery({ queryKey:['applications'], queryFn:()=>appsApi.getAll().then(r=>r.data) })

  async function toggleUser(u) {
    try {
      await usersApi.toggleActive(u.id)
      toast.success(u.active?'User deactivated':'User activated')
      qc.invalidateQueries(['users'])
    } catch(e) { toast.error(getErrorMessage(e)) }
  }

  async function deleteUser(u) {
    if (!window.confirm(`Delete user "${u.name}"? This cannot be undone.`)) return
    try {
      await usersApi.delete(u.id)
      toast.success('User deleted')
      qc.invalidateQueries(['users'])
    } catch(e) { toast.error(getErrorMessage(e)) }
  }

  async function unlockUser(u) {
    try {
      await usersApi.unlock(u.id)
      toast.success(`${u.name}'s account unlocked`)
      qc.invalidateQueries(['users'])
    } catch(e) { toast.error(getErrorMessage(e)) }
  }

  async function resetUserPassword(u) {
    if (!window.confirm(`Force ${u.name} to change their password on next login?`)) return
    try {
      await usersApi.resetPassword(u.id)
      toast.success(`Password reset forced for ${u.name}`)
      qc.invalidateQueries(['users'])
    } catch(e) { toast.error(getErrorMessage(e)) }
  }

  async function toggleApp(a) {
    try {
      await appsApi.toggleActive(a.id)
      toast.success(a.active?'Snapcheck deactivated':'Snapcheck activated')
      qc.invalidateQueries(['applications'])
    } catch(e) { toast.error(getErrorMessage(e)) }
  }

  const tabs = [
    { id:'users', label:'Users', badge:users.length||undefined },
    { id:'apps',  label:'Snapchecks', badge:apps.length||undefined },
  ]

  return (
    <>
      <PageHeader title="Administration" subtitle="Manage users and snapchecks"
        actions={
          tab==='users'
            ? <button className="btn btn-accent" onClick={()=>setUserModal('new')}><Plus size={14}/>New User</button>
            : <button className="btn btn-accent" onClick={()=>setAppModal('new')}><Plus size={14}/>New Snapcheck</button>
        }
      />

      <Tabs tabs={tabs} active={tab} onChange={setTab} />

      {/* Users tab */}
      {tab==='users' && (
        <div className="card">
          <table className="data-table">
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Created</th><th>Actions</th></tr></thead>
            <tbody>
              {users.map(u=>(
                <tr key={u.id}>
                  <td style={{fontWeight:500}}>{u.name}</td>
                  <td style={{fontSize:'13px',color:'var(--ink-soft)'}}>{u.email}</td>
                  <td>
                    <span style={{fontSize:'11px',fontWeight:700,padding:'2px 9px',borderRadius:'20px',background:ROLE_COLOURS[u.role]+'22',color:ROLE_COLOURS[u.role]}}>
                      {ROLE_LABELS[u.role]}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${u.active?'badge-approved':'badge-rejected'}`}>{u.active?'Active':'Inactive'}</span>
                  </td>
                  <td style={{fontSize:'12px',color:'var(--ink-soft)'}}>{formatDate(u.createdAt)}</td>
                  <td>
                    <div style={{display:'flex',gap:'6px'}}>
                      <button className="btn btn-ghost btn-sm" onClick={()=>setUserModal(u)} title="Edit"><Edit2 size={13}/></button>
                      <button className="btn btn-ghost btn-sm" onClick={()=>toggleUser(u)} title={u.active?'Deactivate':'Activate'}>
                        {u.active?<UserX size={13} style={{color:'var(--accent)'}}/>:<UserCheck size={13} style={{color:'var(--green)'}}/>}
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={()=>deleteUser(u)} title="Delete User">
                        <Trash2 size={13} style={{color:'var(--accent)'}}/>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Apps tab */}
      {tab==='apps' && (
        <div className="card">
          <table className="data-table">
            <thead><tr><th>Snapcheck</th><th>Description</th><th>Frequency</th><th>Questions</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {apps.map(a=>(
                <tr key={a.id}>
                  <td style={{fontWeight:500}}>{a.name}</td>
                  <td style={{fontSize:'12px',color:'var(--ink-soft)',maxWidth:'240px'}}>{a.description}</td>
                  <td style={{fontSize:'12px'}}>{a.frequency}</td>
                  <td style={{fontFamily:'var(--font-mono)',fontSize:'12px'}}>{a._count?.questions??'—'}</td>
                  <td><span className={`badge ${a.active?'badge-approved':'badge-rejected'}`}>{a.active?'Active':'Inactive'}</span></td>
                  <td>
                    <div style={{display:'flex',gap:'6px'}}>
                      <button className="btn btn-ghost btn-sm" onClick={()=>setAppModal(a)} title="Edit Snapcheck"><Edit2 size={13}/></button>
                      <button className="btn btn-ghost btn-sm" onClick={()=>toggleApp(a)}>
                        <RefreshCw size={13} style={{color:a.active?'var(--accent)':'var(--green)'}}/>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {userModal && (
        <UserModal
          user={userModal==='new'?null:userModal}
          onClose={()=>setUserModal(null)}
          onSuccess={()=>{ setUserModal(null); qc.invalidateQueries(['users']) }}
        />
      )}
      {appModal && (
        <AppModal
          app={appModal==='new'?null:appModal}
          onClose={()=>setAppModal(null)}
          onSuccess={()=>{ setAppModal(null); qc.invalidateQueries(['applications']) }}
        />
      )}
    </>
  )
}
