/**
 * Middleware factory: restrict access to one or more roles
 * Usage: router.get('/admin-only', authenticate, requireRole('ADMIN'), handler)
 * Usage: router.get('/bdm-or-manager', authenticate, requireRole('BDM', 'MANAGER'), handler)
 */
const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Not authenticated.' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required role(s): ${allowedRoles.join(', ')}. Your role: ${req.user.role}`,
      });
    }
    next();
  };
};

module.exports = { requireRole };
