const express = require('express')
const { z }   = require('zod')
const prisma  = require('../db/prisma')
const { authenticate, requireRole } = require('../middleware/auth')
const { auditLog } = require('../middleware/errorHandler')

const router = express.Router()
router.use(authenticate)

// GET /api/applications
router.get('/', async (req, res, next) => {
  try {
    const apps = await prisma.application.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { questions: { where: { active: true } }, submissions: true } },
      },
    })
    res.json(apps)
  } catch (err) { next(err) }
})

// GET /api/applications/:id
router.get('/:id', async (req, res, next) => {
  try {
    const app = await prisma.application.findUniqueOrThrow({
      where: { id: parseInt(req.params.id) },
      include: { questions: { where: { active: true }, orderBy: { order: 'asc' } } },
    })
    res.json(app)
  } catch (err) { next(err) }
})

// POST /api/applications — RC only
router.post('/', requireRole('RISK_TEAM'), async (req, res, next) => {
  try {
    const schema = z.object({
      name:        z.string().min(1),
      description: z.string().optional(),
      frequency:   z.string().optional(),
    })
    const data = schema.parse(req.body)
    const app  = await prisma.application.create({ data })
    await auditLog(req.user.id, 'CREATE_APP', `Created application: ${app.name}`, 'Application', app.id, req)
    res.status(201).json(app)
  } catch (err) { next(err) }
})

// PUT /api/applications/:id — RC only
router.put('/:id', requireRole('RISK_TEAM'), async (req, res, next) => {
  try {
    const schema = z.object({
      name:        z.string().min(1).optional(),
      description: z.string().optional(),
      frequency:   z.string().optional(),
    })
    const data = schema.parse(req.body)
    const app  = await prisma.application.update({ where: { id: parseInt(req.params.id) }, data })
    await auditLog(req.user.id, 'UPDATE_APP', `Updated application: ${app.name}`, 'Application', app.id, req)
    res.json(app)
  } catch (err) { next(err) }
})

// PATCH /api/applications/:id/toggle — RC only
router.patch('/:id/toggle', requireRole('RISK_TEAM'), async (req, res, next) => {
  try {
    const existing = await prisma.application.findUniqueOrThrow({ where: { id: parseInt(req.params.id) } })
    const app = await prisma.application.update({
      where: { id: existing.id },
      data:  { active: !existing.active },
    })
    await auditLog(req.user.id, app.active ? 'ACTIVATE_APP' : 'DEACTIVATE_APP', `${app.name}`, 'Application', app.id, req)
    res.json(app)
  } catch (err) { next(err) }
})


// DELETE /api/applications/:id — RC only
router.delete('/:id', requireRole('RISK_TEAM'), async (req, res, next) => {
  try {
    const id  = parseInt(req.params.id)
    const app = await prisma.application.findUniqueOrThrow({ where: { id }, include: { _count: { select: { submissions: true } } } })
    if (app._count.submissions > 0) {
      return res.status(400).json({ message: `Cannot delete — this snapcheck has ${app._count.submissions} submission(s). Deactivate it instead.` })
    }
    await prisma.application.delete({ where: { id } })
    await auditLog(req.user.id, 'DELETE_APP', `Deleted application: ${app.name}`, 'Application', id, req)
    res.json({ message: 'Snapcheck deleted' })
  } catch (err) { next(err) }
})

module.exports = router
