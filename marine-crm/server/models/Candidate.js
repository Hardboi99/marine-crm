const mongoose = require('mongoose');
const { CANDIDATE_STATUSES } = require('../utils/workflow');

const candidateSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    rank: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: CANDIDATE_STATUSES,
      default: 'AVAILABLE',
    },
    workflowStage: {
      type: String,
      trim: true,
      default: 'SOURCING',
    },
    experienceYears: {
      type: Number,
      default: 0,
    },
    nationality: {
      type: String,
      trim: true,
      default: null,
    },
    passportNumber: {
      type: String,
      trim: true,
      default: null,
    },
    cdcNumber: {
      type: String,
      trim: true,
      default: null,
    },
    currentVessel: {
      type: String,
      trim: true,
      default: null,
    },
    availableFrom: {
      type: Date,
      default: null,
    },
    expectedSalary: {
      type: Number,
      default: null,
    },
    currency: {
      type: String,
      trim: true,
      default: 'USD',
    },
    notes: {
      type: String,
      trim: true,
      default: null,
    },
    createdById: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    assignedToId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    currentOwnerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    department: {
      type: String,
      trim: true,
      default: 'SOURCING',
    },
  },
  { timestamps: true }
);

candidateSchema.index({ status: 1 });
candidateSchema.index({ rank: 1 });
candidateSchema.index({ createdById: 1 });
candidateSchema.index({ assignedToId: 1 });
candidateSchema.index({ currentOwnerId: 1 });

candidateSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('Candidate', candidateSchema);
