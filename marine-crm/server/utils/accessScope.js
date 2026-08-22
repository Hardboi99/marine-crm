/**
 * server/utils/accessScope.js
 * ------------------------------------------------------------------
 * Reusable, backend-only authorization layer implementing:
 *   Role → Department → Reporting Hierarchy → Data Ownership
 *
 * Two entry points:
 *   1. getDataScope(user, resourceType)   → a Mongo filter object to
 *      AND into any `.find()` query (list endpoints).
 *   2. canAccessRecord(user, record, resourceType, action) → boolean,
 *      used before allowing a specific PUT/PATCH/DELETE.
 *
 * All filtering happens here, in MongoDB query terms — never by
 * fetching everything and filtering in JS/frontend.
 * ------------------------------------------------------------------
 */

const mongoose = require('mongoose');
const {
  ROLES,
  DEPARTMENTS,
  ORG_WIDE_ROLES,
  MANAGER_ROLES,
} = require('./roles');

// Roles that, in addition to the org-wide set, should see the full
// crewing pipeline (candidates/requirements/applications) for backward
// compatibility with the pre-existing HR workflow described in the
// project brief ("HR can remain as an existing operational role").
const CREWING_BROAD_ROLES = new Set([...ORG_WIDE_ROLES, ROLES.HR]);

/**
 * Recursively resolves every user who (directly or indirectly) reports to
 * `managerId` by walking the `reportingTo` chain. Returns string ids,
 * including managerId itself. Depth-bounded so a bad reportingTo cycle in
 * the data can never cause an infinite loop.
 */
async function getTeamUserIds(managerId) {
  const User = mongoose.model('User');
  const rootId = managerId.toString();
  const allIds = new Set([rootId]);
  let frontier = [managerId];

  for (let depth = 0; depth < 10 && frontier.length > 0; depth++) {
    const children = await User.find({ reportingTo: { $in: frontier } }).select('_id');
    const newIds = [];
    for (const c of children) {
      const idStr = c._id.toString();
      if (!allIds.has(idStr)) {
        allIds.add(idStr);
        newIds.push(c._id);
      }
    }
    frontier = newIds;
  }
  return Array.from(allIds);
}

/**
 * Resolves the visibility level for a user:
 *  - 'ALL'  → organisation-wide, no restriction (DIRECTOR / COO / ADMIN)
 *  - 'TEAM' → this user + everyone (recursively) reporting to them
 *  - 'SELF' → only their own records
 * Returns { level, userIds } where userIds is null for 'ALL'.
 */
async function resolveScope(user) {
  if (!user) return { level: 'SELF', userIds: [] };
  const role = user.role;
  const id = (user.id || user._id || '').toString();

  if (ORG_WIDE_ROLES.has(role)) {
    return { level: 'ALL', userIds: null };
  }
  if (MANAGER_ROLES.has(role)) {
    const userIds = await getTeamUserIds(user._id || user.id);
    return { level: 'TEAM', userIds };
  }
  return { level: 'SELF', userIds: [id] };
}

/**
 * Builds the "owned by one of these users" $or clause for a set of
 * ownership fields, given a resolved scope. Returns null for 'ALL' scope
 * (meaning: no restriction needed).
 */
function ownershipClause(fields, scope) {
  if (scope.level === 'ALL') return null;
  const ids = scope.userIds.map((id) => new mongoose.Types.ObjectId(id));
  return { $or: fields.map((f) => ({ [f]: { $in: ids } })) };
}

// ─── CANDIDATES ─────────────────────────────────────────────────────
async function candidateScopeQuery(user) {
  const role = user.role;

  if (CREWING_BROAD_ROLES.has(role)) return {}; // ALL

  if (role === ROLES.SOURCING_MANAGER) {
    const scope = await resolveScope(user);
    return ownershipClause(['createdById', 'assignedToId', 'teamManagerId', 'currentOwnerId'], scope);
  }

  if (role === ROLES.SOURCING_OFFICER) {
    const scope = await resolveScope(user); // SELF
    return ownershipClause(['createdById', 'assignedToId', 'currentOwnerId'], scope);
  }

  if (role === ROLES.DOCUMENTATION_MANAGER) {
    const scope = await resolveScope(user);
    return {
      currentDepartment: DEPARTMENTS.DOCUMENTATION,
      $or: [{ currentOwnerId: { $in: scope.userIds.map((i) => new mongoose.Types.ObjectId(i)) } }, { currentOwnerId: null }],
    };
  }

  if (role === ROLES.DOCUMENTATION_OFFICER) {
    return { currentDepartment: DEPARTMENTS.DOCUMENTATION, currentOwnerId: new mongoose.Types.ObjectId(user.id || user._id) };
  }

  if (role === ROLES.ACCOUNTS_OFFICER) {
    return { currentDepartment: DEPARTMENTS.ACCOUNTS };
  }

  // BDM / ADMIN_OFFICER / SOCIAL_MEDIA_OFFICER / others: no legitimate
  // reason to browse the seafarer database — restrict to records they
  // personally created (should normally be none).
  return { createdById: new mongoose.Types.ObjectId(user.id || user._id) };
}

