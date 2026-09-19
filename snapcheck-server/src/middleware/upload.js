const multer = require('multer')
const path   = require('path')
const fs     = require('fs')

const UPLOAD_DIR  = process.env.UPLOAD_DIR || './uploads'
const MAX_SIZE_MB = parseInt(process.env.MAX_FILE_SIZE_MB || '25', 10)

// Both MIME type AND extension must match — prevents MIME spoofing
const ALLOWED = [
  { mime: 'application/pdf',                                                          ext: '.pdf'  },
  { mime: 'application/vnd.ms-excel',                                                ext: '.xls'  },
  { mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',       ext: '.xlsx' },
  { mime: 'application/msword',                                                       ext: '.doc'  },
  { mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', ext: '.docx' },
  { mime: 'image/png',                                                                ext: '.png'  },
  { mime: 'image/jpeg',                                                               ext: '.jpg'  },
  { mime: 'image/jpeg',                                                               ext: '.jpeg' },
  { mime: 'text/csv',                                                                 ext: '.csv'  },
]

const ALLOWED_MIMES = new Set(ALLOWED.map(a => a.mime))
const ALLOWED_EXTS  = new Set(ALLOWED.map(a => a.ext))

// Block dangerous extensions regardless of MIME
const BLOCKED_EXTS = new Set([
  '.exe', '.bat', '.cmd', '.sh', '.ps1', '.vbs', '.js', '.jsx', '.ts',
  '.html', '.htm', '.php', '.py', '.rb', '.pl', '.jar', '.dll', '.so',
  '.svg', '.xml', '.msi', '.com', '.scr', '.hta',
])

if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true })

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const subDir = path.join(UPLOAD_DIR, `submission_${req.params.submissionId || 'misc'}`)
    if (!fs.existsSync(subDir)) fs.mkdirSync(subDir, { recursive: true })
    cb(null, subDir)
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now()
    const ext       = path.extname(file.originalname).toLowerCase()
    // Sanitise filename — alphanumeric, dash, underscore, dot only
    const base      = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_\-]/g, '_')
    cb(null, `${timestamp}_${base}${ext}`)
  },
})

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase()

  // Block dangerous extensions
  if (BLOCKED_EXTS.has(ext)) {
    return cb(new Error(`File type not allowed: ${ext}`), false)
  }

  // Both MIME and extension must be in the allowlist
  if (ALLOWED_MIMES.has(file.mimetype) && ALLOWED_EXTS.has(ext)) {
    return cb(null, true)
  }

  cb(new Error(`File type not allowed. Accepted: PDF, Word, Excel, CSV, Images`), false)
}

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_SIZE_MB * 1024 * 1024,
    files: 10,
    fieldSize: 2 * 1024 * 1024,
  },
})

module.exports = upload
