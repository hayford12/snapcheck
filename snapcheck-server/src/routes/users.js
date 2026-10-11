const express = require('express')
const bcrypt  = require('bcryptjs')
const { z }   = require('zod')
const prisma  = require('../db/prisma')
const { authenticate, requireRole } = require('../middleware/auth')
const { validatePassword, savePasswordHistory } = require('../utils/passwordPolicy')
const { auditLog } = require('../middleware/errorHandler')

const router = express.Router()
router.use(authenticate, requireRole('RISK_TEAM'))

const USER_SELECT = { id:true, name:true, email:true, role:true, active:true, createdAt:true, mustChangePassword:true, passwordChangedAt:true }

// GET /api/users
router.get('/', async (req, res, next) => {
  try {
    const users = await prisma.user.findMany({ select: USER_SELECT, orderBy: { name: 'asc' } })
    res.json(users)
  } catch (err) { next(err) }
})

// GET /api/users/:id
router.get('/:id', async (req, res, next) => {
  try {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: parseInt(req.params.id) }, select: USER_SELECT })
    res.json(user)
  } catch (err) { next(err) }
})

// POST /api/users
// SC-006: enforce full ABSA password policy (12+ chars, complexity, history)
// SC-008: use 12 bcrypt rounds (was 10)
router.post('/', async (req, res, next) => {
  try {
    const schema = z.object({
      name:     z.string().min(1),
      email:    z.string().email(),
      role:     z.enum(['SUBMITTER','MANAGER','RISK_TEAM']),
      password: z.string().min(12),
    })
    const { name, email, role, password } = schema.parse(req.body)

    // SC-006: validate against full policy
    const { valid: policyValid, errors } = validatePassword(password)
    if (!policyValid) {
      return res.status(400).json({ message: errors[0], errors })
    }

    // SC-008: consistent 12 rounds everywhere
    const passwordHash = await bcrypt.hash(password, 12)
    const user = await prisma.user.create({
      data: {
        name,
        email:              email.toLowerCase(),
        role,
        passwordHash,
        mustChangePassword: true,   // force change on first login
      },
      select: USER_SELECT,
    })
    // Save to password history so first password can't be reused immediately
    await savePasswordHistory(prisma, user.id, passwordHash)
    await auditLog(req.user.id, 'CREATE_USER', `Created user ${email}`, 'User', user.id, req)
    res.status(201).json(user)
  } catch (err) { next(err) }
})

// PUT /api/users/:id
// SC-006/SC-008: same policy + 12 rounds on admin-initiated password update
// SC-019: bump tokenVersion when admin sets a new password so existing sessions expire
router.put('/:id', async (req, res, next) => {
  try {
    const schema = z.object({
      name:     z.string().min(1).optional(),
      email:    z.string().email().optional(),
      role:     z.enum(['SUBMITTER','MANAGER','RISK_TEAM']).optional(),
      password: z.string().min(12).optional(),
    })
    const { password, ...rest } = schema.parse(req.body)
    const data = { ...rest }

    if (password) {
      // SC-006: validate policy
      const { valid: policyValid, errors } = validatePassword(password)
      if (!policyValid) {
        return res.status(400).json({ message: errors[0], errors })
      }
      // SC-008: 12 rounds
      const passwordHash = await bcrypt.hash(password, 12)
      await savePasswordHistory(prisma, parseInt(req.params.id), passwordHash)
      data.passwordHash       = passwordHash
      data.mustChangePassword = true        // force the user to change on next login
      data.passwordChangedAt  = new Date()
      // SC-019: bump tokenVersion to invalidate user's existing sessions
      data.tokenVersion = { increment: 1 }
    }

    const user = await prisma.user.update({ where: { id: parseInt(req.params.id) }, data, select: USER_SELECT })
    await auditLog(req.user.id, 'UPDATE_USER', `Updated user ${user.email}`, 'User', user.id, req)
    res.json(user)
  } catch (err) { next(err) }
})

// PATCH /api/users/:id/toggle
router.patch('/:id/toggle', async (req, res, next) => {
  try {
    const existing = await prisma.user.findUniqueOrThrow({ where: { id: parseInt(req.params.id) } })
    if (existing.id === req.user.id) return res.status(400).json({ message: 'Cannot deactivate yourself' })
    const user = await prisma.user.update({ where: { id: existing.id }, data: { active: !existing.active }, select: USER_SELECT })
    await auditLog(req.user.id, user.active ? 'ACTIVATE_USER' : 'DEACTIVATE_USER', `${user.email}`, 'User', user.id, req)
    res.json(user)
  } catch (err) { next(err) }
})

// DELETE /api/users/:id — RC only (cannot delete yourself)
router.delete('/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id)
    if (id === req.user.id) return res.status(400).json({ message: 'Cannot delete your own account' })

    const existing = await prisma.user.findUniqueOrThrow({ where: { id } })

    const [submissionCount, approvalCount] = await Promise.all([
      prisma.submission.count({ where: { userId: id } }),
      prisma.approval.count({ where: { reviewerId: id } }),
    ])

    if (submissionCount > 0 || approvalCount > 0) {
      return res.status(400).json({
        message: `Cannot delete — this user has activity in the system (${submissionCount} submission(s), ${approvalCount} approval(s)). Deactivate them instead.`
      })
    }

    await prisma.user.delete({ where: { id } })
    await auditLog(req.user.id, 'DELETE_USER', `Deleted user ${existing.email}`, 'User', id, req)
    res.json({ message: 'User deleted' })
  } catch (err) { next(err) }
})

// POST /api/users/:id/unlock — RC only — clear login lockout for a user
// SC-002: unlock now clears login_attempts rows (NOT audit_logs)
router.post('/:id/unlock', async (req, res, next) => {
  try {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: parseInt(req.params.id) } })
    // Clear login_attempts (the separate lockout table — not the audit log)
    await prisma.loginAttempt.deleteMany({ where: { userId: user.id } })
    await auditLog(req.user.id, 'UNLOCK_ACCOUNT', `Unlocked account for ${user.email}`, 'User', user.id, req)
    res.json({ message: `Account unlocked for ${user.name}` })
  } catch (err) { next(err) }
})

// POST /api/users/:id/reset-password — RC only — force password reset on next login
router.post('/:id/reset-password', async (req, res, next) => {
  try {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: parseInt(req.params.id) } })
    // SC-019: bump tokenVersion so existing sessions are invalidated
    await prisma.user.update({
      where: { id: user.id },
      data:  { mustChangePassword: true, tokenVersion: { increment: 1 } },
    })
    await auditLog(req.user.id, 'RESET_PASSWORD', `Forced password reset for ${user.email}`, 'User', user.id, req)
    res.json({ message: `Password reset forced for ${user.name}` })
  } catch (err) { next(err) }
})

module.exports = router
