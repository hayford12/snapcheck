const express  = require('express')
const bcrypt   = require('bcryptjs')
const jwt      = require('jsonwebtoken')
const { v4: uuidv4 } = require('uuid')
const { z }    = require('zod')
const prisma   = require('../db/prisma')
const { authenticate } = require('../middleware/auth')
const { validatePassword, isPasswordReused, savePasswordHistory, isPasswordExpired, daysUntilExpiry, POLICY } = require('../utils/passwordPolicy')
const { blacklistToken } = require('../utils/tokenBlacklist')
const { logger } = require('../utils/logger')
const { auditLog }     = require('../middleware/errorHandler')

const router = express.Router()

// ── Account lockout ───────────────────────────────────────────────────────────
// SC-002: lockout now uses the login_attempts table (never deleted).
// Failed login evidence in audit_logs is preserved forever.
const MAX_ATTEMPTS = 3
const LOCKOUT_MS   = 15 * 60 * 1000

async function getFailCount(userId) {
  const since = new Date(Date.now() - LOCKOUT_MS)
  return prisma.loginAttempt.count({
    where: { userId, createdAt: { gte: since } },
  })
}

async function recordLoginAttempt(userId, ip) {
  await prisma.loginAttempt.create({
    data: { userId, ipAddress: ip || null },
  })
}

// SC-001: sign every token with a unique jti so it can be individually revoked
function signToken(user) {
  return jwt.sign(
    { userId: user.id, role: user.role, jti: uuidv4(), tv: user.tokenVersion },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
  )
}

// POST /api/auth/login
router.post('/login', async (req, res, next) => {
  try {
    const schema = z.object({
      email:    z.string().email(),
      password: z.string().min(1),
    })
    const { email, password } = schema.parse(req.body)
    const emailLower = email.toLowerCase()

    // Look up the user first (needed for loginAttempt.userId)
    const user = await prisma.user.findUnique({ where: { email: emailLower } })

    // If user exists, check lockout via login_attempts table (SC-002)
    if (user) {
      const failCount = await getFailCount(user.id)
      logger.debug(`[AUTH] Login attempt for ${emailLower} — fail count: ${failCount}`)

      if (failCount >= MAX_ATTEMPTS) {
        logger.warn(`[AUTH] Account locked for ${emailLower}`)
        return res.status(429).json({
          message: `Account locked due to ${MAX_ATTEMPTS} failed attempts. Try again in 15 minutes.`,
          locked: true,
        })
      }
    }

    if (!user || !user.active) {
      // Record fail in audit_log only (no userId linkable when user doesn't exist)
      await auditLog(null, 'LOGIN_FAIL', emailLower, 'Auth', null, req)
      logger.warn(`[AUTH] Failed login — user not found or inactive`, { ip: req.ip })
      return res.status(401).json({ message: 'Invalid email or password' })
    }

    const valid = await bcrypt.compare(password, user.passwordHash)
    if (!valid) {
      // SC-002: record in login_attempts (immutable, never deleted)
      await recordLoginAttempt(user.id, req.ip)
      await auditLog(user.id, 'LOGIN_FAIL', `Failed login attempt`, 'Auth', user.id, req)
      const newCount = await getFailCount(user.id)
      logger.warn(`[AUTH] Failed login attempt`, { ip: req.ip, count: newCount })
      return res.status(401).json({ message: 'Invalid email or password' })
    }

    // Success — issue token with jti (SC-001)
    const token = signToken(user)

    await auditLog(user.id, 'LOGIN', `User logged in`, 'User', user.id, req)

    // Check password status
    const expired      = isPasswordExpired(user.passwordChangedAt)
    const mustChange   = user.mustChangePassword || expired
    const daysLeft     = daysUntilExpiry(user.passwordChangedAt)
    const expirySoon   = daysLeft <= 14 && !mustChange

    res.json({
      token,
      user: {
        id:          user.id,
        name:        user.name,
        email:       user.email,
        role:        user.role,
        initials:    user.name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase(),
        mustChangePassword: mustChange,
        passwordExpired:    expired,
        daysUntilExpiry:    daysLeft,
        expirySoon,
      },
    })
  } catch (err) { next(err) }
})

