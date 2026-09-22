const bcrypt = require('bcryptjs')

const POLICY = {
  minLength:       12,
  requireUpper:    true,
  requireLower:    true,
  requireDigit:    true,
  requireSpecial:  true,
  historyCount:    12,   // not same as last 12 passwords
  expiryDays:      90,   // expire every 90 days
  maxAttempts:     3,    // lock after 3 attempts (ABSA requirement)
  lockoutMinutes:  15,
}

// Validate password against ABSA policy
function validatePassword(password) {
  const errors = []

  if (password.length < POLICY.minLength) {
    errors.push(`Password must be at least ${POLICY.minLength} characters long`)
  }

  const hasUpper   = /[A-Z]/.test(password)
  const hasLower   = /[a-z]/.test(password)
  const hasDigit   = /[0-9]/.test(password)
  const hasSpecial = /[$#@!%^&*(),.]/.test(password)

  // Must contain at least 3 of the 4 character types
  const typeCount = [hasUpper, hasLower, hasDigit, hasSpecial].filter(Boolean).length
  if (typeCount < 3) {
    errors.push('Password must contain at least 3 of: uppercase letters, lowercase letters, digits, special characters ($, #, @, !, %, ^, &, *, (, ), ,, .)')
  }

  return { valid: errors.length === 0, errors }
}

// Check if password was used in last N passwords
async function isPasswordReused(prisma, userId, newPassword) {
  const history = await prisma.passwordHistory.findMany({
    where:   { userId },
    orderBy: { createdAt: 'desc' },
    take:    POLICY.historyCount,
  })

  for (const entry of history) {
    const match = await bcrypt.compare(newPassword, entry.passwordHash)
    if (match) return true
  }
  return false
}

// Save password to history
async function savePasswordHistory(prisma, userId, passwordHash) {
  await prisma.passwordHistory.create({
    data: { userId, passwordHash },
  })

  // Keep only last 12
  const all = await prisma.passwordHistory.findMany({
    where:   { userId },
    orderBy: { createdAt: 'desc' },
  })
  if (all.length > POLICY.historyCount) {
    const toDelete = all.slice(POLICY.historyCount).map(h => h.id)
    await prisma.passwordHistory.deleteMany({ where: { id: { in: toDelete } } })
  }
}

// Check if password is expired
function isPasswordExpired(passwordChangedAt) {
  const expiryMs  = POLICY.expiryDays * 24 * 60 * 60 * 1000
  const changedAt = new Date(passwordChangedAt)
  return Date.now() - changedAt.getTime() > expiryMs
}

// Days until password expires
function daysUntilExpiry(passwordChangedAt) {
  const expiryMs  = POLICY.expiryDays * 24 * 60 * 60 * 1000
  const changedAt = new Date(passwordChangedAt)
  const remaining = expiryMs - (Date.now() - changedAt.getTime())
  return Math.max(0, Math.ceil(remaining / (24 * 60 * 60 * 1000)))
}

module.exports = {
  POLICY,
  validatePassword,
  isPasswordReused,
  savePasswordHistory,
  isPasswordExpired,
  daysUntilExpiry,
}
