const { User, Employee } = require('../models');

// Only Founder/Director and (system) Admin may open another employee's
// dashboard in read-only View Mode from the Org Chart. Kept in one place
// so this allow-list can never drift between the middleware below and the
// routes that gate the org-chart/start-view endpoints.
const VIEW_MODE_ROLES = ['ADMIN', 'DIRECTOR'];

/**
 * GET-only "view as" impersonation for the Org Chart → View Mode feature.
 *
 * Design notes (see project brief — Org Chart Direct Dashboard Access):
 *  - Reuses the EXISTING JWT session. No new token is minted, no password
 *    is touched or read, and nothing is written to the User/Employee
 *    records — this is not a real login.
 *  - Only triggers when the request carries ?viewAs=<employeeId> AND is a
 *    GET. For that one request, req.user / req.currentUser are swapped to
 *    the viewed employee's identity, so every EXISTING read controller
 *    (dashboard, attendance, worksheets, tasks, profile, birthdays, ...)
 *    renders exactly what that employee would see when they log in
 *    themselves — without duplicating a single line of authorization
 *    logic. The swap only ever lives on the `req` object for the
 *    duration of this one request; it is never persisted anywhere.
 *  - Write requests (POST/PUT/PATCH/DELETE) NEVER honor ?viewAs. View
 *    Mode is strictly read-only, so any mutating call made while
 *    "viewing" someone always executes as the real logged-in user, under
 *    their own real role/permissions (requireRole etc. downstream is
 *    completely unaffected for writes).
 *  - Only ADMIN/DIRECTOR (Founder) may use this at all. Anyone else
 *    passing ?viewAs= — including on a GET — gets a 403 and no employee
 *    data is touched or exposed.
 */
const resolveViewMode = async (req, res, next) => {
  try {
    const viewAsEmployeeId = (req.query.viewAs || '').toString().trim();
    if (!viewAsEmployeeId) return next();

    if (req.method !== 'GET') {
      return res.status(403).json({
        success: false,
        message: 'View Mode is read-only. This action cannot be performed while viewing another employee.',
      });
    }

    // Prefer the fresh DB role (req.currentUser, set by loadCurrentUser)
    // over the JWT payload — same staleness rule the rest of the app
    // follows for authorization decisions (see middlewares/auth.js).
    const actorRole = (req.currentUser && req.currentUser.role) || (req.user && req.user.role);
    if (!VIEW_MODE_ROLES.includes(actorRole)) {
      return res.status(403).json({
        success: false,
        message: 'Only Founder/Director or Admin can use View Mode.',
      });
    }

    const employee = await Employee.findById(viewAsEmployeeId).catch(() => null);
    if (!employee || employee.status === 'EXITED') {
      return res.status(404).json({ success: false, message: 'Employee not found.' });
    }
    if (!employee.userId) {
      return res.status(404).json({ success: false, message: 'This employee has no login account to view.' });
    }

    const targetUser = await User.findById(employee.userId);
    if (!targetUser || !targetUser.isActive) {
      return res.status(404).json({ success: false, message: 'Employee account not found or inactive.' });
    }

    req.viewMode = {
      active: true,
      actor: { id: req.user.id, name: req.user.name, role: actorRole },
      employee: {
        id: employee._id.toString(),
        employeeId: employee.employeeId,
        name: employee.name,
        position: employee.position,
        department: targetUser.department,
        role: targetUser.role,
      },
    };

    // Impersonate identity for THIS request only. No token is issued or
    // stored anywhere — the real JWT/session on req stays exactly as it
    // was; we're only overwriting the local request-scoped references
    // that downstream controllers read from.
    req.user = {
      id: targetUser._id.toString(),
      email: targetUser.email,
      role: targetUser.role,
      name: targetUser.name,
    };
    req.currentUser = targetUser;

    next();
  } catch (err) {
    next(err);
  }
};

module.exports = { resolveViewMode, VIEW_MODE_ROLES };