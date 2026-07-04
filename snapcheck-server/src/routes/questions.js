const express = require('express')
const { z }   = require('zod')
const prisma  = require('../db/prisma')
const { authenticate, requireRole } = require('../middleware/auth')
const { auditLog } = require('../middleware/errorHandler')

const router = express.Router()
router.use(authenticate)

// GET /api/questions/app/:appId
router.get('/app/:appId', async (req, res, next) => {
  try {
    const questions = await prisma.question.findMany({
      where:   { applicationId: parseInt(req.params.appId) },
      orderBy: { order: 'asc' },
    })
    res.json(questions)
  } catch (err) { next(err) }
})

// POST /api/questions/app/:appId — RC only
router.post('/app/:appId', requireRole('RISK_TEAM'), async (req, res, next) => {
  try {
    const schema = z.object({
      text:             z.string().min(1),
      category:         z.string().default('General'),
      required:         z.boolean().default(true),
      evidenceRequired: z.boolean().default(false),
    })
    const data = schema.parse(req.body)

    // Get current max order
    const last = await prisma.question.findFirst({
      where:   { applicationId: parseInt(req.params.appId) },
      orderBy: { order: 'desc' },
    })

    const q = await prisma.question.create({
      data: { ...data, applicationId: parseInt(req.params.appId), order: (last?.order ?? -1) + 1 },
    })
    await auditLog(req.user.id, 'CREATE_QUESTION', `Added question to app ${req.params.appId}`, 'Question', q.id, req)
    res.status(201).json(q)
  } catch (err) { next(err) }
})

// PUT /api/questions/:id — RC only
router.put('/:id', requireRole('RISK_TEAM'), async (req, res, next) => {
  try {
    const schema = z.object({
      text:             z.string().min(1).optional(),
      category:         z.string().optional(),
      required:         z.boolean().optional(),
      evidenceRequired: z.boolean().optional(),
      order:            z.number().optional(),
    })
    const data = schema.parse(req.body)
    const q = await prisma.question.update({ where: { id: parseInt(req.params.id) }, data })
    await auditLog(req.user.id, 'UPDATE_QUESTION', `Updated question ${q.id}`, 'Question', q.id, req)
    res.json(q)
  } catch (err) { next(err) }
})

// PATCH /api/questions/:id/toggle — RC only
router.patch('/:id/toggle', requireRole('RISK_TEAM'), async (req, res, next) => {
  try {
    const existing = await prisma.question.findUniqueOrThrow({ where: { id: parseInt(req.params.id) } })
    const q = await prisma.question.update({
      where: { id: existing.id },
      data:  { active: !existing.active },
    })
    await auditLog(req.user.id, q.active ? 'ACTIVATE_QUESTION' : 'DEACTIVATE_QUESTION', `Question ${q.id}`, 'Question', q.id, req)
    res.json(q)
  } catch (err) { next(err) }
})

// DELETE /api/questions/:id — RC only
router.delete('/:id', requireRole('RISK_TEAM'), async (req, res, next) => {
  try {
    await prisma.question.delete({ where: { id: parseInt(req.params.id) } })
    await auditLog(req.user.id, 'DELETE_QUESTION', `Deleted question ${req.params.id}`, 'Question', parseInt(req.params.id), req)
    res.json({ message: 'Deleted' })
  } catch (err) { next(err) }
})

// PUT /api/questions/app/:appId/reorder — RC only
router.put('/app/:appId/reorder', requireRole('RISK_TEAM'), async (req, res, next) => {
  try {
    const { ids } = z.object({ ids: z.array(z.number()) }).parse(req.body)
    await Promise.all(ids.map((id, index) =>
      prisma.question.update({ where: { id }, data: { order: index } })
    ))
    res.json({ message: 'Reordered' })
  } catch (err) { next(err) }
})

module.exports = router
