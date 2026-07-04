const express = require('express')
const { z }   = require('zod')
const prisma  = require('../db/prisma')
const { authenticate, requireRole } = require('../middleware/auth')
const { auditLog } = require('../middleware/errorHandler')

const router = express.Router()
router.use(authenticate)

const SUBMISSION_INCLUDE = {
  application:   true,
  user:          { select: { id:true, name:true, email:true } },
  riskRating:    true,
  _count:        { select: { answers:true, evidenceFiles:true } },
}

const DETAIL_INCLUDE = {
  application: true,
  user:        { select: { id:true, name:true, email:true } },
  riskRating:  true,
  answers: {
    include: {
      question: true,
      evidenceFiles: { include: { uploadedBy: { select: { name:true } } } },
    },
    orderBy: { question: { order: 'asc' } },
  },
  approvals: {
    include: { reviewer: { select: { id:true, name:true } } },
    orderBy: { createdAt: 'asc' },
  },
}

// GET /api/submissions — RC sees all, manager sees submitted+
router.get('/', async (req, res, next) => {
  try {
    const { limit, sort, status, appId } = req.query
    const where = {}

    if (req.user.role === 'MANAGER') {
      where.status = { in: ['SUBMITTED','MANAGER_APPROVED','MANAGER_REJECTED','RC_APPROVED','RC_REJECTED'] }
    }
    if (status)  where.status = status
    if (appId)   where.applicationId = parseInt(appId)

    const submissions = await prisma.submission.findMany({
      where,
      include:  SUBMISSION_INCLUDE,
      orderBy:  sort === 'recent' ? { updatedAt: 'desc' } : { createdAt: 'desc' },
      take:     limit ? parseInt(limit) : undefined,
    })
    res.json(submissions)
  } catch (err) { next(err) }
})

// GET /api/submissions/mine — submitter's own submissions
router.get('/mine', async (req, res, next) => {
  try {
    const submissions = await prisma.submission.findMany({
      where:   { userId: req.user.id },
      include: SUBMISSION_INCLUDE,
      orderBy: { updatedAt: 'desc' },
    })
    res.json(submissions)
  } catch (err) { next(err) }
})

// GET /api/submissions/:id
router.get('/:id', async (req, res, next) => {
  try {
    const sub = await prisma.submission.findUniqueOrThrow({
      where:   { id: parseInt(req.params.id) },
      include: DETAIL_INCLUDE,
    })
    // Submitters can only see their own
    if (req.user.role === 'SUBMITTER' && sub.userId !== req.user.id) {
      return res.status(403).json({ message: 'Not your submission' })
    }
    res.json(sub)
  } catch (err) { next(err) }
})

// POST /api/submissions — create new (submitter) or return existing draft
router.post('/', async (req, res, next) => {
  try {
    const schema = z.object({
      applicationId: z.number(),
      period:        z.string().regex(/^\d{4}-\d{2}$/, 'Period must be YYYY-MM'),
    })
    const { applicationId, period } = schema.parse(req.body)

    // Check if a draft already exists for this user + app + period
    const existing = await prisma.submission.findFirst({
      where: {
        applicationId,
        userId: req.user.id,
        period,
        status: { in: ['PENDING', 'MANAGER_REJECTED', 'RC_REJECTED'] },
      },
      include: SUBMISSION_INCLUDE,
    })

    if (existing) {
      // Return existing draft instead of creating a duplicate
      return res.status(200).json(existing)
    }

    const sub = await prisma.submission.create({
      data:    { applicationId, userId: req.user.id, period, status: 'PENDING' },
      include: SUBMISSION_INCLUDE,
    })
    await auditLog(req.user.id, 'CREATE_SUBMISSION', `Created submission for app ${applicationId} period ${period}`, 'Submission', sub.id, req)
    res.status(201).json(sub)
  } catch (err) { next(err) }
})

// PUT /api/submissions/:id/answers — save answers
router.put('/:id/answers', async (req, res, next) => {
  try {
    const sub = await prisma.submission.findUniqueOrThrow({ where: { id: parseInt(req.params.id) } })
    if (req.user.role === 'SUBMITTER' && sub.userId !== req.user.id) {
      return res.status(403).json({ message: 'Not your submission' })
    }

    const schema = z.object({
      answers: z.array(z.object({
        questionId: z.number(),
        response:   z.enum(['COMPLIANT','NON_COMPLIANT','PARTIAL_COMPLIANT','NA']).default('NA'),
        comment:    z.string().optional(),
      })),
    })
    const { answers } = schema.parse(req.body)

    const upserted = await Promise.all(
      answers.map(a =>
        prisma.answer.upsert({
          where:  { submissionId_questionId: { submissionId: sub.id, questionId: a.questionId } },
          update: { response: a.response, comment: a.comment },
          create: { submissionId: sub.id, questionId: a.questionId, response: a.response, comment: a.comment },
        })
      )
    )
    res.json(upserted)
  } catch (err) { next(err) }
})

// POST /api/submissions/:id/submit — change status to SUBMITTED
router.post('/:id/submit', async (req, res, next) => {
  try {
    const sub = await prisma.submission.findUniqueOrThrow({
      where:   { id: parseInt(req.params.id) },
      include: { answers: true },
    })

    if (req.user.role === 'SUBMITTER' && sub.userId !== req.user.id) {
      return res.status(403).json({ message: 'Not your submission' })
    }
    if (!['PENDING','MANAGER_REJECTED','RC_REJECTED'].includes(sub.status)) {
      return res.status(400).json({ message: `Cannot submit from status ${sub.status}` })
    }

    const updated = await prisma.submission.update({
      where:   { id: sub.id },
      data:    { status: 'SUBMITTED' },
      include: SUBMISSION_INCLUDE,
    })
    await auditLog(req.user.id, 'SUBMIT', `Submitted snap check ${sub.id}`, 'Submission', sub.id, req)
    res.json(updated)
  } catch (err) { next(err) }
})

// GET /api/submissions/:id/answers
router.get('/:id/answers', async (req, res, next) => {
  try {
    const answers = await prisma.answer.findMany({
      where:   { submissionId: parseInt(req.params.id) },
      include: { question: true },
      orderBy: { question: { order: 'asc' } },
    })
    res.json(answers)
  } catch (err) { next(err) }
})


// DELETE /api/submissions/:id — submitter can delete own drafts only
router.delete('/:id', async (req, res, next) => {
  try {
    const id  = parseInt(req.params.id)
    const sub = await prisma.submission.findUniqueOrThrow({ where: { id } })
    // Only submitter can delete, only PENDING status
    if (sub.userId !== req.user.id && req.user.role !== 'RISK_TEAM') {
      return res.status(403).json({ message: 'Access denied' })
    }
    if (!['PENDING','MANAGER_REJECTED','RC_REJECTED'].includes(sub.status) && req.user.role !== 'RISK_TEAM') {
      return res.status(400).json({ message: 'Only draft or rejected submissions can be deleted' })
    }
    // Delete related records first
    await prisma.answer.deleteMany({ where: { submissionId: id } })
    await prisma.evidenceFile.deleteMany({ where: { submissionId: id } })
    await prisma.approval.deleteMany({ where: { submissionId: id } })
    await prisma.riskRating_.deleteMany({ where: { submissionId: id } })
    await prisma.submission.delete({ where: { id } })
    await auditLog(req.user.id, 'DELETE_SUBMISSION', `Deleted submission ${id}`, 'Submission', id, req)
    res.json({ message: 'Submission deleted' })
  } catch (err) { next(err) }
})

module.exports = router
