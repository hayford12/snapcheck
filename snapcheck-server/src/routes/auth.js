const express  = require('express')
const bcrypt   = require('bcryptjs')
const jwt      = require('jsonwebtoken')
const { z }    = require('zod')
const prisma   = require('../db/prisma')
const { authenticate } = require('../middleware/auth')
const { auditLog }     = require('../middleware/errorHandler')

const router = express.Router()
// ── Account lockout (in-memory — no extra packages needed) ───────────────────
// ── Account lockout (DB-backed — survives server restarts) ───────────────────
const MAX_ATTEMPTS = 5
const LOCKOUT_MS   = 15 * 60 * 1000

async function checkLockout(email) {
  try {
    const key = email.toLowerCase()
    const recent = await prisma.auditLog.findMany({
      where: {
        action: 'LOGIN_FAIL',
        detail: { contains: key },
        createdAt: { gte: new Date(Date.now() - LOCKOUT_MS) },
      },
    })
    return recent.length >= MAX_ATTEMPTS
  } catch { return false }
}

async function recordFail(email) {
  try {
    await prisma.auditLog.create({
      data: { userId: null, action: 'LOGIN_FAIL', detail: `Failed login attempt for ${email.toLowerCase()}`, entityType: 'User', entityId: 0, ipAddress: null },
    })
  } catch {}
}

async function clearAttempts(email) {
  try {
    await prisma.auditLog.deleteMany({
      where: {
        action: 'LOGIN_FAIL',
        detail: { contains: email.toLowerCase() },
        createdAt: { gte: new Date(Date.now() - LOCKOUT_MS) },
      },
    })
  } catch {}
}



// POST /api/auth/login
router.post('/login', async (req, res, next) => {
  try {
    const schema = z.object({
      email:    z.string().email(),
      password: z.string().min(1),
    })
    const { email, password } = schema.parse(req.body)

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } })
    if (!user || !user.active) {
      return res.status(401).json({ message: 'Invalid email or password' })
    }

    const valid = await bcrypt.compare(password, user.passwordHash)
    if (!valid) {
      return res.status(401).json({ message: 'Invalid email or password' })
    }

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
  } catch (err) {
    next(err)
  }
})

// GET /api/auth/me — returns current user from token
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

// POST /api/auth/logout — client-side only (just for audit trail)
router.post('/logout', authenticate, async (req, res) => {
  await auditLog(req.user.id, 'LOGOUT', 'User logged out', 'User', req.user.id, req)
  res.json({ message: 'Logged out' })
})


// POST /api/auth/refresh — issue new token if current is valid and near expiry
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
