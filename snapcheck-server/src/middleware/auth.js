const jwt     = require('jsonwebtoken')
const prisma  = require('../db/prisma')

async function authenticate(req, res, next) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token provided' })
  }

  const token = header.split(' ')[1]
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET)
    const user    = await prisma.user.findUnique({ where: { id: payload.userId } })

    if (!user || !user.active) {
      return res.status(401).json({ message: 'User not found or inactive' })
    }

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
