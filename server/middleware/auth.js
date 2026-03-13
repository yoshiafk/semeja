const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'semeja-default-secret-change-me-in-production';

/**
 * Middleware to require a valid JWT token
 * Validates 'Bearer <token>' inside the Authorization header
 */
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
}

function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization token' });
  }

  const token = authHeader.split(' ')[1];
  const payload = verifyToken(token);
  if (payload) {
    req.user = payload;
    next();
  } else {
    return res.status(401).json({ error: 'Expired or invalid token' });
  }
}

/**
 * Middleware to strictly require an Admin or Superadmin role
 * Must be used AFTER requireAuth
 */
function requireAdmin(req, res, next) {
  if (!req.user || !['admin', 'superadmin'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Access forbidden: Admins only' });
  }
  next();
}

/**
 * Helper to sign a JWT token for users
 */
function generateToken(user) {
  return jwt.sign(
    { id: user.id, name: user.name, role: user.role },
    JWT_SECRET,
    { expiresIn: '7d' } // Token explicitly expires after 7 days
  );
}

module.exports = {
  requireAuth,
  requireAdmin,
  generateToken,
  verifyToken,
};
