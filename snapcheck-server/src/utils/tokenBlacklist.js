/**
 * SC-001 — In-process JWT token blacklist with TTL-based auto-eviction.
 * For multi-process / multi-instance deployments, replace the Set with
 * a Redis client (e.g. ioredis) using SETEX so entries expire automatically.
 *
 * Usage:
 *   blacklistToken(jti, exp)   — call on logout / password-change
 *   isBlacklisted(jti)         — call in auth middleware before allowing request
 */

const { logger } = require('./logger')

// jti → expiry timestamp (ms)
const _blacklist = new Map()

/** Add a token to the blacklist until its natural expiry. */
function blacklistToken(jti, exp) {
  if (!jti) return
  const expiresAt = exp * 1000          // JWT exp is in seconds
  const ttl       = expiresAt - Date.now()
  if (ttl <= 0) return                  // already expired — nothing to do

  _blacklist.set(jti, expiresAt)

  // Automatically remove after expiry so the Map never grows unbounded
  setTimeout(() => {
    _blacklist.delete(jti)
  }, ttl).unref()                       // .unref() so this doesn't block process exit

  logger.debug(`[TokenBlacklist] Revoked token ${jti}, expires in ${Math.round(ttl / 1000)}s`)
}

/** Returns true when the token has been explicitly revoked. */
function isBlacklisted(jti) {
  if (!jti) return false
  const expiresAt = _blacklist.get(jti)
  if (!expiresAt) return false
  // Defensive: also check the expiry hasn't passed
  if (Date.now() > expiresAt) {
    _blacklist.delete(jti)
    return false
  }
  return true
}

/** Current size — useful for health-check / monitoring. */
function blacklistSize() {
  return _blacklist.size
}

module.exports = { blacklistToken, isBlacklisted, blacklistSize }
