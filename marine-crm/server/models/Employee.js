const mongoose = require('mongoose');

const employeeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },

    employeeId: {
      type: String,
      trim: true,
      unique: true,
      sparse: true,   // allow null/undefined without uniqueness conflict
      default: null
    },

    phone: {
      type: String,
      trim: true,
      required: true,
    },
    email: { type: String, lowercase: true, trim: true, default: null },
    address: { type: String, trim: true, default: null },
    location: { type: String, trim: true, default: null },
    position: { type: String, trim: true, default: null },
    joinDate: { type: Date, default: null },
    dateOfBirth: { type: Date, default: null },
    gender: {
      type: String,
      enum: ['MALE', 'FEMALE', 'OTHER', null],
      default: null,
    },
    bloodGroup: {
      type: String,
      enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', null],
      default: null,
    },

    // ── Offboarding / Exit ────────────────────────────────────────────────
    status: {
      type: String,
      enum: ['ACTIVE', 'EXITED'],
      default: 'ACTIVE',
    },
    exitDate: { type: Date, default: null },
    exitReason: { type: String, trim: true, default: null },
    exitedById: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    exitedByName: { type: String, trim: true, default: null },

    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    createdById: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    createdByName: { type: String, trim: true, required: true },
  },
  { timestamps: true }
);

// 🔥 Index
employeeSchema.index({ status: 1 });

employeeSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret.__v;
    return ret;
  },
});

employeeSchema.set('toObject', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('Employee', employeeSchema);