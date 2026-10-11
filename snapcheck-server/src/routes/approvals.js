const express = require('express')
const { z }   = require('zod')
const prisma  = require('../db/prisma')
const { authenticate, requireRole } = require('../middleware/auth')
const { auditLog } = require('../middleware/errorHandler')

const router = express.Router()
router.use(authenticate)

// GET /api/approvals/pending — items awaiting current user's action
router.get('/pending', async (req, res, next) => {
  try {
    let where = {}

    if (req.user.role === 'MANAGER') {
      where = { status: 'SUBMITTED' }
    } else if (req.user.role === 'RISK_TEAM') {
      where = { status: 'MANAGER_APPROVED' }
    } else {
      return res.json([])
    }

    const submissions = await prisma.submission.findMany({
      where,
      include: {
        application: true,
        user:        { select: { id:true, name:true, email:true } },
        _count:      { select: { answers:true, evidenceFiles:true } },
      },
      orderBy: { updatedAt: 'asc' }, // oldest first
    })
    res.json(submissions)
  } catch (err) { next(err) }
})

// GET /api/approvals/submission/:id
router.get('/submission/:id', async (req, res, next) => {
  try {
    const approvals = await prisma.approval.findMany({
      where:   { submissionId: parseInt(req.params.id) },
      include: { reviewer: { select: { id:true, name:true } } },
      orderBy: { createdAt: 'asc' },
    })
    res.json(approvals)
  } catch (err) { next(err) }
})

// POST /api/approvals/:id/manager-approve
// SC-012: only MANAGER role may act at this stage — RC cannot skip the manager step
router.post('/:id/manager-approve', requireRole('MANAGER'), async (req, res, next) => {
  try {
    const { comment } = z.object({ comment: z.string().min(1) }).parse(req.body)
    const sub = await prisma.submission.findUniqueOrThrow({ where: { id: parseInt(req.params.id) } })

    if (sub.status !== 'SUBMITTED') {
      return res.status(400).json({ message: `Cannot approve from status ${sub.status}` })
    }

    await prisma.$transaction([
      prisma.approval.create({
        data: {
          submissionId: sub.id,
          reviewerId:   req.user.id,
          stage:        'MANAGER',
          decision:     'APPROVED',
          comment,
        },
      }),
      prisma.submission.update({
        where: { id: sub.id },
        data:  { status: 'MANAGER_APPROVED' },
      }),
    ])

    await auditLog(req.user.id, 'MANAGER_APPROVE', `Manager approved submission ${sub.id}`, 'Submission', sub.id, req)
    res.json({ message: 'Approved' })
  } catch (err) { next(err) }
})

// POST /api/approvals/:id/manager-reject
// SC-012: only MANAGER role
router.post('/:id/manager-reject', requireRole('MANAGER'), async (req, res, next) => {
  try {
    const { comment } = z.object({ comment: z.string().min(1) }).parse(req.body)
    const sub = await prisma.submission.findUniqueOrThrow({ where: { id: parseInt(req.params.id) } })

    if (sub.status !== 'SUBMITTED') {
      return res.status(400).json({ message: `Cannot reject from status ${sub.status}` })
    }

    await prisma.$transaction([
      prisma.approval.create({
        data: {
          submissionId: sub.id,
          reviewerId:   req.user.id,
          stage:        'MANAGER',
          decision:     'REJECTED',
          comment,
        },
      }),
      prisma.submission.update({
        where: { id: sub.id },
        data:  { status: 'MANAGER_REJECTED' },
      }),
    ])

    await auditLog(req.user.id, 'MANAGER_REJECT', `Manager rejected submission ${sub.id}: ${comment}`, 'Submission', sub.id, req)
    res.json({ message: 'Rejected' })
  } catch (err) { next(err) }
})

// POST /api/approvals/:id/rc-approve — RC final approval with risk rating
// SC-012: prevent same person from approving at both stages
router.post('/:id/rc-approve', requireRole('RISK_TEAM'), async (req, res, next) => {
  try {
    const schema = z.object({
      comment:    z.string().min(1),
      riskRating: z.enum(['Low','Medium','High']),
    })
    const { comment, riskRating } = schema.parse(req.body)
    const sub = await prisma.submission.findUniqueOrThrow({ where: { id: parseInt(req.params.id) } })

    if (sub.status !== 'MANAGER_APPROVED') {
      return res.status(400).json({ message: `Cannot RC-approve from status ${sub.status}` })
    }

    // SC-012: dual-approval integrity — RC approver must not be the same person who approved at manager stage
    const managerApproval = await prisma.approval.findFirst({
      where: { submissionId: sub.id, stage: 'MANAGER', decision: 'APPROVED' },
    })
    if (managerApproval && managerApproval.reviewerId === req.user.id) {
      return res.status(403).json({ message: 'Segregation of duties: you approved this at the manager stage and cannot also approve at the RC stage.' })
    }

    await prisma.$transaction([
      prisma.approval.create({
        data: {
          submissionId: sub.id,
          reviewerId:   req.user.id,
          stage:        'RISK_TEAM',
          decision:     'APPROVED',
          comment,
          riskRating,
        },
      }),
      prisma.submission.update({
        where: { id: sub.id },
        data:  { status: 'RC_APPROVED' },
      }),
      prisma.riskRating_.upsert({
        where:  { submissionId: sub.id },
        update: { rating: riskRating, assignedById: req.user.id },
        create: { submissionId: sub.id, rating: riskRating, assignedById: req.user.id },
      }),
    ])

    await auditLog(req.user.id, 'RC_APPROVE', `RC approved submission ${sub.id} — Risk: ${riskRating}`, 'Submission', sub.id, req)
    res.json({ message: 'Approved' })
  } catch (err) { next(err) }
})

// POST /api/approvals/:id/rc-reject
router.post('/:id/rc-reject', requireRole('RISK_TEAM'), async (req, res, next) => {
  try {
    const { comment } = z.object({ comment: z.string().min(1) }).parse(req.body)
    const sub = await prisma.submission.findUniqueOrThrow({ where: { id: parseInt(req.params.id) } })

    if (sub.status !== 'MANAGER_APPROVED') {
      return res.status(400).json({ message: `Cannot RC-reject from status ${sub.status}` })
    }

    await prisma.$transaction([
      prisma.approval.create({
        data: {
          submissionId: sub.id,
          reviewerId:   req.user.id,
          stage:        'RISK_TEAM',
          decision:     'REJECTED',
          comment,
        },
      }),
      prisma.submission.update({
        where: { id: sub.id },
        data:  { status: 'RC_REJECTED' },
      }),
    ])

    await auditLog(req.user.id, 'RC_REJECT', `RC rejected submission ${sub.id}: ${comment}`, 'Submission', sub.id, req)
    res.json({ message: 'Rejected' })
  } catch (err) { next(err) }
})

module.exports = router
