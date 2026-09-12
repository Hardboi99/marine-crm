const mongoose = require('mongoose');
const { CANDIDATE_STATUSES } = require('../utils/workflow');
const { getNextSequence } = require('./Counter.model');

const SEAFARER_ID_COUNTER = 'seafarerId';

async function generateSeafarerId() {
  const next = await getNextSequence(SEAFARER_ID_COUNTER);
  return String(next).padStart(5, '0');
}

const candidateSchema = new mongoose.Schema(
  {
    seafarerId: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
      trim: true,
    },
    applicationId: {
      type: String,
      trim: true,
      default: null,
    },
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
    vesselType: {
      type: String,
      trim: true,
      default: null,
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
    passportExpiryDate: {
      type: Date,
      default: null,
    },
    cocNumber: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
    },
    cdcNumber: {
      type: String,
      trim: true,
      default: null,
    },
    cdcExpiryDate: {
      type: Date,
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
    onboardingDateTime: {
      type: Date,
      default: null,
    },
    signOffDateTime: {
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
    // Which department currently "owns" this candidate as it moves through
    // the pipeline (Sourcing -> Documentation -> Accounts -> Onboarding).
    // Read/written by crewingController.js status transitions and by
    // utils/accessScope.js for department-scoped queue visibility.
    currentDepartment: {
      type: String,
      trim: true,
      default: 'SOURCING',
    },
    // The Sourcing Manager this candidate's Sourcing Officer reports to,
    // so the manager's record-level scope (utils/accessScope.js) can see
    // their whole team's candidates, not just their own.
    teamManagerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    // Documentation Head Approval & Clearance tracking
    documentationCleared: {
      type: Boolean,
      default: false,
      index: true,
    },
    documentationApprovedAt: {
      type: Date,
      default: null,
    },
    documentationApprovedById: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    documentationNotes: {
      type: String,
      trim: true,
      default: null,
    },
  },
  { timestamps: true }
);

candidateSchema.index({ cocNumber: 1 }, { unique: true, sparse: true });
candidateSchema.index({ status: 1 });
candidateSchema.index({ rank: 1 });
candidateSchema.index({ createdById: 1 });
candidateSchema.index({ assignedToId: 1 });
candidateSchema.index({ currentOwnerId: 1 });

candidateSchema.pre('save', async function (next) {
  if (!this.seafarerId) {
    try {
      if (this.applicationId && /^\d{5}$/.test(this.applicationId)) {
        const existing = await this.constructor.findOne({ seafarerId: this.applicationId });
        if (!existing) {
          this.seafarerId = this.applicationId;
          return next();
        }
      }
      this.seafarerId = await generateSeafarerId();
    } catch (err) {
      return next(err);
    }
  }
  next();
});

candidateSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    if (!ret.seafarerId && ret.applicationId) {
      ret.seafarerId = ret.applicationId;
    }
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('Candidate', candidateSchema);

