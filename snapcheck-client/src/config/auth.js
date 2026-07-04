// ── Role & Route Configuration ────────────────────────────────────────────────
export const ROLES = {
  SUBMITTER: 'SUBMITTER',
  MANAGER:   'MANAGER',
  RISK_TEAM: 'RISK_TEAM',
}

export const ROLE_HOME_ROUTES = {
  SUBMITTER: '/submissions',
  MANAGER:   '/approvals',
  RISK_TEAM: '/dashboard',
}

export const ROLE_LABELS = {
  SUBMITTER: 'Submitter',
  MANAGER:   'Line Manager',
  RISK_TEAM: 'Risk & Compliance',
}

export function getRoleHome(role) {
  return ROLE_HOME_ROUTES[role] || '/login'
}

export const TOKEN_KEY = 'snapcheck_token'
export const USER_KEY  = 'snapcheck_user'

export function parseJwt(token) {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(window.atob(base64))
  } catch {
    return null
  }
}

export function isTokenExpired(token) {
  const payload = parseJwt(token)
  if (!payload?.exp) return true
  return Date.now() >= payload.exp * 1000
}
