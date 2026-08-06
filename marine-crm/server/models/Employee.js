const mongoose = require('mongoose');

const employeeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },

    // 🔥 Updated
    employeeId: {
      type: String,
      trim: true,
      unique: true,
      required: true
    },

    phone: {
      type: String,
      trim: true,
      required: true,
      match: [/^\d{10}$/, 'Phone number must be exactly 10 digits']
    },
    email: { type: String, lowercase: true, trim: true, default: null },
    location: { type: String, trim: true, default: null },
    position: { type: String, trim: true, default: null },
    joinDate: { type: Date, default: null },

    createdById: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    createdByName: { type: String, trim: true, required: true },
  },
  { timestamps: true }
);

// 🔥 Index
employeeSchema.index({ employeeId: 1 });

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