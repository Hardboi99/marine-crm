const mongoose = require('mongoose');

const applicationSchema = new mongoose.Schema(
  {
    candidateId: { type: mongoose.Schema.Types.ObjectId, ref: 'Candidate', required: true },
    requirementId: { type: mongoose.Schema.Types.ObjectId, ref: 'Requirement', required: true },
    status: {
      type: String,
      enum: ['SHORTLISTED', 'PROPOSED', 'CLIENT_ACCEPTED', 'CLIENT_REJECTED'],
      default: 'SHORTLISTED'
    },
    rejectionReasonId: { type: mongoose.Schema.Types.ObjectId, ref: 'Reason', default: null },
    rejectionNotes: { type: String, default: null },
    createdById: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
  },
  { timestamps: true }
);

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

module.exports = mongoose.model('Application', applicationSchema);
