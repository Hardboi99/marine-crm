const { ROLE_GROUPS, LEGACY_ROLE_MAP, normalizeRole } = require('../utils/roles');

/**
 * Middleware factory: restrict access to one or more roles.
 *
 * Accepts:
 *  - concrete role names, e.g. requireRole('ADMIN', 'SOURCING_MANAGER')
 *  - role GROUP names from utils/roles.js ROLE_GROUPS, e.g. requireRole('MANAGEMENT')
 *  - the legacy 'MANAGER' name, which is expanded to every role that used
 *    to collapse into it (SOURCING_MANAGER, DOCUMENTATION_MANAGER, and the
 *    raw legacy DB values) so old route definitions keep working during
 *    the migration window.
 *
 * Usage: router.get('/admin-only', authenticate, requireRole('ADMIN'), handler)
 */
const requireRole = (...allowedRoles) => {
  // Expand role groups and the legacy 'MANAGER' shorthand once, at
  // middleware-creation time.
  const effectiveRoles = new Set();
  for (const r of allowedRoles) {
    if (ROLE_GROUPS[r]) {
      ROLE_GROUPS[r].forEach((role) => effectiveRoles.add(role));
      continue;
    }
    effectiveRoles.add(r);
    if (r === 'MANAGER') {
      effectiveRoles.add('SOURCING_MANAGER');
      effectiveRoles.add('DOCUMENTATION_MANAGER');
      // Also accept the raw legacy DB value in case normalization hasn't
      // run yet on this particular user record.
      effectiveRoles.add('MANAGER_DOCS');
      effectiveRoles.add('MANAGER_SOURCING');
    }
    // If a legacy role name is explicitly allowed, also allow its current
    // equivalent (and vice versa) so route definitions don't need to be
    // aware of migration state.
    if (LEGACY_ROLE_MAP[r]) {
      effectiveRoles.add(LEGACY_ROLE_MAP[r]);
    }
  }

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Not authenticated.' });
    }

    const userRole = normalizeRole(req.user.role);

    if (!effectiveRoles.has(userRole) && !effectiveRoles.has(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required role(s): ${allowedRoles.join(', ')}. Your role: ${req.user.role}`,
      });
    }
    next();
  };
};

module.exports = { requireRole };