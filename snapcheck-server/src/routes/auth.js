const express  = require('express')
const bcrypt   = require('bcryptjs')
const jwt      = require('jsonwebtoken')
const { z }    = require('zod')
const prisma   = require('../db/prisma')
const { authenticate } = require('../middleware/auth')
const { auditLog }     = require('../middleware/errorHandler')

const router = express.Router()
// ── Account lockout (in-memory — no extra packages needed) ───────────────────
const loginAttempts = new Map()
const MAX_ATTEMPTS  = 5
const LOCKOUT_MS    = 15 * 60 * 1000 // 15 minutes

function checkLockout(email) {
  const key  = email.toLowerCase()
  const data = loginAttempts.get(key)
  if (!data) return false
  if (Date.now() - data.firstAttempt > LOCKOUT_MS) { loginAttempts.delete(key); return false }
  return data.count >= MAX_ATTEMPTS
}
function recordFail(email) {
  const key  = email.toLowerCase()
  const data = loginAttempts.get(key)
  if (!data || Date.now() - data.firstAttempt > LOCKOUT_MS) {
    loginAttempts.set(key, { count: 1, firstAttempt: Date.now() })
  } else { data.count++ }
}
function clearAttempts(email) { loginAttempts.delete(email.toLowerCase()) }



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
