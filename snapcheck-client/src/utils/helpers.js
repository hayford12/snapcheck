// Merge class names — no external dependency needed
export function cn(...inputs) {
  return inputs.filter(Boolean).join(' ')
}

// Role helpers
export const ROLES = {
  SUBMITTER: 'SUBMITTER',
  MANAGER:   'MANAGER',
  RISK_TEAM: 'RISK_TEAM',
}

export const ROLE_LABELS = {
  SUBMITTER: 'Submitter',
  MANAGER:   'Line Manager',
  RISK_TEAM: 'Risk & Compliance',
}

// Status helpers
export const STATUS = {
  PENDING:          'PENDING',
  SUBMITTED:        'SUBMITTED',
  MANAGER_APPROVED: 'MANAGER_APPROVED',
  MANAGER_REJECTED: 'MANAGER_REJECTED',
  RC_APPROVED:      'RC_APPROVED',
  RC_REJECTED:      'RC_REJECTED',
}

export const STATUS_LABELS = {
  PENDING:          'Pending',
  SUBMITTED:        'Submitted',
  MANAGER_APPROVED: 'Manager Approved',
  MANAGER_REJECTED: 'Rejected',
  RC_APPROVED:      'Approved',
  RC_REJECTED:      'RC Rejected',
}

export const STATUS_BADGE = {
  PENDING:          'badge-pending',
  SUBMITTED:        'badge-submitted',
  MANAGER_APPROVED: 'badge-review',
  MANAGER_REJECTED: 'badge-rejected',
  RC_APPROVED:      'badge-approved',
  RC_REJECTED:      'badge-rejected',
}

export const RISK_BADGE = {
  Low:    'badge-low',
  Medium: 'badge-medium',
  High:   'badge-high',
}

// Get initials from a name
export function getInitials(name = '') {
  return name
    .split(' ')
    .map(w => w[0])
    .join('')
    .substring(0, 2)
    .toUpperCase()
}

// Format file size
export function formatFileSize(bytes) {
  if (bytes < 1024)        return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// Format date
export function formatDate(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

// Format datetime
export function formatDateTime(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

// App colour map for avatars
export const APP_COLORS = {
  'Active Directory':  { fg: '#1e4a8a', bg: '#e8eef8' },
  'Salesforce':        { fg: '#0070d2', bg: '#e8f4fd' },
  'SAP':               { fg: '#0a5c2e', bg: '#e6f4ec' },
  'ServiceNow':        { fg: '#2d6e4e', bg: '#e8f5ef' },
  'Workday':           { fg: '#b4451b', bg: '#faeae4' },
  'Azure DevOps':      { fg: '#0078d4', bg: '#e5f2fc' },
  'GitHub Enterprise': { fg: '#24292e', bg: '#f0f0f0' },
  'Jira':              { fg: '#0052cc', bg: '#e6ecf8' },
  'Confluence':        { fg: '#172b4d', bg: '#eaecf0' },
  'Splunk':            { fg: '#e20082', bg: '#fce6f3' },
  'CyberArk':          { fg: '#c8402a', bg: '#f9ede9' },
  'Okta':              { fg: '#007dc1', bg: '#e5f2fc' },
}

export function getAppColor(name) {
  return APP_COLORS[name] || { fg: '#6b6b7a', bg: '#eceae3' }
}

export function getAppInitials(name = '') {
  return name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase()
}

export function getErrorMessage(err) {
  return err?.normalizedMessage || err?.response?.data?.message || err?.message || 'An unexpected error occurred'
}
