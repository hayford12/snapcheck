const express = require('express')
const prisma  = require('../db/prisma')
const { authenticate, requireRole } = require('../middleware/auth')

const router = express.Router()
router.use(authenticate, requireRole('RISK_TEAM'))

// GET /api/dashboard/stats
router.get('/stats', async (req, res, next) => {
  try {
    const [total, rcPending, riskCounts, submissions] = await Promise.all([
      prisma.submission.count(),
      prisma.submission.count({ where: { status: 'MANAGER_APPROVED' } }),
      prisma.riskRating_.groupBy({ by: ['rating'], _count: true }),
      prisma.submission.count({ where: { status: 'RC_APPROVED' } }),
    ])

    const riskMap = Object.fromEntries(riskCounts.map(r => [r.rating, r._count]))
    const approved = await prisma.submission.count({ where: { status: 'RC_APPROVED' } })
    const rate = total > 0 ? `${Math.round((approved / total) * 100)}%` : '0%'

    // Progress by application for current month
    const period  = new Date().toISOString().substring(0, 7)
    const apps    = await prisma.application.findMany({ where: { active: true }, select: { id: true, name: true } })
    const progress = await Promise.all(apps.map(async app => {
      const sub = await prisma.submission.findFirst({
        where: { applicationId: app.id, period },
      })
      return {
        name: app.name,
        pct:  sub ? (sub.status === 'RC_APPROVED' ? 100 : sub.status === 'PENDING' ? 10 : 50) : 0,
      }
    }))

    res.json({
      total,
      rcPending,
      highRisk: riskMap['High']  || 0,
      medRisk:  riskMap['Medium']|| 0,
      lowRisk:  riskMap['Low']   || 0,
      rate,
      progress: progress.sort((a, b) => b.pct - a.pct),
    })
  } catch (err) { next(err) }
})

// GET /api/dashboard/activity
router.get('/activity', async (req, res, next) => {
  try {
    const logs = await prisma.auditLog.findMany({
      include: { user: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 10,
    })
    res.json(logs.map(l => ({
      user:   l.user?.name || 'System',
      action: l.action.replace(/_/g, ' ').toLowerCase(),
      detail: l.detail,
      time:   l.createdAt,
    })))
  } catch (err) { next(err) }
})

module.exports = router
