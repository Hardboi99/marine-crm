const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: {
      type: String,
      enum: ['ADMIN', 'BDM', 'MANAGER_DOCS', 'MANAGER_SOURCING', 'HR'],
      default: 'BDM',
    },
    phone: { type: String, default: null },
    department: { type: String, default: null },
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
