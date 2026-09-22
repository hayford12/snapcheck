const express  = require('express')
const bcrypt   = require('bcryptjs')
const jwt      = require('jsonwebtoken')
const { z }    = require('zod')
const prisma   = require('../db/prisma')
const { authenticate } = require('../middleware/auth')
const { validatePassword, isPasswordReused, savePasswordHistory, isPasswordExpired, daysUntilExpiry, POLICY } = require('../utils/passwordPolicy')
const { auditLog }     = require('../middleware/errorHandler')

const router = express.Router()

// ── Account lockout ───────────────────────────────────────────────────────────
const MAX_ATTEMPTS = 3  // ABSA policy: lock after 3 attempts
const LOCKOUT_MS   = 15 * 60 * 1000

async function getFailCount(email) {
  const since = new Date(Date.now() - LOCKOUT_MS)
  return await prisma.auditLog.count({
    where: {
      action:    'LOGIN_FAIL',
      detail:    email.toLowerCase(),
      createdAt: { gte: since },
    },
  })
}

async function recordFail(email, ip) {
  await prisma.auditLog.create({
    data: {
      action:     'LOGIN_FAIL',
      detail:     email.toLowerCase(),
      entityType: 'Auth',
      ipAddress:  ip || null,
    },
  })
}

async function clearFails(email) {
  await prisma.auditLog.deleteMany({
    where: { action: 'LOGIN_FAIL', detail: email.toLowerCase() },
  })
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

    // Check how many recent failures
    const failCount = await getFailCount(emailLower)
    console.log(`[AUTH] Login attempt for ${emailLower} — fail count: ${failCount}`)

    if (failCount >= MAX_ATTEMPTS) {
      console.log(`[AUTH] Account locked: ${emailLower}`)
      return res.status(429).json({
        message: `Account locked due to ${MAX_ATTEMPTS} failed attempts. Try again in 15 minutes.`,
        locked: true,
      })
    }

    const user = await prisma.user.findUnique({ where: { email: emailLower } })
    if (!user || !user.active) {
      await recordFail(emailLower, req.ip)
      console.log(`[AUTH] Failed login — user not found: ${emailLower}`)
      return res.status(401).json({ message: 'Invalid email or password' })
    }

    const valid = await bcrypt.compare(password, user.passwordHash)
    if (!valid) {
      await recordFail(emailLower, req.ip)
      console.log(`[AUTH] Failed login — wrong password: ${emailLower} (total fails: ${failCount + 1})`)
      return res.status(401).json({ message: 'Invalid email or password' })
    }

    // Success — clear failed attempts
    await clearFails(emailLower)

    const token = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    )

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
router.post('/logout', authenticate, async (req, res) => {
  await auditLog(req.user.id, 'LOGOUT', 'User logged out', 'User', req.user.id, req)
  res.json({ message: 'Logged out' })
})

// POST /api/auth/refresh
router.post('/refresh', authenticate, async (req, res, next) => {
  try {
    const newToken = jwt.sign(
      { userId: req.user.id, role: req.user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    )
    res.json({
      success: true,
      data: {
        token: newToken,
        user: {
          id:       req.user.id,
          name:     req.user.name,
          email:    req.user.email,
          role:     req.user.role,
          initials: req.user.name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase(),
        }
      }
    })
  } catch (err) { next(err) }
})


// POST /api/auth/change-password
router.post('/change-password', authenticate, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current and new password are required' })
    }

    // Verify current password
    const user  = await prisma.user.findUniqueOrThrow({ where: { id: req.user.id } })
    const valid = await bcrypt.compare(currentPassword, user.passwordHash)
    if (!valid) {
      return res.status(401).json({ message: 'Current password is incorrect' })
    }

    // Validate new password against policy
    const { valid: policyValid, errors } = validatePassword(newPassword)
    if (!policyValid) {
      return res.status(400).json({ message: errors[0], errors })
    }

    // Check password history
    const reused = await isPasswordReused(prisma, req.user.id, newPassword)
    if (reused) {
      return res.status(400).json({ message: `Password cannot be the same as your last ${12} passwords` })
    }

    // Hash and save
    const newHash = await bcrypt.hash(newPassword, 12)
    await savePasswordHistory(prisma, req.user.id, newHash)
    await prisma.user.update({
      where: { id: req.user.id },
      data: {
        passwordHash:      newHash,
        mustChangePassword: false,
        passwordChangedAt: new Date(),
      },
    })

    await auditLog(req.user.id, 'CHANGE_PASSWORD', 'User changed password', 'User', req.user.id, req)
    res.json({ message: 'Password changed successfully', success: true })
  } catch (err) { next(err) }
})

// GET /api/auth/password-policy — return policy for frontend
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
