const jwt     = require('jsonwebtoken')
const prisma  = require('../db/prisma')
const { isBlacklisted } = require('../utils/tokenBlacklist')

async function authenticate(req, res, next) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token provided' })
  }

  const token = header.split(' ')[1]
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET)

    // SC-001: reject tokens that have been explicitly revoked (logout / password change)
    if (isBlacklisted(payload.jti)) {
      return res.status(401).json({ message: 'Token has been revoked. Please log in again.' })
    }

    const user = await prisma.user.findUnique({ where: { id: payload.userId } })

    if (!user || !user.active) {
      return res.status(401).json({ message: 'User not found or inactive' })
    }

    // SC-003: reject tokens issued before a password change (tokenVersion mismatch)
    if (payload.tv !== undefined && payload.tv !== user.tokenVersion) {
      return res.status(401).json({ message: 'Session invalidated. Please log in again.' })
    }

    // Expose the raw payload so routes can read jti/exp for blacklisting
    req.tokenPayload = payload
    req.user = user
    next()
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token' })
  }
}

// Role guard — use after authenticate
function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user?.role)) {
      return res.status(403).json({ message: 'Insufficient permissions' })
    }
    next()
  }
}

module.exports = { authenticate, requireRole }
