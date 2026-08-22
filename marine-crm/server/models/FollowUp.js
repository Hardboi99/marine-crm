const mongoose = require('mongoose');

const followUpSchema = new mongoose.Schema(
  {
    sourceType: { type: String, enum: ['APPOINTMENT'], default: 'APPOINTMENT' },
    sourceId: { type: mongoose.Schema.Types.ObjectId, default: null },
    appointmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment', default: null },
    reasonId: { type: mongoose.Schema.Types.ObjectId, ref: 'Reason', default: null },
    nextFollowupDate: { type: Date, default: null },
    notes: { type: String, default: null },
    createdById: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    assignedToId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    department: { type: String, trim: true, default: 'COMMERCIAL' },
  },
  { timestamps: true }
);

followUpSchema.index({ createdById: 1 });
followUpSchema.index({ assignedToId: 1 });
followUpSchema.index({ status: 1 });

followUpSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret.__v;
    return ret;
  },
});

followUpSchema.set('toObject', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('FollowUp', followUpSchema);
