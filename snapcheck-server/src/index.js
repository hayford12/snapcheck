require('dotenv').config()

const express        = require('express')
const cors           = require('cors')
const path           = require('path')
const helmet         = require('helmet')
const rateLimit      = require('express-rate-limit')
const sanitizeInput  = require('./middleware/sanitize')
const { errorHandler }          = require('./middleware/errorHandler')
const { logger, requestLogger } = require('./utils/logger')

// ── Startup validation ────────────────────────────────────────────────────────
const REQUIRED_ENV = ['JWT_SECRET', 'DATABASE_URL']
const missing = REQUIRED_ENV.filter(k => !process.env[k])
if (missing.length) {
  console.error(`[FATAL] Missing required env vars: ${missing.join(', ')}`)
  process.exit(1)
}
if (process.env.JWT_SECRET.length < 32) {
  console.error('[FATAL] JWT_SECRET must be at least 32 characters.')
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

// ── Helmet security headers ───────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: false,        // managed separately — React needs flexibility
  crossOriginEmbedderPolicy: false,    // needed for file downloads
}))

// ── CORS — allowlist only ─────────────────────────────────────────────────────
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : ['http://localhost:5173', 'http://localhost:5000']

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true)
    if (allowedOrigins.includes(origin) || !isProd) return callback(null, true)
    callback(new Error(`CORS: origin ${origin} not allowed`))
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}))

// ── Rate limiting ─────────────────────────────────────────────────────────────
// Strict limit on login
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { message: 'Too many login attempts. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
})

// General API limit
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  message: { message: 'Too many requests. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
})

app.use('/api/auth/login', loginLimiter)
app.use('/api/', apiLimiter)

// ── Body parsers ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: '2mb' }))
app.use(express.urlencoded({ extended: true, limit: '2mb' }))

// ── Input sanitisation ────────────────────────────────────────────────────────
app.use(sanitizeInput)

// ── HTTP request logger ───────────────────────────────────────────────────────
app.use(requestLogger)

// Allow ngrok in dev
if (!isProd) {
  app.use((req, res, next) => {
    res.setHeader('ngrok-skip-browser-warning', 'true')
    next()
  })
}

// ── API Routes ────────────────────────────────────────────────────────────────
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
app.use(express.static(frontendDist, { index: false }))

app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ message: 'API route not found' })
  }
  res.sendFile(path.join(frontendDist, 'index.html'))
})

// ── Error handler ─────────────────────────────────────────────────────────────
app.use(errorHandler)

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  logger.info('SnapCheck API Server started', { port: PORT, env: process.env.NODE_ENV || 'development' })
  console.log('')
  console.log('  SnapCheck API Server')
  console.log(`  ─────────────────────────────────────`)
  console.log(`  Running on  → http://localhost:${PORT}`)
  console.log(`  Health      → http://localhost:${PORT}/api/health`)
  console.log(`  Environment → ${process.env.NODE_ENV || 'development'}`)
  console.log(`  Security    → Helmet + Rate Limiting + CORS + Input Sanitisation`)
  console.log('')
})

module.exports = app
