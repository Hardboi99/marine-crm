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

    // Expand MANAGER to include MANAGER_DOCS and MANAGER_SOURCING for full backward-compat
    const effectiveRoles = new Set(allowedRoles);
    if (effectiveRoles.has('MANAGER')) {
      effectiveRoles.add('MANAGER_DOCS');
      effectiveRoles.add('MANAGER_SOURCING');
    }

    // Also match legacy 'MANAGER' role if user has it in DB
    const userRole = req.user.role;
    const userMatches = effectiveRoles.has(userRole) ||
      ((userRole === 'MANAGER_DOCS' || userRole === 'MANAGER_SOURCING') && effectiveRoles.has('MANAGER'));

    if (!userMatches) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required role(s): ${allowedRoles.join(', ')}. Your role: ${req.user.role}`,
      });
    }
    next();
  };
};

module.exports = { requireRole };