// ─── REQUIREMENTS ───────────────────────────────────────────────────
async function requirementScopeQuery(user) {
  const role = user.role;
  if (CREWING_BROAD_ROLES.has(role)) return {};

  if (role === ROLES.SOURCING_MANAGER) {
    const scope = await resolveScope(user);
    return ownershipClause(['createdById', 'assignedToId', 'managerId'], scope);
  }
  if (role === ROLES.SOURCING_OFFICER) {
    const scope = await resolveScope(user);
    return ownershipClause(['createdById', 'assignedToId'], scope);
  }
  if ([ROLES.DOCUMENTATION_MANAGER, ROLES.DOCUMENTATION_OFFICER, ROLES.ACCOUNTS_OFFICER, ROLES.BDM].includes(role)) {
    // Downstream departments only need to read requirements to see context
    // for the candidates already in their queue — safe to allow read-only
    // visibility of all open requirements rather than duplicating the
    // candidate-scope join here.
    return {};
  }
  return { createdById: new mongoose.Types.ObjectId(user.id || user._id) };
}

// ─── APPLICATIONS (proposal pipeline) ───────────────────────────────
async function applicationScopeQuery(user) {
  const role = user.role;
  if (CREWING_BROAD_ROLES.has(role)) return {};
  if (role === ROLES.SOURCING_MANAGER) {
    const scope = await resolveScope(user);
    return ownershipClause(['createdById'], scope);
  }
  if (role === ROLES.SOURCING_OFFICER) {
    const scope = await resolveScope(user);
    return ownershipClause(['createdById'], scope);
  }
  // Documentation/Accounts need to see applications that already reached
  // CLIENT_ACCEPTED (their trigger to start work).
  if ([ROLES.DOCUMENTATION_MANAGER, ROLES.DOCUMENTATION_OFFICER, ROLES.ACCOUNTS_OFFICER].includes(role)) {
    return { status: 'CLIENT_ACCEPTED' };
  }
  return { createdById: new mongoose.Types.ObjectId(user.id || user._id) };
}

// ─── BDM WORKFLOW (Company / Call / Appointment / Contract) ─────────
// Ownership field differs slightly per model: Call uses `userId`,
// Company/Appointment/Contract use `createdById`.
async function bdmScopeQuery(user, ownerField) {
  const role = user.role;
  if (ORG_WIDE_ROLES.has(role)) return {};

  if (role === ROLES.BDM) {
    // BDM is an individual-contributor role in the final hierarchy (no
    // dedicated BDM manager role) — officers see their own pipeline.
    // If/when a BDM_MANAGER role is introduced, resolveScope() already
    // supports team-based visibility with no further changes here.
    const scope = await resolveScope(user);
    return ownershipClause([ownerField], scope);
  }

  // Other departments (Accounts/Admin/Sourcing/etc.) have no business
  // reason to browse BDM's commercial pipeline.
  return ownershipClause([ownerField], { level: 'SELF', userIds: [(user.id || user._id).toString()] });
}

// ─── ONBOARDING (post Documentation→Accounts→Onboarding handoff) ────
// Onboarding/Invoice records don't carry their own owner field — they
// hang off a candidateId. Scope them by first resolving which candidates
// this user may see in the ONBOARDING/ACCOUNTS stage, via a real Mongo
// query (never by loading everything and filtering in JS).
async function onboardingScopeQuery(user) {
  const role = user.role;
  if (ORG_WIDE_ROLES.has(role) || role === ROLES.HR) return {};

  if (role === ROLES.ACCOUNTS_OFFICER) {
    const Candidate = mongoose.model('Candidate');
    const ids = await Candidate.find({ currentDepartment: { $in: [DEPARTMENTS.ACCOUNTS, DEPARTMENTS.ONBOARDING] } }).distinct('_id');
    return { candidateId: { $in: ids } };
  }

  // Sourcing/Documentation/BDM/Admin have no legitimate reason to see
  // onboarding checklists — §24/§25: keep financial/logistics detail
  // scoped to Accounts + org-wide roles only.
  return { candidateId: { $in: [] } }; // matches nothing
}

// ─── INVOICES (financial — Accounts + org-wide only, never HR/Sourcing) ─
async function invoiceScopeQuery(user) {
  const role = user.role;
  if (ORG_WIDE_ROLES.has(role)) return {};
  if (role === ROLES.ACCOUNTS_OFFICER) return {}; // Accounts sees the full invoice ledger
  return { candidateId: { $in: [] } }; // matches nothing — §14/§24: no unnecessary financial exposure
}

/**
 * Main entry point: getDataScope(user, resourceType) → Mongo filter object.
 * Merge the result into the controller's existing query with
 * `{ ...existingFilters, ...scopeFilter }` (or use $and if both use `$or`).
 */
