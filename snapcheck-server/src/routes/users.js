const express = require('express')
const bcrypt  = require('bcryptjs')
const { z }   = require('zod')
const prisma  = require('../db/prisma')
const { authenticate, requireRole } = require('../middleware/auth')
const { auditLog } = require('../middleware/errorHandler')

const router = express.Router()
router.use(authenticate, requireRole('RISK_TEAM'))

const USER_SELECT = { id:true, name:true, email:true, role:true, active:true, createdAt:true }

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
router.post('/', async (req, res, next) => {
  try {
    const schema = z.object({
      name:     z.string().min(1),
      email:    z.string().email(),
      role:     z.enum(['SUBMITTER','MANAGER','RISK_TEAM']),
      password: z.string().min(8),
    })
    const { name, email, role, password } = schema.parse(req.body)
    const passwordHash = await bcrypt.hash(password, 10)
    const user = await prisma.user.create({ data: { name, email: email.toLowerCase(), role, passwordHash }, select: USER_SELECT })
    await auditLog(req.user.id, 'CREATE_USER', `Created user ${email}`, 'User', user.id, req)
    res.status(201).json(user)
  } catch (err) { next(err) }
})

// PUT /api/users/:id
router.put('/:id', async (req, res, next) => {
  try {
    const schema = z.object({
      name:     z.string().min(1).optional(),
      email:    z.string().email().optional(),
      role:     z.enum(['SUBMITTER','MANAGER','RISK_TEAM']).optional(),
      password: z.string().min(8).optional(),
    })
    const data = schema.parse(req.body)
    if (data.password) {
      data.passwordHash = await bcrypt.hash(data.password, 10)
      delete data.password
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

    // Check all related records
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

module.exports = router
