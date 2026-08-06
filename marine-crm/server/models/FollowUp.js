const mongoose = require('mongoose');

const followUpSchema = new mongoose.Schema(
  {
    sourceType: { type: String, enum: ['APPOINTMENT'], default: 'APPOINTMENT' },
    sourceId: { type: mongoose.Schema.Types.ObjectId, default: null },
    appointmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment', default: null },
    reasonId: { type: mongoose.Schema.Types.ObjectId, ref: 'Reason', default: null },
    status: { type: String, enum: ['PENDING', 'COMPLETED', 'REJECTED'], default: 'PENDING' },
    nextFollowupDate: { type: Date, default: null },
    notes: { type: String, default: null },
  },
  { timestamps: true }
);

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
