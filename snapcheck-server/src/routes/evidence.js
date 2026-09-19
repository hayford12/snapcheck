const express = require('express')
const path    = require('path')
const fs      = require('fs')
const prisma  = require('../db/prisma')
const { authenticate }  = require('../middleware/auth')
const { auditLog }      = require('../middleware/errorHandler')
const upload            = require('../middleware/upload')

const router = express.Router()
router.use(authenticate)

// Helper — check if user can access a submission's evidence
async function canAccessSubmission(user, submissionId) {
  const sub = await prisma.submission.findUnique({ where: { id: submissionId } })
  if (!sub) return false
  if (user.role === 'SUBMITTER')  return sub.userId === user.id
  if (user.role === 'MANAGER')    return true  // managers review all
  if (user.role === 'RISK_TEAM')  return true  // RC reviews all
  return false
}

// POST /api/evidence/:submissionId — upload file(s)
router.post('/:submissionId', upload.array('file', 10), async (req, res, next) => {
  try {
    const submissionId = parseInt(req.params.submissionId)
    const answerId = req.body.answerId && req.body.answerId !== 'null' && req.body.answerId !== 'undefined'
      ? parseInt(req.body.answerId)
      : null

    const sub = await prisma.submission.findUniqueOrThrow({ where: { id: submissionId } })

    // Only the submitter who owns this submission can upload
    if (req.user.role === 'SUBMITTER' && sub.userId !== req.user.id) {
      return res.status(403).json({ message: 'Access denied' })
    }

    if (!req.files?.length) {
      return res.status(400).json({ message: 'No files uploaded' })
    }

    const records = await Promise.all(req.files.map(f =>
      prisma.evidenceFile.create({
        data: {
          submissionId,
          answerId:     answerId || null,
          uploadedById: req.user.id,
          filename:     f.originalname,
          filepath:     f.path,
          mimetype:     f.mimetype,
          size:         f.size,
        },
      })
    ))

    await auditLog(req.user.id, 'UPLOAD_EVIDENCE', `Uploaded ${records.length} file(s) to submission ${submissionId}`, 'EvidenceFile', submissionId, req)
    res.status(201).json(records)
  } catch (err) { next(err) }
})

// GET /api/evidence/submission/:submissionId — list files (access controlled)
router.get('/submission/:submissionId', async (req, res, next) => {
  try {
    const submissionId = parseInt(req.params.submissionId)

    // Verify user has access to this submission
    const allowed = await canAccessSubmission(req.user, submissionId)
    if (!allowed) return res.status(403).json({ message: 'Access denied' })

    const files = await prisma.evidenceFile.findMany({
      where:   { submissionId },
      include: { uploadedBy: { select: { name: true } } },
      orderBy: { createdAt: 'asc' },
    })
    res.json(files)
  } catch (err) { next(err) }
})

// GET /api/evidence/:id/download — access controlled download
router.get('/:id/download', async (req, res, next) => {
  try {
    const file = await prisma.evidenceFile.findUniqueOrThrow({
      where:   { id: parseInt(req.params.id) },
      include: { submission: true },
    })

    // Verify user has access to the submission this file belongs to
    const allowed = await canAccessSubmission(req.user, file.submissionId)
    if (!allowed) return res.status(403).json({ message: 'Access denied' })

    if (!fs.existsSync(file.filepath)) {
      return res.status(404).json({ message: 'File not found on disk' })
    }

    // Security headers for file download
    res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`)
    res.setHeader('Content-Type', file.mimetype)
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('Cache-Control', 'no-store')

    await auditLog(req.user.id, 'DOWNLOAD_EVIDENCE', `Downloaded file ${file.filename}`, 'EvidenceFile', file.id, req)
    res.download(file.filepath, file.filename)
  } catch (err) { next(err) }
})

// DELETE /api/evidence/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const file = await prisma.evidenceFile.findUniqueOrThrow({ where: { id: parseInt(req.params.id) } })

    if (req.user.id !== file.uploadedById && req.user.role !== 'RISK_TEAM') {
      return res.status(403).json({ message: 'Cannot delete this file' })
    }

    if (fs.existsSync(file.filepath)) fs.unlinkSync(file.filepath)
    await prisma.evidenceFile.delete({ where: { id: file.id } })
    await auditLog(req.user.id, 'DELETE_EVIDENCE', `Deleted file ${file.filename}`, 'EvidenceFile', file.id, req)
    res.json({ message: 'Deleted' })
  } catch (err) { next(err) }
})

module.exports = router
