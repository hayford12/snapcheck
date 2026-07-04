const { logError, logActivity } = require('../utils/logger')
const prisma = require('../db/prisma')

// ── Global error handler ──────────────────────────────────────────────────────
function errorHandler(err, req, res, next) {
  const isProd = process.env.NODE_ENV === 'production'
  logError(err.message, err)

  // Zod validation error
  if (err.name === 'ZodError') {
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      errors:  err.errors.map(e => ({ field: e.path.join('.'), message: e.message })),
    })
  }

  // Prisma unique constraint
  if (err.code === 'P2002') {
    return res.status(409).json({ success: false, message: 'A record with this value already exists' })
  }

  // Prisma not found
  if (err.code === 'P2025') {
    return res.status(404).json({ success: false, message: 'Record not found' })
  }

  // Multer file size
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ success: false, message: `File too large. Maximum size is ${process.env.MAX_FILE_SIZE_MB || 25}MB.` })
  }

  const status = err.status || 500
  return res.status(status).json({
    success: false,
    message: isProd && status === 500 ? 'Internal server error' : (err.message || 'Internal server error'),
  })
}

// ── Audit logger ──────────────────────────────────────────────────────────────
async function auditLog(userId, action, detail, entityType, entityId, req) {
  // Write to file log
  logActivity(action, detail, userId)
  try {
    await prisma.auditLog.create({
      data: { userId, action, detail, entityType, entityId, ipAddress: req?.ip || null },
    })
  } catch (e) {
    logError('Audit log failed', e)
  }
}

module.exports = { errorHandler, auditLog }
