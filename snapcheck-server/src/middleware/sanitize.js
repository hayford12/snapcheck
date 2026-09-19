const xss = require('xss')

// Recursively sanitise all string values in an object
function sanitizeValue(val) {
  if (typeof val === 'string') return xss(val.trim())
  if (Array.isArray(val))      return val.map(sanitizeValue)
  if (val && typeof val === 'object') {
    const clean = {}
    for (const [k, v] of Object.entries(val)) {
      clean[k] = sanitizeValue(v)
    }
    return clean
  }
  return val
}

function sanitizeInput(req, res, next) {
  if (req.body)  req.body  = sanitizeValue(req.body)
  if (req.query) req.query = sanitizeValue(req.query)
  // Don't sanitize params — they are URL-encoded and handled by Express
  next()
}

module.exports = sanitizeInput
