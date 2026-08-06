const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    createdById: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    scheduledAt: { type: Date, required: true },
    meetingNotes: { type: String, default: null },
    outcome: { type: String, enum: ['YES', 'NO', 'PENDING'], default: null },
    reasonId: { type: mongoose.Schema.Types.ObjectId, ref: 'Reason', default: null },
    reminderAt: { type: Date, default: null },
    decidedById: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    decidedAt: { type: Date, default: null },
    bookedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

appointmentSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret.__v;
    return ret;
  },
});

appointmentSchema.set('toObject', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('Appointment', appointmentSchema);
