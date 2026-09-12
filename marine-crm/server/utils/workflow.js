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
  AVAILABLE: ['SHORTLISTED', 'PROPOSED'],
  SHORTLISTED: ['PROPOSED', 'AVAILABLE'],
  PROPOSED: ['APPROVED', 'REJECTED_TALENT_POOL'],
  APPROVED: ['DOCUMENTATION', 'ONBOARDING'],
  DOCUMENTATION: ['ACCOUNTS', 'ONBOARDING'],
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
  ONBOARDING: [ROLES.ACCOUNTS_OFFICER, ROLES.DOCUMENTATION_MANAGER, ROLES.DOCUMENTATION_OFFICER, ROLES.SOURCING_MANAGER, ROLES.SOURCING_OFFICER, ...ORG_WIDE_ROLES],
  // Only Accounts/Ops completing the Onboarding checklist (see
  // opsController.updateOnboarding) — or org-wide roles — may mark a
  // candidate ONBOARDED.
  ONBOARDED: [ROLES.ACCOUNTS_OFFICER, ROLES.DOCUMENTATION_MANAGER, ...ORG_WIDE_ROLES],
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

const CANDIDATE_STATUSES = Object.keys(CANDIDATE_STATUS_TRANSITIONS);

// ─── DOCUMENTATION STAGE (Part 3) ───────────────────────────────────
// Document.category values that must each have at least one APPROVED
// Document record before a candidate's documentation is considered
// Complete. Kept here (next to the state machine) rather than in
// documents.controller.js / crewingController.js so both can import
// the same single source of truth instead of duplicating the list.
const REQUIRED_CANDIDATE_DOCUMENT_TYPES = ['PASSPORT', 'CDC', 'COC', 'MEDICAL_CERTIFICATE', 'STCW'];

/**
 * computeDocumentationStatus(documents) → { overallStatus, requiredTypes, byType }
 *
 * documents: array of Document records (already filtered to one
 * candidateId) with at least { category, status } on each.
 *
 * overallStatus:
 *   'PENDING'     — none of the required types have any document yet.
 *   'IN_PROGRESS' — some required types uploaded/reviewed, but not
 *                   every required type has an APPROVED document yet.
 *   'COMPLETE'    — every required type has at least one APPROVED
 *                   document.
 *
 * byType[type] → 'MISSING' | 'PENDING' | 'APPROVED' | 'REJECTED'
 * (the most recent document of that type wins if there are several —
 * e.g. a REJECTED doc replaced by a new PENDING upload shows PENDING).
 */
function computeDocumentationStatus(documents) {
  const byType = {};
  for (const type of REQUIRED_CANDIDATE_DOCUMENT_TYPES) {
    byType[type] = 'MISSING';
  }

  // documents is expected sorted newest-first by the caller (createdAt
  // desc); take the first (most recent) record seen per type.
  for (const doc of documents || []) {
    const type = doc.category;
    if (!REQUIRED_CANDIDATE_DOCUMENT_TYPES.includes(type)) continue;
    if (byType[type] !== 'MISSING') continue; // already have the most recent one
    byType[type] = doc.status || 'PENDING';
  }

  const values = Object.values(byType);
  const noneStarted = values.every((v) => v === 'MISSING');
  const allApproved = values.every((v) => v === 'APPROVED');

  let overallStatus;
  if (noneStarted) overallStatus = 'PENDING';
  else if (allApproved) overallStatus = 'COMPLETE';
  else overallStatus = 'IN_PROGRESS';

  return { overallStatus, requiredTypes: REQUIRED_CANDIDATE_DOCUMENT_TYPES, byType };
}

module.exports = {
  CANDIDATE_STATUSES,
  CANDIDATE_STATUS_TRANSITIONS,
  STATUS_ROLE_GATE,
  isValidTransition,
  isRoleAllowedForStatus,
  REQUIRED_CANDIDATE_DOCUMENT_TYPES,
  computeDocumentationStatus,
};