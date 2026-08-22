/**
 * server/utils/roles.js
 * ------------------------------------------------------------------
 * Single source of truth for roles, departments, and the legacy-role
 * migration map. Everything that needs to reason about "who can see
 * what" (User model enum, roleCheck middleware, accessScope utility,
 * seed.js, migration script) imports from here instead of hardcoding
 * role strings, so the hierarchy only has to be defined once.
 * ------------------------------------------------------------------
 */

// ─── FINAL ROLE MODEL ──────────────────────────────────────────────
const ROLES = {
  DIRECTOR: 'DIRECTOR',
  COO: 'COO',
  SOURCING_MANAGER: 'SOURCING_MANAGER',
  SOURCING_OFFICER: 'SOURCING_OFFICER',
  DOCUMENTATION_MANAGER: 'DOCUMENTATION_MANAGER',
  DOCUMENTATION_OFFICER: 'DOCUMENTATION_OFFICER',
  BDM: 'BDM',
  ACCOUNTS_OFFICER: 'ACCOUNTS_OFFICER',
  ADMIN_OFFICER: 'ADMIN_OFFICER',
  RECEPTION: 'RECEPTION',
  SOCIAL_MEDIA_OFFICER: 'SOCIAL_MEDIA_OFFICER',
  HR: 'HR',
  ADMIN: 'ADMIN', // technical/system administrator — full access, kept for ops/support
};

const ALL_ROLES = Object.values(ROLES);

// ─── DEPARTMENTS ───────────────────────────────────────────────────
const DEPARTMENTS = {
  EXECUTIVE: 'EXECUTIVE',
  SOURCING: 'SOURCING',
  DOCUMENTATION: 'DOCUMENTATION',
  BUSINESS_DEVELOPMENT: 'BUSINESS_DEVELOPMENT',
  ACCOUNTS: 'ACCOUNTS',
  ADMINISTRATION: 'ADMINISTRATION',
  SOCIAL_MEDIA: 'SOCIAL_MEDIA',
  HR: 'HR',
  SYSTEM: 'SYSTEM',
};

// Default department for a given role — used at user-creation time when
// no explicit department is supplied, and by seed.js.
const ROLE_DEFAULT_DEPARTMENT = {
  [ROLES.DIRECTOR]: DEPARTMENTS.EXECUTIVE,
  [ROLES.COO]: DEPARTMENTS.EXECUTIVE,
  [ROLES.SOURCING_MANAGER]: DEPARTMENTS.SOURCING,
  [ROLES.SOURCING_OFFICER]: DEPARTMENTS.SOURCING,
  [ROLES.DOCUMENTATION_MANAGER]: DEPARTMENTS.DOCUMENTATION,
  [ROLES.DOCUMENTATION_OFFICER]: DEPARTMENTS.DOCUMENTATION,
  [ROLES.BDM]: DEPARTMENTS.BUSINESS_DEVELOPMENT,
  [ROLES.ACCOUNTS_OFFICER]: DEPARTMENTS.ACCOUNTS,
  [ROLES.ADMIN_OFFICER]: DEPARTMENTS.ADMINISTRATION,
  [ROLES.RECEPTION]: DEPARTMENTS.ADMINISTRATION,
  [ROLES.SOCIAL_MEDIA_OFFICER]: DEPARTMENTS.SOCIAL_MEDIA,
  [ROLES.HR]: DEPARTMENTS.HR,
  [ROLES.ADMIN]: DEPARTMENTS.SYSTEM,
};

// Roles considered "manager-level" for their department — i.e. they see
// their whole team's records, not only their own.
const MANAGER_ROLES = new Set([
  ROLES.DIRECTOR,
  ROLES.COO,
  ROLES.SOURCING_MANAGER,
  ROLES.DOCUMENTATION_MANAGER,
]);

// Roles with organisation-wide visibility (no team/department boundary).
const ORG_WIDE_ROLES = new Set([ROLES.DIRECTOR, ROLES.COO, ROLES.ADMIN]);

// Roles that manage a specific department's officers.
const DEPARTMENT_MANAGER_ROLES = {
  [ROLES.SOURCING_MANAGER]: DEPARTMENTS.SOURCING,
  [ROLES.DOCUMENTATION_MANAGER]: DEPARTMENTS.DOCUMENTATION,
};

// ─── LEGACY ROLE MIGRATION MAP ─────────────────────────────────────
// Old roles that may already exist in the database (or be POSTed by an
// out-of-date client) map onto their closest equivalent new role. Used by
// the User model's pre-save normalisation, the roleCheck middleware, and
// scripts/migrateLegacyRoles.js.
const LEGACY_ROLE_MAP = {
  MANAGER: ROLES.SOURCING_MANAGER, // ambiguous legacy role — best-effort default
  MANAGER_SOURCING: ROLES.SOURCING_MANAGER,
  MANAGER_DOCS: ROLES.DOCUMENTATION_MANAGER,
};

const LEGACY_ROLES = Object.keys(LEGACY_ROLE_MAP);

/** Normalises any legacy role string to its current equivalent. Returns the
 * input unchanged if it is already a current role (or unrecognised). */
function normalizeRole(role) {
  if (!role) return role;
  return LEGACY_ROLE_MAP[role] || role;
}

/** Role groups referenced by routes/controllers via requireRole(), so route
 * definitions can say requireRole('MANAGEMENT') instead of listing every
 * concrete role and forgetting one when the hierarchy changes. */
const ROLE_GROUPS = {
  // Organisation-wide, can see/manage everything.
  MANAGEMENT: [ROLES.DIRECTOR, ROLES.COO, ROLES.ADMIN],
  // Anyone who manages a team (department-scoped or org-wide).
  ANY_MANAGER: [ROLES.DIRECTOR, ROLES.COO, ROLES.SOURCING_MANAGER, ROLES.DOCUMENTATION_MANAGER, ROLES.ADMIN],
  SOURCING: [ROLES.SOURCING_MANAGER, ROLES.SOURCING_OFFICER],
  DOCUMENTATION: [ROLES.DOCUMENTATION_MANAGER, ROLES.DOCUMENTATION_OFFICER],
  BDM_TEAM: [ROLES.BDM],
  // Who can see every employee's worksheet AND reply to any of them
  // (Task 2's explicit table: Admin/Founder/COO = all; HR/BDM/Recruitment/
  // Crewing = own only — HR is deliberately NOT included here even though
  // it manages other things elsewhere in the app, since HR replying to a
  // worksheet it isn't allowed to see wouldn't make sense).
  WORKSHEET_ALL_ACCESS: [ROLES.ADMIN, ROLES.DIRECTOR, ROLES.COO],
  // Founder (DIRECTOR) is a monitoring-only role — no attendance
  // check-in/out, and excluded from attendance employee lists.
  ATTENDANCE_EXCLUDED: [ROLES.DIRECTOR],
};

module.exports = {
  ROLES,
  ALL_ROLES,
  DEPARTMENTS,
  ROLE_DEFAULT_DEPARTMENT,
  MANAGER_ROLES,
  ORG_WIDE_ROLES,
  DEPARTMENT_MANAGER_ROLES,
  LEGACY_ROLE_MAP,
  LEGACY_ROLES,
  ROLE_GROUPS,
  normalizeRole,
};