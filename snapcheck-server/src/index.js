require('dotenv').config()

const express  = require('express')
const cors     = require('cors')
const path     = require('path')

const { errorHandler }          = require('./middleware/errorHandler')
const { logger, requestLogger } = require('./utils/logger')
const sanitizeInput             = require('./middleware/sanitize')

// ── Startup validation — fail fast if required env vars are missing ───────────
const REQUIRED_ENV = ['JWT_SECRET', 'DATABASE_URL']
const missing = REQUIRED_ENV.filter(k => !process.env[k])
if (missing.length) {
  console.error(`[FATAL] Missing required environment variables: ${missing.join(', ')}`)
  console.error('[FATAL] Server cannot start without these. Check your .env file.')
  process.exit(1)
}
if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
  console.error('[FATAL] JWT_SECRET is too short — must be at least 32 characters.')
  process.exit(1)
}

// Routes
const authRoutes        = require('./routes/auth')
const applicationRoutes = require('./routes/applications')
const questionRoutes    = require('./routes/questions')
const submissionRoutes  = require('./routes/submissions')
const approvalRoutes    = require('./routes/approvals')
const evidenceRoutes    = require('./routes/evidence')
const userRoutes        = require('./routes/users')
const dashboardRoutes   = require('./routes/dashboard')
const auditRoutes       = require('./routes/audit')

const app    = express()
const PORT   = process.env.PORT || 5000
const isProd = process.env.NODE_ENV === 'production'

// ── Security headers ──────────────────────────────────────────────────────────
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('X-XSS-Protection', '1; mode=block')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  if (isProd) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  }
  // Remove Express fingerprint
  res.removeHeader('X-Powered-By')
  next()
})

// ── CORS — allowlist only ─────────────────────────────────────────────────────
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : ['http://localhost:5173', 'http://localhost:5000']

app.use(cors({
  origin: (origin, callback) => {
    // Allow same-origin requests (no origin header)
    if (!origin) return callback(null, true)
    if (allowedOrigins.includes(origin) || !isProd) return callback(null, true)
    callback(new Error(`CORS: origin ${origin} not allowed`))
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}))

// Allow ngrok tunnel in dev
if (!isProd) {
  app.use((req, res, next) => {
    res.setHeader('ngrok-skip-browser-warning', 'true')
    next()
  })
}

// ── Body parsers ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: '2mb' }))
app.use(express.urlencoded({ extended: true, limit: '2mb' }))

// ── Input sanitisation (mounted globally) ────────────────────────────────────
app.use(sanitizeInput)

// ── HTTP request logger ───────────────────────────────────────────────────────
app.use(requestLogger)

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/auth',         authRoutes)
app.use('/api/applications', applicationRoutes)
app.use('/api/questions',    questionRoutes)
app.use('/api/submissions',  submissionRoutes)
app.use('/api/approvals',    approvalRoutes)
app.use('/api/evidence',     evidenceRoutes)
app.use('/api/users',        userRoutes)
app.use('/api/dashboard',    dashboardRoutes)
app.use('/api/audit',        auditRoutes)

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// ── Serve React frontend ──────────────────────────────────────────────────────
const frontendDist = process.env.FRONTEND_DIST || path.join(__dirname, '../public')
app.use(express.static(frontendDist, {
  // Don't serve index.html for /api paths
  index: false,
}))

app.get('*', (req, res) => {
  // Don't serve frontend for /api routes
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ message: 'API route not found' })
  }
  res.sendFile(path.join(frontendDist, 'index.html'))
})

// ── Error handler ─────────────────────────────────────────────────────────────
app.use(errorHandler)

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  logger.info(`SnapCheck API Server started`, { port: PORT, env: process.env.NODE_ENV || 'development' })
  console.log('')
  console.log('  SnapCheck API Server')
  console.log(`  ─────────────────────────────────────`)
  console.log(`  Running on  → http://localhost:${PORT}`)
  console.log(`  Health      → http://localhost:${PORT}/api/health`)
  console.log(`  Environment → ${process.env.NODE_ENV || 'development'}`)
  console.log('')
})

module.exports = app
