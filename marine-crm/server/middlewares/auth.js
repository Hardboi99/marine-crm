const { verifyToken } = require('../config/jwt');
const { User } = require('../models');

/**
 * Middleware: verify JWT from Authorization header
 * Attaches decoded user payload to req.user
 */
const authenticate = (req, res, next) => {
  let token = null;
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.query && req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({ success: false, message: 'Authentication required. No token provided.' });
  }
  try {
    const decoded = verifyToken(token);
    req.user = decoded; // { id, email, role, name, iat, exp }
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Session expired. Please log in again.' });
    }
    return res.status(401).json({ success: false, message: 'Invalid token.' });
  }
};

/**
 * Middleware: fetch the CURRENT User document from MongoDB and attach it
 * (as a Mongoose document) to req.currentUser.
 *
 * Security rule (see project brief §37): department/reportingTo/role used
 * for authorization decisions must never be trusted from the JWT alone —
 * the JWT can be stale (a user's manager/department can change after the
 * token was issued, and the token is valid for hours). Any route that
 * calls getDataScope()/canAccessRecord() from utils/accessScope.js MUST
 * run this middleware (after `authenticate`) first.
 *
 * req.user   → raw JWT payload (id, email, role, name) — fine for logging.
 * req.currentUser → fresh DB record — use this for all access decisions.
 */
const loadCurrentUser = async (req, res, next) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ success: false, message: 'Not authenticated.' });
    }
    const user = await User.findById(req.user.id);
    if (!user || !user.isActive) {
      return res.status(401).json({ success: false, message: 'Account not found or inactive.' });
    }
    req.currentUser = user;
    // Keep req.user.role in sync with the DB in case it changed (e.g. a
    // legacy role got normalised, or an admin changed the user's role)
    // since the JWT was issued.
    req.user.role = user.role;
    req.user.department = user.department;
    req.user.reportingTo = user.reportingTo;
    next();
  } catch (err) {
    next(err);
  }
};

module.exports = { authenticate, loadCurrentUser };