require('dotenv').config()

const express  = require('express')
const cors     = require('cors')
const path     = require('path')

const { errorHandler }  = require('./middleware/errorHandler')
const { logger, requestLogger } = require('./utils/logger')

// Routes
const authRoutes         = require('./routes/auth')
const applicationRoutes  = require('./routes/applications')
const questionRoutes     = require('./routes/questions')
const submissionRoutes   = require('./routes/submissions')
const approvalRoutes     = require('./routes/approvals')
const evidenceRoutes     = require('./routes/evidence')
const userRoutes         = require('./routes/users')
const dashboardRoutes    = require('./routes/dashboard')
const auditRoutes        = require('./routes/audit')

const app  = express()
const PORT = process.env.PORT || 5000

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors({
  origin:      true, // allow all origins during testing
  credentials: true,
}))
// Allow ngrok tunnel (skips browser warning page)
app.use((req, res, next) => {
  res.setHeader('ngrok-skip-browser-warning', 'true')
  next()
})

app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Serve uploaded files statically (with auth this would be behind a route)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')))

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/auth',         authRoutes)
app.use('/api/applications', applicationRoutes)
app.use('/api/questions',    questionRoutes)
app.use('/api/submissions',  submissionRoutes)
app.use('/api/approvals',    approvalRoutes)
app.use('/api/evidence',     evidenceRoutes)
app.use('/api/users',        userRoutes)
app.use('/api/dashboard',    dashboardRoutes)
app.use('/api/audit',         auditRoutes)
// app.use('/api/notifications', notificationRoutes)

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// ── Serve React frontend ──────────────────────────────────────────────────────
const frontendDist = process.env.FRONTEND_DIST 
  || path.join(__dirname, '../public')
app.use(express.static(frontendDist))

// All non-API routes serve the React app
app.get('*', (req, res) => {
  res.sendFile(path.join(frontendDist, 'index.html'))
})

// ── Error handler ─────────────────────────────────────────────────────────────
app.use(errorHandler)

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log('')
  console.log('  SnapCheck API Server')
  console.log(`  ─────────────────────────────────────`)
  console.log(`  Running on  → http://localhost:${PORT}`)
  console.log(`  Health      → http://localhost:${PORT}/api/health`)
  console.log(`  Environment → ${process.env.NODE_ENV || 'development'}`)
  console.log('')
})

module.exports = app
