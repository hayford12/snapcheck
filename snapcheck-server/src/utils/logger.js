const fs   = require('fs')
const path = require('path')

const LOG_DIR = process.env.LOG_DIR || path.join(__dirname, '../../logs')
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true })

const LOG_FILES = {
  combined: path.join(LOG_DIR, 'combined.log'),
  error:    path.join(LOG_DIR, 'error.log'),
  access:   path.join(LOG_DIR, 'access.log'),
}

const MAX_SIZE = 10 * 1024 * 1024 // 10MB

function rotateLogs(filePath) {
  try {
    if (fs.existsSync(filePath) && fs.statSync(filePath).size > MAX_SIZE) {
      fs.renameSync(filePath, filePath + '.' + Date.now() + '.bak')
    }
  } catch {}
}

function writeLog(filePath, level, message, meta = null) {
  try {
    rotateLogs(filePath)
    const ts       = new Date().toISOString().replace('T', ' ').substring(0, 19)
    const metaStr  = meta ? ' ' + JSON.stringify(meta) : ''
    const line     = `[${ts}] ${level.toUpperCase().padEnd(5)} ${message}${metaStr}\n`
    fs.appendFileSync(filePath, line, 'utf8')
  } catch {}
}

const logger = {
  info (msg, meta) { console.log  (`[INFO]  ${msg}`); writeLog(LOG_FILES.combined, 'INFO',  msg, meta) },
  warn (msg, meta) { console.warn (`[WARN]  ${msg}`); writeLog(LOG_FILES.combined, 'WARN',  msg, meta); writeLog(LOG_FILES.error, 'WARN',  msg, meta) },
  error(msg, meta) { console.error(`[ERROR] ${msg}`); writeLog(LOG_FILES.combined, 'ERROR', msg, meta); writeLog(LOG_FILES.error, 'ERROR', msg, meta) },
  http (msg, meta) { writeLog(LOG_FILES.combined, 'HTTP',  msg, meta); writeLog(LOG_FILES.access, 'HTTP', msg, meta) },
  debug(msg, meta) { if (process.env.LOG_LEVEL === 'debug') { console.log(`[DEBUG] ${msg}`); writeLog(LOG_FILES.combined, 'DEBUG', msg, meta) } },
}

function requestLogger(req, res, next) {
  const start = Date.now()
  res.on('finish', () => {
    const ms   = Date.now() - start
    const msg  = `${req.method} ${req.originalUrl} ${res.statusCode} ${ms}ms`
    const meta = { ip: req.ip, user: req.user?.email || 'anonymous' }
    if      (res.statusCode >= 500) logger.error(msg, meta)
    else if (res.statusCode >= 400) logger.warn(msg, meta)
    else                            logger.http(msg, meta)
  })
  next()
}

function logAuth(event, email, success, ip = null) {
  const msg = `[AUTH] ${event} — ${email} — ${success ? 'SUCCESS' : 'FAILED'}`
  success ? logger.info(msg, { ip }) : logger.warn(msg, { ip })
}

function logActivity(action, detail, userId = null) {
  logger.info(`[ACTIVITY] ${action}${detail ? ': ' + detail : ''}`, { userId })
}

function logError(message, err = null) {
  logger.error(message, err ? { error: err.message } : null)
  if (err?.stack) writeLog(LOG_FILES.error, 'STACK', err.stack)
}

module.exports = { logger, requestLogger, logAuth, logActivity, logError }