// GET /api/auth/me
router.get('/me', authenticate, async (req, res) => {
  res.json({
    success: true,
    data: {
      id:       req.user.id,
      name:     req.user.name,
      email:    req.user.email,
      role:     req.user.role,
      initials: req.user.name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase(),
    }
  })
})

// POST /api/auth/logout
// SC-001: blacklist the token so it cannot be reused after logout
router.post('/logout', authenticate, async (req, res) => {
  const { jti, exp } = req.tokenPayload || {}
  if (jti && exp) blacklistToken(jti, exp)
  await auditLog(req.user.id, 'LOGOUT', 'User logged out', 'User', req.user.id, req)
  res.json({ message: 'Logged out' })
})

// POST /api/auth/refresh
router.post('/refresh', authenticate, async (req, res, next) => {
  try {
    // SC-001: blacklist the old token, issue fresh one
    const { jti, exp } = req.tokenPayload || {}
    if (jti && exp) blacklistToken(jti, exp)

    const freshUser = await prisma.user.findUniqueOrThrow({ where: { id: req.user.id } })
    const newToken  = signToken(freshUser)

    res.json({
      success: true,
      data: {
        token: newToken,
        user: {
          id:       freshUser.id,
          name:     freshUser.name,
          email:    freshUser.email,
          role:     freshUser.role,
          initials: freshUser.name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase(),
        }
      }
    })
  } catch (err) { next(err) }
})

// POST /api/auth/change-password
// SC-003: increment tokenVersion so all OTHER existing sessions become invalid.
// The user gets a fresh token back so their current session stays logged in.
router.post('/change-password', authenticate, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current and new password are required' })
    }

    const user  = await prisma.user.findUniqueOrThrow({ where: { id: req.user.id } })
    const valid = await bcrypt.compare(currentPassword, user.passwordHash)
    if (!valid) {
      return res.status(401).json({ message: 'Current password is incorrect' })
    }

    const { valid: policyValid, errors } = validatePassword(newPassword)
    if (!policyValid) {
      return res.status(400).json({ message: errors[0], errors })
    }

    const reused = await isPasswordReused(prisma, req.user.id, newPassword)
    if (reused) {
      return res.status(400).json({ message: `Password cannot be the same as your last ${POLICY.historyCount} passwords` })
    }

    const newHash = await bcrypt.hash(newPassword, 12)
    await savePasswordHistory(prisma, req.user.id, newHash)

    // SC-003: bump tokenVersion to invalidate all other sessions
    const updated = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        passwordHash:       newHash,
        mustChangePassword: false,
        passwordChangedAt:  new Date(),
        tokenVersion:       { increment: 1 },
      },
    })

    // SC-001: blacklist the current token too (user gets a brand new one below)
    const { jti, exp } = req.tokenPayload || {}
    if (jti && exp) blacklistToken(jti, exp)

    // Issue new token with updated tokenVersion so this session stays alive
    const newToken = signToken(updated)

    await auditLog(req.user.id, 'CHANGE_PASSWORD', 'User changed password', 'User', req.user.id, req)
    res.json({ message: 'Password changed successfully', success: true, token: newToken })
  } catch (err) { next(err) }
})

// GET /api/auth/password-policy
router.get('/password-policy', (req, res) => {
  res.json({
    minLength:      POLICY.minLength,
    historyCount:   POLICY.historyCount,
    expiryDays:     POLICY.expiryDays,
    maxAttempts:    POLICY.maxAttempts,
    requirements: [
      'At least 12 characters long',
      'Must contain at least 3 of: uppercase letters (A-Z), lowercase letters (a-z), digits (0-9), special characters ($, #, @, !, %, ^, &, *, (, ), ,, .)',
      `Cannot be the same as your last ${POLICY.historyCount} passwords`,
      `Expires every ${POLICY.expiryDays} days`,
    ]
  })
})

module.exports = router
