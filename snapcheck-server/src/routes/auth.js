const express  = require('express')
const bcrypt   = require('bcryptjs')
const jwt      = require('jsonwebtoken')
const { z }    = require('zod')
const prisma   = require('../db/prisma')
const { authenticate } = require('../middleware/auth')
const { auditLog }     = require('../middleware/errorHandler')

const router = express.Router()

// ── Account lockout ───────────────────────────────────────────────────────────
const MAX_ATTEMPTS = 5
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

    res.json({
      token,
      user: {
        id:       user.id,
        name:     user.name,
        email:    user.email,
        role:     user.role,
        initials: user.name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase(),
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

module.exports = router
