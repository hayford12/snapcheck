const multer = require('multer')
const path   = require('path')
const fs     = require('fs')

const UPLOAD_DIR    = process.env.UPLOAD_DIR || './uploads'
const MAX_SIZE_MB   = parseInt(process.env.MAX_FILE_SIZE_MB || '25', 10)
const ALLOWED_TYPES = [
  'application/pdf',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'text/csv',
]

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true })

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Organise into sub-folders by submission ID
    const subDir = path.join(UPLOAD_DIR, `submission_${req.params.submissionId || 'misc'}`)
    if (!fs.existsSync(subDir)) fs.mkdirSync(subDir, { recursive: true })
    cb(null, subDir)
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now()
    const safe      = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')
    cb(null, `${timestamp}_${safe}`)
  },
})

const fileFilter = (req, file, cb) => {
  if (ALLOWED_TYPES.includes(file.mimetype)) {
    cb(null, true)
  } else {
    cb(new Error(`File type not allowed: ${file.mimetype}`), false)
  }
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_SIZE_MB * 1024 * 1024 },
})

module.exports = upload
