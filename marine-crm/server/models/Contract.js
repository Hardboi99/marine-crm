const mongoose = require('mongoose');

const contractSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    appointmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment', default: null },
    createdById: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true },
    fileUrl: { type: String, default: null },
    status: { type: String, enum: ['DRAFT', 'ACTIVE', 'EXPIRED', 'CANCELLED'], default: 'DRAFT' },
    signedDate: { type: Date, default: null },
    expiryDate: { type: Date, default: null },
    reminderSent: { type: Boolean, default: false },
    notes: { type: String, default: null },
  },
  { timestamps: true }
);

contractSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret.__v;
    return ret;
  },
});

contractSchema.set('toObject', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('Contract', contractSchema);
