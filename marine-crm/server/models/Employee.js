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
    password: { type: String, default: null },
    location: { type: String, trim: true, default: null },
    position: { type: String, trim: true, default: null },
    joinDate: { type: Date, default: null },
    dateOfBirth: { type: Date, default: null },

    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
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