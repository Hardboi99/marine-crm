/**
 * server/scripts/migrateLegacyRoles.js
 * ------------------------------------------------------------------
 * §35 — Migration / backward compatibility.
 *
 * Existing User documents may still carry legacy role values:
 *   MANAGER, MANAGER_SOURCING, MANAGER_DOCS
 * These are mapped onto their current equivalents (see utils/roles.js
 * LEGACY_ROLE_MAP) without ever deleting or corrupting a record. Also
 * backfills `department` for any user missing it, based on their
 * (now-normalised) role.
 *
 * Safe to re-run — it's a no-op once nothing legacy is left.
 *
 * Usage:
 *   node server/scripts/migrateLegacyRoles.js
 * ------------------------------------------------------------------
 */

require('dotenv').config();
const connectDB = require('../config/db');
const { User } = require('../models');
const { LEGACY_ROLE_MAP, ROLE_DEFAULT_DEPARTMENT } = require('../utils/roles');

async function main() {
  await connectDB();

  let migratedRoles = 0;
  let backfilledDepartments = 0;

  for (const [legacyRole, newRole] of Object.entries(LEGACY_ROLE_MAP)) {
    const affected = await User.find({ role: legacyRole });
    for (const user of affected) {
      console.log(`Migrating ${user.email}: ${legacyRole} → ${newRole}`);
      user.role = newRole; // pre-validate hook will also backfill department
      await user.save();
      migratedRoles++;
    }
  }

  // Backfill department for anyone still missing it (including users who
  // were already on a current role but never had department set).
  const missingDept = await User.find({ $or: [{ department: null }, { department: { $exists: false } }] });
  for (const user of missingDept) {
    const dept = ROLE_DEFAULT_DEPARTMENT[user.role];
    if (dept) {
      user.department = dept;
      await user.save();
      backfilledDepartments++;
    }
  }

  console.log(`\n✅ Migration complete. Roles migrated: ${migratedRoles}. Departments backfilled: ${backfilledDepartments}.`);
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});