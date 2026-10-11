const express = require('express')
const prisma  = require('../db/prisma')
const { authenticate, requireRole } = require('../middleware/auth')

const router = express.Router()
router.use(authenticate, requireRole('RISK_TEAM'))

// GET /api/audit
router.get('/', async (req, res, next) => {
  try {
    // SC-013: cap limit at 200 and validate page to prevent DoS / memory exhaustion
    const limit      = Math.min(Math.max(parseInt(req.query.limit) || 50, 1), 200)
    const page       = Math.max(parseInt(req.query.page) || 1, 1)
    const { action, userId, entityType } = req.query

    const where = {}
    if (action)     where.action     = { contains: action, mode: 'insensitive' }
    if (userId)     where.userId     = parseInt(userId)
    if (entityType) where.entityType = entityType

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: { user: { select: { name: true, email: true } } },
        orderBy: { createdAt: 'desc' },
        skip:    (page - 1) * limit,
        take:    limit,
      }),
      prisma.auditLog.count({ where }),
    ])

    res.json({ logs, total, page, pages: Math.ceil(total / limit) })
  } catch (err) { next(err) }
})

module.exports = router
