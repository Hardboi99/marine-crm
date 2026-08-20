/**
 * server/utils/workflow.js
 * ------------------------------------------------------------------
 * Controlled state machine for Candidate.status. Prevents an ordinary
 * sourcing officer from directly setting e.g. ONBOARDED, and keeps the
 * transition rules in one place instead of scattered across controllers.
 * ------------------------------------------------------------------
 */

const { ROLES, ORG_WIDE_ROLES } = require('./roles');

// Allowed next-states for each current Candidate.status value.
const CANDIDATE_STATUS_TRANSITIONS = {
  AVAILABLE: ['SHORTLISTED'],
  SHORTLISTED: ['PROPOSED', 'AVAILABLE'],
  PROPOSED: ['APPROVED', 'REJECTED_TALENT_POOL'],
  APPROVED: ['DOCUMENTATION'],
  DOCUMENTATION: ['ACCOUNTS'],
  ACCOUNTS: ['ONBOARDING'],
  ONBOARDING: ['ONBOARDED'],
  ONBOARDED: [],
  REJECTED_TALENT_POOL: ['AVAILABLE', 'SHORTLISTED'],
};

// Which roles are allowed to *set* a candidate to a given target status.
// Anything not listed defaults to "any role that can already write to this
// candidate record" (ownership check still applies on top of this).
const STATUS_ROLE_GATE = {
  DOCUMENTATION: [ROLES.SOURCING_MANAGER, ROLES.SOURCING_OFFICER, ...ORG_WIDE_ROLES],
  ACCOUNTS: [ROLES.DOCUMENTATION_MANAGER, ROLES.DOCUMENTATION_OFFICER, ...ORG_WIDE_ROLES],
  ONBOARDING: [ROLES.ACCOUNTS_OFFICER, ...ORG_WIDE_ROLES],
  // Only Accounts/Ops completing the Onboarding checklist (see
  // opsController.updateOnboarding) — or org-wide roles — may mark a
  // candidate ONBOARDED. Sourcing officers/managers are explicitly
  // excluded per project requirement §22.
  ONBOARDED: [ROLES.ACCOUNTS_OFFICER, ...ORG_WIDE_ROLES],
};

/**
 * isValidTransition(from, to) → boolean. Same-state "transitions" (no-op
 * updates) are always allowed.
 */
function isValidTransition(from, to) {
  if (!to || from === to) return true;
  const allowed = CANDIDATE_STATUS_TRANSITIONS[from] || [];
  return allowed.includes(to);
}

/**
 * isRoleAllowedForStatus(role, to) → boolean. Roles not mentioned in
 * STATUS_ROLE_GATE for a given target status are allowed by default (the
 * gate only exists to explicitly lock down sensitive downstream statuses).
 */
function isRoleAllowedForStatus(role, to) {
  const gate = STATUS_ROLE_GATE[to];
  if (!gate) return true;
  return gate.includes(role);
}

module.exports = {
  CANDIDATE_STATUS_TRANSITIONS,
  isValidTransition,
  isRoleAllowedForStatus,
};