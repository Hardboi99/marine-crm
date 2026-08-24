const mongoose = require('mongoose');

const onboardingSchema = new mongoose.Schema(
  {
    candidateId: { type: mongoose.Schema.Types.ObjectId, ref: 'Candidate', required: true },
    requirementId: { type: mongoose.Schema.Types.ObjectId, ref: 'Requirement', required: true },
    // Denormalized from requirementId.companyId at creation time, same
    // pattern Invoice.js already uses — lets the Onboarding/Operations
    // tab filter and populate client/company info directly without an
    // extra hop through Requirement on every read.
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    contractPrepared: { type: Boolean, default: false },
    contractSigned: { type: Boolean, default: false },
    cdcValidityChecked: { type: Boolean, default: false },
    passportValidityChecked: { type: Boolean, default: false },
    medicalCleared: { type: Boolean, default: false },
    visaProcessed: { type: Boolean, default: false },
    ticketBooked: { type: Boolean, default: false },
    flightDetails: { type: String, default: null },
    vesselName: { type: String, default: null },
    portOfJoining: { type: String, default: null },
    reportingDate: { type: Date, default: null },
    status: {
      type: String,
      enum: ['PENDING', 'COMPLETED', 'CANCELLED'],
      default: 'PENDING'
    },
    updatedById: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
  },
  { timestamps: true }
);

// Prevents duplicate onboarding records for the same candidate/requirement
// pair if the ACCOUNTS → ONBOARDING transition is ever triggered more than
// once (double-submit, retry, race condition) — same pattern Application.js
// already uses for its candidateId+requirementId uniqueness.
onboardingSchema.index({ candidateId: 1, requirementId: 1 }, { unique: true });

onboardingSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret.__v;
    return ret;
  },
});

onboardingSchema.set('toObject', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('Onboarding', onboardingSchema);
