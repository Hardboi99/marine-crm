const mongoose = require('mongoose');

const reasonSchema = new mongoose.Schema(
  {
    category: { type: String, required: true, enum: ['APPOINTMENT', 'FOLLOWUP', 'GENERAL'] },
    label: { type: String, required: true, trim: true },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

reasonSchema.index({ category: 1, label: 1 }, { unique: true });

reasonSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret.__v;
    return ret;
  },
});

reasonSchema.set('toObject', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('Reason', reasonSchema);
