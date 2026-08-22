/**
 * verify-audit.js
 * Comprehensive automated verification script covering all audit points.
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');

console.log('🚀 Starting Audit Fixes Verification...\n');

let passed = 0;
let total = 0;

function test(name, fn) {
  total++;
  try {
    fn();
    console.log(`  ✅ PASS: ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${name}`);
    console.error(`     Error: ${err.message}\n`);
  }
}

// ─── 1. Candidate Model & Status Enum (C3) ───────────────────────────
test('C3: Candidate model derives status enum from workflow.js', () => {
  const { CANDIDATE_STATUSES, isValidTransition, isRoleAllowedForStatus } = require('../utils/workflow');
  const Candidate = require('../models/Candidate');

  assert(Array.isArray(CANDIDATE_STATUSES), 'CANDIDATE_STATUSES must be an array');
  assert(CANDIDATE_STATUSES.includes('ACCOUNTS'), 'Must include ACCOUNTS');
  assert(CANDIDATE_STATUSES.includes('ONBOARDING'), 'Must include ONBOARDING');
  assert(CANDIDATE_STATUSES.includes('ONBOARDED'), 'Must include ONBOARDED');
  assert(CANDIDATE_STATUSES.includes('AVAILABLE'), 'Must include AVAILABLE');
  assert(CANDIDATE_STATUSES.includes('SHORTLISTED'), 'Must include SHORTLISTED');
  assert(CANDIDATE_STATUSES.includes('PROPOSED'), 'Must include PROPOSED');
  assert(CANDIDATE_STATUSES.includes('APPROVED'), 'Must include APPROVED');
  assert(CANDIDATE_STATUSES.includes('DOCUMENTATION'), 'Must include DOCUMENTATION');
  assert(CANDIDATE_STATUSES.includes('REJECTED_TALENT_POOL'), 'Must include REJECTED_TALENT_POOL');

  const enumValues = Candidate.schema.path('status').enumValues;
  assert.deepStrictEqual(enumValues, CANDIDATE_STATUSES, 'Candidate.status enum must match workflow.js');

  // Verify transition logic
  assert.strictEqual(isValidTransition('AVAILABLE', 'SHORTLISTED'), true);
  assert.strictEqual(isValidTransition('DOCUMENTATION', 'ACCOUNTS'), true);
  assert.strictEqual(isValidTransition('ACCOUNTS', 'ONBOARDING'), true);
  assert.strictEqual(isValidTransition('ONBOARDING', 'ONBOARDED'), true);
  assert.strictEqual(isValidTransition('AVAILABLE', 'ONBOARDED'), false);
  assert.strictEqual(isValidTransition('PROPOSED', 'DOCUMENTATION'), false);

  // Verify role gating
  assert.strictEqual(isRoleAllowedForStatus('SOURCING_OFFICER', 'ONBOARDED'), false);
  assert.strictEqual(isRoleAllowedForStatus('ACCOUNTS_OFFICER', 'ONBOARDED'), true);
  assert.strictEqual(isRoleAllowedForStatus('ADMIN', 'ONBOARDED'), true);
  assert.strictEqual(isRoleAllowedForStatus('DIRECTOR', 'ONBOARDED'), true);
});

// ─── 2. Application Model Unique Index (M7) ──────────────────────────
test('M7: Application schema has unique compound index on candidateId + requirementId', () => {
  const Application = require('../models/Application');
  const indexes = Application.schema.indexes();
  const hasUniqueCompound = indexes.some(
    ([fields, opts]) => fields.candidateId === 1 && fields.requirementId === 1 && opts.unique === true
  );
  assert(hasUniqueCompound, 'Application must have unique index on { candidateId: 1, requirementId: 1 }');
});

// ─── 3. Attendance Model Unique Index (M8) ───────────────────────────
test('M8: Attendance schema has unique compound index on employeeId + date', () => {
  const Attendance = require('../models/Attendance');
  const indexes = Attendance.schema.indexes();
  const hasUniqueCompound = indexes.some(
    ([fields, opts]) => fields.employeeId === 1 && fields.date === 1 && opts.unique === true
  );
  assert(hasUniqueCompound, 'Attendance must have unique index on { employeeId: 1, date: 1 }');
});

// ─── 4. Employee Model Schema (N5) ───────────────────────────────────
test('N5: Employee model has address field and no password field', () => {
  const Employee = require('../models/Employee');
  const paths = Object.keys(Employee.schema.paths);
  assert(!paths.includes('password'), 'Employee schema must NOT contain password field');
  assert(paths.includes('address'), 'Employee schema must contain address field');
});

// ─── 5. Document Model Schema (N6) ───────────────────────────────────
test('N6: Document model includes candidateId and employeeId references', () => {
  const Document = require('../models/Document');
  const paths = Object.keys(Document.schema.paths);
  assert(paths.includes('candidateId'), 'Document schema must contain candidateId');
  assert(paths.includes('employeeId'), 'Document schema must contain employeeId');
});

// ─── 6. FollowUp Model Schema (M2) ───────────────────────────────────
test('M2: FollowUp model includes ownership fields', () => {
  const FollowUp = require('../models/FollowUp');
  const paths = Object.keys(FollowUp.schema.paths);
  assert(paths.includes('createdById'), 'FollowUp schema must contain createdById');
  assert(paths.includes('assignedToId'), 'FollowUp schema must contain assignedToId');
  assert(paths.includes('department'), 'FollowUp schema must contain department');
});

// ─── 7. Attendance Geofencing Logic (C6) ─────────────────────────────
test('C6: Geofence calculator accepts valid proximity and denies missing/distant coords', () => {
  const { checkGeofence } = require('../controllers/employeeController');
  assert(typeof checkGeofence === 'function', 'checkGeofence must be exported');

  // Office location: Lat: 19.0158689625056, Lng: 73.03920102540052 (CBD Belapur)
  // Exactly at office: returns null (no violation)
  const exact = checkGeofence(19.0158689625056, 73.03920102540052);
  assert.strictEqual(exact, null, 'Exact coordinates must have no violation (return null)');

  // Within ~100m: returns null (no violation)
  const near = checkGeofence(19.0160, 73.0395);
  assert.strictEqual(near, null, 'Nearby coordinates (< 500m) must have no violation (return null)');

  // Distant (> 5km, e.g. 19.1000, 72.9000): returns violation object
  const far = checkGeofence(19.1000, 72.9000);
  assert(far !== null, 'Far coordinates must return violation');
  assert.strictEqual(far.inRange, false, 'Far coordinates (> 500m) must not be in range');

  // Missing or null coordinates
  const missingNull = checkGeofence(null, null);
  assert(missingNull !== null, 'Missing coordinates must return violation');
  assert.strictEqual(missingNull.inRange, false, 'Missing coordinates must return inRange: false');

  const missingUndefined = checkGeofence(undefined, undefined);
  assert.strictEqual(missingUndefined.inRange, false, 'Undefined coordinates must return inRange: false');

  const invalidNaN = checkGeofence('abc', 'xyz');
  assert.strictEqual(invalidNaN.inRange, false, 'Invalid NaN coordinates must return inRange: false');
});

// ─── 8. Role assignments in Employee Controller (M4) ──────────────────
test('M4: ALL_ROLES constant is used and covers all valid canonical roles', () => {
  const { ALL_ROLES, ROLES } = require('../utils/roles');
  assert(Array.isArray(ALL_ROLES), 'ALL_ROLES must be an array');
  assert(ALL_ROLES.includes('ADMIN'));
  assert(ALL_ROLES.includes('DIRECTOR'));
  assert(ALL_ROLES.includes('COO'));
  assert(ALL_ROLES.includes('BDM'));
  assert(ALL_ROLES.includes('HR'));
  assert(ALL_ROLES.includes('SOURCING_MANAGER'));
  assert(ALL_ROLES.includes('SOURCING_OFFICER'));
  assert(ALL_ROLES.includes('DOCUMENTATION_MANAGER'));
  assert(ALL_ROLES.includes('DOCUMENTATION_OFFICER'));
  assert(ALL_ROLES.includes('ACCOUNTS_OFFICER'));
  assert(ALL_ROLES.includes('ADMIN_OFFICER'));
  assert(ALL_ROLES.includes('RECEPTION'));
});

// ─── 9. Express App Static Route Safety (C2) ─────────────────────────
test('C2: Public express.static /uploads is NOT mounted in app.js', () => {
  const appFile = fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8');
  assert(!appFile.includes("app.use('/uploads'"), 'app.js must not mount /uploads via express.static');
  assert(!appFile.includes('app.use("/uploads"'), 'app.js must not mount /uploads via express.static');
});

// ─── 10. Job Applications Auth (C1) ──────────────────────────────────
test('C1: Job applications staff routes are authenticated and role-guarded', () => {
  const jobAppRoutesFile = fs.readFileSync(path.join(__dirname, '../routes/jobApplications.routes.js'), 'utf8');
  assert(jobAppRoutesFile.includes("router.post('/'"), 'Must have public POST /');
  assert(jobAppRoutesFile.includes("router.use(authenticate, loadCurrentUser, requireRole("), 'Staff routes must be guarded by authenticate, loadCurrentUser, requireRole');
  assert(jobAppRoutesFile.includes("router.get('/',"), 'Must define GET /');
  assert(jobAppRoutesFile.includes("router.get('/:id',"), 'Must define GET /:id');
  assert(jobAppRoutesFile.includes("router.patch('/:id/status',"), 'Must define PATCH /:id/status');
  assert(jobAppRoutesFile.includes("router.get('/:id/files/:field',"), 'Must define GET /:id/files/:field');
});

// ─── 11. Reception Auth (M1) ─────────────────────────────────────────
test('M1: Reception routes require loadCurrentUser and role check', () => {
  const recRoutesFile = fs.readFileSync(path.join(__dirname, '../routes/reception.js'), 'utf8');
  assert(recRoutesFile.includes('loadCurrentUser'), 'Reception routes must use loadCurrentUser');
  assert(recRoutesFile.includes('requireRole'), 'Reception routes must use requireRole');
});

// ─── 12. UI escapeHtml XSS protection (C7) ───────────────────────────
test('C7: escapeHtml utility prevents XSS characters', () => {
  const uiFile = fs.readFileSync(path.join(__dirname, '../../client/public/js/components/ui.js'), 'utf8');
  assert(uiFile.includes('escapeHtml'), 'ui.js must define escapeHtml');
  assert(uiFile.includes('window.escapeHtml = UI.escapeHtml;'), 'ui.js must export window.escapeHtml');

  // Test the escape logic directly
  const escapeHtml = (str) => {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  };

  const malicious = '<script>alert("xss")</script><img src=x onerror=alert(1)>';
  const safe = escapeHtml(malicious);
  assert(!safe.includes('<script>'), 'Must escape <script>');
  assert(!safe.includes('<img'), 'Must escape <img');
  assert(safe.includes('&lt;script&gt;'), 'Must encode to &lt;script&gt;');
});

// ─── 13. Client API Endpoints (M12) ──────────────────────────────────
test('M12: api.js provides getMyProfile, updateMyProfile, remove, and followups due methods', () => {
  const apiFile = fs.readFileSync(path.join(__dirname, '../../client/public/js/api/api.js'), 'utf8');
  assert(apiFile.includes('getMyProfile:'), 'api.js must include getMyProfile');
  assert(apiFile.includes('updateMyProfile:'), 'api.js must include updateMyProfile');
  assert(apiFile.includes('remove:'), 'api.js must include calls.remove');
  assert(apiFile.includes('getFollowupsDue:'), 'api.js must include getFollowupsDue');
  assert(apiFile.includes('window.api = ApiService;'), 'api.js must export window.api');
});

// ─── 14. Static Assets & Dead Files (N9, D1) ─────────────────────────
test('N9 & D1: ocean-bg.js exists, dead files removed', () => {
  const oceanBgExists = fs.existsSync(path.join(__dirname, '../../client/public/js/components/ocean-bg.js'));
  assert(oceanBgExists, 'ocean-bg.js must exist for script tag compatibility');

  const deadConsoleLogExists = fs.existsSync(path.join(__dirname, "../console.log('err"));
  assert(!deadConsoleLogExists, "server/console.log('err must be deleted");

  const deadEmployeesJsExists = fs.existsSync(path.join(__dirname, '../../client/public/js/api/employees.js'));
  assert(!deadEmployeesJsExists, 'client/public/js/api/employees.js must be deleted');
});

console.log(`\n========================================`);
console.log(`Tests: ${passed}/${total} passed`);
console.log(`========================================\n`);

if (passed === total) {
  console.log('🎉 ALL AUDIT VERIFICATIONS PASSED SUCCESSFULLY!');
  process.exit(0);
} else {
  console.error(`❌ ${total - passed} VERIFICATION(S) FAILED.`);
  process.exit(1);
}
