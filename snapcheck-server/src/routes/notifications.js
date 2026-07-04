const express = require('express')
const prisma  = require('../db/prisma')
const { authenticate } = require('../middleware/auth')

const router = express.Router()
router.use(authenticate)

// GET /api/notifications — role-aware live notifications
router.get('/', async (req, res, next) => {
  try {
    const notifications = []
    const user = req.user

    if (user.role === 'SUBMITTER') {
      // Rejected submissions
      const rejected = await prisma.submission.findMany({
        where:   { userId: user.id, status: { in: ['MANAGER_REJECTED', 'RC_REJECTED'] } },
        include: { application: true },
        orderBy: { updatedAt: 'desc' },
        take:    10,
      })
      rejected.forEach(s => notifications.push({
        id:    `rej-${s.id}`,
        type:  'rejected',
        title: 'Submission Rejected',
        body:  `${s.application?.name} (${s.period}) requires revision.`,
        time:  s.updatedAt,
        link:  '/submissions',
      }))

      // Approved submissions
      const approved = await prisma.submission.findMany({
        where:   { userId: user.id, status: 'RC_APPROVED' },
        include: { application: true, riskRating_: true },
        orderBy: { updatedAt: 'desc' },
        take:    5,
      })
      approved.forEach(s => notifications.push({
        id:    `app-${s.id}`,
        type:  'approved',
        title: 'Submission Approved',
        body:  `${s.application?.name} (${s.period}) fully approved. Risk: ${s.riskRating_?.rating || 'N/A'}`,
        time:  s.updatedAt,
        link:  '/submissions',
      }))

      // Draft reminders
      const drafts = await prisma.submission.findMany({
        where:   { userId: user.id, status: 'PENDING' },
        include: { application: true },
        orderBy: { createdAt: 'desc' },
        take:    5,
      })
      drafts.forEach(s => notifications.push({
        id:    `draft-${s.id}`,
        type:  'pending',
        title: 'Draft Pending',
        body:  `${s.application?.name} (${s.period}) — not yet submitted.`,
        time:  s.createdAt,
        link:  '/submissions',
      }))
    }

    if (user.role === 'MANAGER') {
      const pending = await prisma.submission.findMany({
        where:   { status: 'SUBMITTED' },
        include: { application: true, user: { select: { name: true } } },
        orderBy: { createdAt: 'asc' },
        take:    10,
      })
      pending.forEach(s => notifications.push({
        id:    `mgr-${s.id}`,
        type:  'pending',
        title: 'Awaiting Your Review',
        body:  `${s.application?.name} (${s.period}) submitted by ${s.user?.name}.`,
        time:  s.createdAt,
        link:  '/approvals',
      }))
    }

    if (user.role === 'RISK_TEAM') {
      const pending = await prisma.submission.findMany({
        where:   { status: 'MANAGER_APPROVED' },
        include: { application: true, user: { select: { name: true } } },
        orderBy: { updatedAt: 'asc' },
        take:    10,
      })
      pending.forEach(s => notifications.push({
        id:    `rc-${s.id}`,
        type:  'pending',
        title: 'Awaiting RC Review',
        body:  `${s.application?.name} (${s.period}) approved by manager.`,
        time:  s.updatedAt,
        link:  '/rc-approvals',
      }))
    }

    // Sort by time descending
    notifications.sort((a, b) => new Date(b.time) - new Date(a.time))

    res.json({ success: true, data: notifications })
  } catch (err) { next(err) }
})

module.exports = router
