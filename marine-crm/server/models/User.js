const mongoose = require('mongoose');
const { ALL_ROLES, LEGACY_ROLES, normalizeRole, ROLE_DEFAULT_DEPARTMENT } = require('../utils/roles');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: {
      type: String,
      // Legacy role strings (MANAGER, MANAGER_DOCS, MANAGER_SOURCING) are kept
      // in the enum ONLY so that documents already in the database that still
      // carry them do not fail validation on unrelated updates/reads. New
      // writes are normalised to a current role by the pre-validate hook
      // below. Run `node scripts/migrateLegacyRoles.js` to update all
      // existing records and stop relying on this compatibility shim.
      enum: [...ALL_ROLES, ...LEGACY_ROLES],
      default: 'BDM',
    },
    phone: { type: String, default: null },
    // Free-form on legacy records; for current roles this mirrors
    // ROLE_DEFAULT_DEPARTMENT unless explicitly overridden (e.g. an officer
    // moved between teams). See utils/roles.js DEPARTMENTS for the canonical
    // values used going forward.
    department: { type: String, default: null },
    // Reporting-hierarchy link: who this user reports to. null for the
    // top of the org (e.g. DIRECTOR). Used by accessScope.js to compute a
    // manager's team recursively — do NOT hardcode names/IDs anywhere else.
    reportingTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    avatarUrl: { type: String, default: null },
    isActive: { type: Boolean, default: true },
    lastLoginAt: { type: Date, default: null },

    // ── Email Verification ────────────────────────────────────────────────────
    // emailVerified is intentionally left undefined for legacy users (migration
    // guard: undefined → treated as verified so existing accounts are not locked out).
    emailVerified: { type: Boolean, default: undefined },
    // Stores SHA-256 hash of the raw token — raw token is only ever sent by email.
    verificationToken: { type: String, default: null },
    verificationTokenExpires: { type: Date, default: null },
    verificationSentAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Normalise legacy role names and backfill a sensible default department on
// every save, without ever throwing on records that predate this migration.
userSchema.pre('validate', function (next) {
  if (this.role) {
    this.role = normalizeRole(this.role);
  }
  if (!this.department && this.role && ROLE_DEFAULT_DEPARTMENT[this.role]) {
    this.department = ROLE_DEFAULT_DEPARTMENT[this.role];
  }
  next();
});

userSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret.__v;
    delete ret.passwordHash;
    return ret;
  },
});

userSchema.set('toObject', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('User', userSchema);