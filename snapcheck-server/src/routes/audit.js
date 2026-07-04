const express = require('express')
const prisma  = require('../db/prisma')
const { authenticate, requireRole } = require('../middleware/auth')

const router = express.Router()
router.use(authenticate, requireRole('RISK_TEAM'))

// GET /api/audit
router.get('/', async (req, res, next) => {
  try {
    const { page = 1, limit = 50, action, userId, entityType } = req.query
    const where = {}
    if (action)     where.action     = { contains: action, mode: 'insensitive' }
    if (userId)     where.userId     = parseInt(userId)
    if (entityType) where.entityType = entityType

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: { user: { select: { name: true, email: true } } },
        orderBy: { createdAt: 'desc' },
        skip:    (parseInt(page) - 1) * parseInt(limit),
        take:    parseInt(limit),
      }),
      prisma.auditLog.count({ where }),
    ])

    res.json({ logs, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) })
  } catch (err) { next(err) }
})

module.exports = router
