/**
 * Application.js
 * ------------------------------------------------------------------
 * Mongoose schema for the Candidate <-> Requirement proposal pipeline
 * (Match Crew -> Propose -> Client decision). This is NOT the walk-in
 * "Job Call" form — that is JobApplication.model.js. Referenced as
 * `Application` throughout crewingController.js / opsController.js
 * (e.g. proposeCandidate, setApplicationDecision, getApplications).
 * ------------------------------------------------------------------
 */

const mongoose = require('mongoose');

const applicationSchema = new mongoose.Schema(
  {
    requirementId: { type: mongoose.Schema.Types.ObjectId, ref: 'Requirement', required: true },
    candidateId: { type: mongoose.Schema.Types.ObjectId, ref: 'Candidate', required: true },
    status: {
      type: String,
      enum: ['PROPOSED', 'CLIENT_ACCEPTED', 'CLIENT_REJECTED'],
      default: 'PROPOSED',
      index: true,
    },
    rejectionReasonId: { type: mongoose.Schema.Types.ObjectId, ref: 'Reason', default: null },
    rejectionNotes: { type: String, default: null },
    createdById: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

// A candidate must not be proposed twice for the same requirement —
// crewingController.proposeCandidate relies on this unique index and
// specifically catches its E11000 duplicate-key error.
applicationSchema.index({ requirementId: 1, candidateId: 1 }, { unique: true });

applicationSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret.__v;
    return ret;
  },
});

applicationSchema.set('toObject', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.models.Application || mongoose.model('Application', applicationSchema);