const mongoose = require('mongoose');

const docIntakeSchema = new mongoose.Schema(
  {
    candidateId: { type: mongoose.Schema.Types.ObjectId, ref: 'Candidate', default: null },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', default: null },
    seafarerName: { type: String, required: true, trim: true },
    documentType: {
      type: String,
      enum: ['PASSPORT', 'CDC', 'COC', 'OTHER'],
      default: 'PASSPORT'
    },
    documentNumber: { type: String, trim: true, default: '' },
    collectedDate: { type: Date, default: Date.now },
    custodyLocation: { type: String, trim: true, default: '' },
    status: {
      type: String,
      enum: ['WITH_AGENCY', 'RETURNED_TO_SEAFARER', 'SENT_TO_VESSEL_OWNER'],
      default: 'WITH_AGENCY'
    },
    remarks: { type: String, trim: true, default: '' },
    createdById: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
  },
  { timestamps: true }
);

docIntakeSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret.__v;
    return ret;
  }
});

docIntakeSchema.set('toObject', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('DocIntake', docIntakeSchema);
