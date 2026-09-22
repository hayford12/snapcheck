import api from './axios'

// ── Auth ──────────────────────────────────────────────────────────────────────
export const authApi = {
  login:   (email, password) => api.post('/auth/login', { email, password }),
  me:      ()                => api.get('/auth/me'),
  logout:  ()                => api.post('/auth/logout'),
  refresh: ()                => api.post('/auth/refresh'),
}

// ── Submissions ───────────────────────────────────────────────────────────────
export const submissionsApi = {
  getAll:      (params)           => api.get('/submissions', { params }),
  getMine:     (params)           => api.get('/submissions/mine', { params }),
  getById:     (id)               => api.get(`/submissions/${id}`),
  create:      (data)             => api.post('/submissions', data),
  update:      (id, data)         => api.put(`/submissions/${id}`, data),
  submit:      (id)               => api.post(`/submissions/${id}/submit`),
  saveDraft:   (id, data)         => api.put(`/submissions/${id}/draft`, data),
  getAnswers:  (id)               => api.get(`/submissions/${id}/answers`),
  saveAnswers: (id, answers)      => api.put(`/submissions/${id}/answers`, { answers }),
  delete:      (id)               => api.delete(`/submissions/${id}`),
}

// ── Approvals ─────────────────────────────────────────────────────────────────
export const approvalsApi = {
  getPending:      ()             => api.get('/approvals/pending'),
  getBySubmission: (id)           => api.get(`/approvals/submission/${id}`),
  managerApprove:  (id, comment)  => api.post(`/approvals/${id}/manager-approve`, { comment }),
  managerReject:   (id, comment)  => api.post(`/approvals/${id}/manager-reject`,  { comment }),
  rcApprove:       (id, data)     => api.post(`/approvals/${id}/rc-approve`,      data),
  rcReject:        (id, comment)  => api.post(`/approvals/${id}/rc-reject`,       { comment }),
}

// ── Questions ─────────────────────────────────────────────────────────────────
export const questionsApi = {
  getByApp:   (appId)       => api.get(`/questions/app/${appId}`),
  create:     (appId, data) => api.post(`/questions/app/${appId}`, data),
  update:     (id, data)    => api.put(`/questions/${id}`, data),
  delete:     (id)          => api.delete(`/questions/${id}`),
  reorder:    (appId, ids)  => api.put(`/questions/app/${appId}/reorder`, { ids }),
  toggleActive:(id)         => api.patch(`/questions/${id}/toggle`),
}

// ── Applications ──────────────────────────────────────────────────────────────
export const appsApi = {
  getAll:     ()          => api.get('/applications'),
  getById:    (id)        => api.get(`/applications/${id}`),
  create:     (data)      => api.post('/applications', data),
  update:     (id, data)  => api.put(`/applications/${id}`, data),
  toggleActive:(id)       => api.patch(`/applications/${id}/toggle`),
  delete:      (id)       => api.delete(`/applications/${id}`),
}

// ── Evidence ──────────────────────────────────────────────────────────────────
export const evidenceApi = {
  upload:     (submissionId, answerId, file) => {
    const form = new FormData()
    form.append('file', file)
    if (answerId !== null && answerId !== undefined) {
      form.append('answerId', answerId)
    }
    return api.post(`/evidence/${submissionId}`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  getBySubmission: (id) => api.get(`/evidence/submission/${id}`),
  delete:          (id) => api.delete(`/evidence/${id}`),
  download:        (id) => api.get(`/evidence/${id}/download`, { responseType: 'blob' }),
}

// ── Users ─────────────────────────────────────────────────────────────────────
export const usersApi = {
  getAll:      ()          => api.get('/users'),
  getById:     (id)        => api.get(`/users/${id}`),
  create:      (data)      => api.post('/users', data),
  update:      (id, data)  => api.put(`/users/${id}`, data),
  toggleActive:(id)        => api.patch(`/users/${id}/toggle`),
  invite:      (email)     => api.post('/users/invite', { email }),
  delete:      (id)        => api.delete(`/users/${id}`),
  unlock:      (id)        => api.post(`/users/${id}/unlock`),
  resetPassword:(id)       => api.post(`/users/${id}/reset-password`),
}

// ── Reports ───────────────────────────────────────────────────────────────────
export const reportsApi = {
  getSummary:    (params)  => api.get('/reports/summary',  { params }),
  getRisk:       (params)  => api.get('/reports/risk',     { params }),
  getCompliance: (params)  => api.get('/reports/compliance',{ params }),
  exportExcel:   (params)  => api.get('/reports/export/excel', { params, responseType: 'blob' }),
  exportPdf:     (params)  => api.get('/reports/export/pdf',   { params, responseType: 'blob' }),
}

// ── Audit Log ─────────────────────────────────────────────────────────────────
export const auditApi = {
  getAll: (params) => api.get('/audit', { params }),
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
export const dashboardApi = {
  getStats:    () => api.get('/dashboard/stats'),
  getActivity: () => api.get('/dashboard/activity'),
  getProgress: () => api.get('/dashboard/progress'),
}

// ── Notifications ─────────────────────────────────────────────────────────────
export const notificationsApi = {
  getAll: () => api.get('/notifications'),
}