async function getDataScope(user, resourceType) {
  switch (resourceType) {
    case 'CANDIDATE':
      return candidateScopeQuery(user);
    case 'REQUIREMENT':
      return requirementScopeQuery(user);
    case 'APPLICATION':
      return applicationScopeQuery(user);
    case 'COMPANY':
    case 'APPOINTMENT':
    case 'CONTRACT':
      return bdmScopeQuery(user, 'createdById');
    case 'FOLLOWUP':
      return bdmScopeQuery(user, 'createdById');
    case 'CALL':
      return bdmScopeQuery(user, 'userId');
    case 'ONBOARDING':
      return onboardingScopeQuery(user);
    case 'INVOICE':
      return invoiceScopeQuery(user);
    default:
      // Unknown resource types are not scoped here — caller should fall
      // back to role-based route gating (requireRole) for anything not
      // yet wired into accessScope.
      return {};
  }
}

/**
 * canAccessRecord(user, record, resourceType) → boolean.
 * Used to guard PUT/PATCH/DELETE on a single already-fetched record so a
 * user can't bypass list-level scoping by guessing/knowing a MongoDB _id.
 */
async function canAccessRecord(user, record, resourceType) {
  if (!user || !record) return false;
  const role = user.role;
  const uid = (user.id || user._id || '').toString();

  if (ORG_WIDE_ROLES.has(role)) return true;
  if (resourceType === 'CANDIDATE' && CREWING_BROAD_ROLES.has(role)) return true;
  if (resourceType === 'REQUIREMENT' && CREWING_BROAD_ROLES.has(role)) return true;
  if (resourceType === 'APPLICATION' && CREWING_BROAD_ROLES.has(role)) return true;

  const idsMatch = (fields, scopeIds) => {
    const scopeSet = new Set(scopeIds);
    return fields.some((f) => {
      const val = record[f];
      if (!val) return false;
      return scopeSet.has(val.toString());
    });
  };

  switch (resourceType) {
    case 'CANDIDATE': {
      if (role === ROLES.SOURCING_MANAGER) {
        const scope = await resolveScope(user);
        return idsMatch(['createdById', 'assignedToId', 'teamManagerId', 'currentOwnerId'], scope.userIds);
      }
      if (role === ROLES.SOURCING_OFFICER) {
        return idsMatch(['createdById', 'assignedToId', 'currentOwnerId'], [uid]);
      }
      if (role === ROLES.DOCUMENTATION_MANAGER) {
        if (record.currentDepartment !== DEPARTMENTS.DOCUMENTATION) return false;
        const scope = await resolveScope(user);
        return !record.currentOwnerId || idsMatch(['currentOwnerId'], scope.userIds);
      }
      if (role === ROLES.DOCUMENTATION_OFFICER) {
        return record.currentDepartment === DEPARTMENTS.DOCUMENTATION && idsMatch(['currentOwnerId'], [uid]);
      }
      if (role === ROLES.ACCOUNTS_OFFICER) {
        return record.currentDepartment === DEPARTMENTS.ACCOUNTS;
      }
      return idsMatch(['createdById'], [uid]);
    }
    case 'REQUIREMENT': {
      if (role === ROLES.SOURCING_MANAGER) {
        const scope = await resolveScope(user);
        return idsMatch(['createdById', 'assignedToId', 'managerId'], scope.userIds);
      }
      if (role === ROLES.SOURCING_OFFICER) {
        return idsMatch(['createdById', 'assignedToId'], [uid]);
      }
      return idsMatch(['createdById'], [uid]);
    }
    case 'APPLICATION': {
      if (role === ROLES.SOURCING_MANAGER) {
        const scope = await resolveScope(user);
        return idsMatch(['createdById'], scope.userIds);
      }
      return idsMatch(['createdById'], [uid]);
    }
    case 'COMPANY':
    case 'APPOINTMENT':
    case 'CONTRACT':
    case 'FOLLOWUP': {
      if (role === ROLES.BDM) {
        const scope = await resolveScope(user);
        return idsMatch(['createdById', 'assignedToId'], scope.userIds);
      }
      return idsMatch(['createdById', 'assignedToId'], [uid]);
    }
    case 'CALL': {
      if (role === ROLES.BDM) {
        const scope = await resolveScope(user);
        return idsMatch(['userId'], scope.userIds);
      }
      return idsMatch(['userId'], [uid]);
    }
    case 'ONBOARDING': {
      if (role !== ROLES.ACCOUNTS_OFFICER) return false;
      const Candidate = mongoose.model('Candidate');
      const candId = record.candidateId?._id || record.candidateId;
      if (!candId) return false;
      const candidate = await Candidate.findById(candId).select('currentDepartment');
      return !!candidate && [DEPARTMENTS.ACCOUNTS, DEPARTMENTS.ONBOARDING].includes(candidate.currentDepartment);
    }
    case 'INVOICE': {
      return role === ROLES.ACCOUNTS_OFFICER;
    }
    default:
      return true; // resource not yet wired into ownership checks
  }
}

module.exports = {
  getTeamUserIds,
  resolveScope,
  getDataScope,
  canAccessRecord,
};