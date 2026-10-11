const express = require('express')
const path    = require('path')
const fs      = require('fs')
const prisma  = require('../db/prisma')
const { authenticate }  = require('../middleware/auth')
const { auditLog }      = require('../middleware/errorHandler')
const upload            = require('../middleware/upload')

// SC-018: base directory all uploads must resolve under
const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || './uploads')

// SC-014: sanitize a filename for safe use in Content-Disposition header.
// Strips path separators, control characters, and quotes; falls back to 'download'.
function safeFilename(name) {
  const base = path.basename(name || '')           // strip any directory component
    .replace(/[\x00-\x1f\x7f"\\]/g, '_')          // control chars + quote + backslash → _
    .replace(/\s+/g, '_')                           // whitespace → _
    .trim()
  return base || 'download'
}

// SC-018: resolve the stored filepath against UPLOAD_DIR and reject traversal attempts.
function safeResolvePath(storedPath) {
  // Support both absolute (legacy) and relative paths stored in DB
  const resolved = path.isAbsolute(storedPath)
    ? path.resolve(storedPath)
    : path.resolve(UPLOAD_DIR, storedPath)
  if (!resolved.startsWith(UPLOAD_DIR + path.sep) && resolved !== UPLOAD_DIR) {
    return null   // traversal detected
  }
  return resolved
}

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

    const records = await Promise.all(req.files.map(f => {
      // SC-018: store path relative to UPLOAD_DIR so the DB value is portable
      // and cannot encode an absolute traversal path
      const absPath = path.resolve(f.path)
      const relPath = absPath.startsWith(UPLOAD_DIR + path.sep)
        ? absPath.slice(UPLOAD_DIR.length + 1)
        : absPath  // fallback: store absolute (safeResolvePath will still guard download)

      return prisma.evidenceFile.create({
        data: {
          submissionId,
          answerId:     answerId || null,
          uploadedById: req.user.id,
          filename:     f.originalname,
          filepath:     relPath,
          mimetype:     f.mimetype,
          size:         f.size,
        },
      })
    }))

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

    // SC-018: resolve and validate the path is inside UPLOAD_DIR
    const resolvedPath = safeResolvePath(file.filepath)
    if (!resolvedPath) {
      return res.status(400).json({ message: 'Invalid file path' })
    }

    if (!fs.existsSync(resolvedPath)) {
      return res.status(404).json({ message: 'File not found on disk' })
    }

    // SC-014: sanitize filename before injecting into Content-Disposition header
    const safe = safeFilename(file.filename)
    // RFC 5987 encoding for non-ASCII filenames; ASCII-safe fallback in filename=
    const encoded = encodeURIComponent(safe)
    res.setHeader('Content-Disposition', `attachment; filename="${safe}"; filename*=UTF-8''${encoded}`)
    res.setHeader('Content-Type', file.mimetype)
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('Cache-Control', 'no-store')

    await auditLog(req.user.id, 'DOWNLOAD_EVIDENCE', `Downloaded file ${file.filename}`, 'EvidenceFile', file.id, req)
    res.download(resolvedPath, safe)
  } catch (err) { next(err) }
})

// DELETE /api/evidence/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const file = await prisma.evidenceFile.findUniqueOrThrow({ where: { id: parseInt(req.params.id) } })

    if (req.user.id !== file.uploadedById && req.user.role !== 'RISK_TEAM') {
      return res.status(403).json({ message: 'Cannot delete this file' })
    }

    const resolvedForDelete = safeResolvePath(file.filepath)
    if (resolvedForDelete && fs.existsSync(resolvedForDelete)) fs.unlinkSync(resolvedForDelete)
    await prisma.evidenceFile.delete({ where: { id: file.id } })
    await auditLog(req.user.id, 'DELETE_EVIDENCE', `Deleted file ${file.filename}`, 'EvidenceFile', file.id, req)
    res.json({ message: 'Deleted' })
  } catch (err) { next(err) }
})

module.exports = router
