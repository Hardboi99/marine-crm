const mongoose = require('mongoose');

const callSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    callDate: { type: Date, required: true },
    durationMinutes: { type: Number, default: null },
    statusColor: { type: String, enum: ['RED', 'YELLOW', 'GREEN'], required: true },
    notes: { type: String, default: null },
    nextFollowupDate: { type: Date, default: null },
  },
  { timestamps: true }
);

callSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret.__v;
    return ret;
  },
});

callSchema.set('toObject', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('Call', callSchema);
