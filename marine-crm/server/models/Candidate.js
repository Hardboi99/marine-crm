const mongoose = require('mongoose');

const candidateSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    rank: {
      type: String,
      required: true,
      enum: [
        // Deck Side
        'Master', 'Chief Officer', '2nd Officer', '3rd Officer', 'Junior Officer', 'Bosun', 'AB', 'OS',
        // Engine Side
        'Chief Engineer', '2E', '3E', '4E', 'ETO', 'Fitter', 'Oiler', 'Wiper',
        // Galley
        'Cook', 'Messman'
      ]
    },
    dob: { type: Date, required: true },
    location: { type: String, required: true, trim: true },
    cocDetails: {
      number: { type: String, required: true, trim: true },
      expiryDate: { type: Date, required: true },
      grade: { type: String, trim: true, default: null },
      country: { type: String, trim: true, default: null }
    },
    passportDetails: {
      number: { type: String, required: true, trim: true },
      expiryDate: { type: Date, required: true }
    },
    cdcDetails: {
      number: { type: String, required: true, trim: true },
      expiryDate: { type: Date, required: true },
      country: { type: String, trim: true, default: null }
    },
    lastWages: { type: Number, default: null },
    expectedWages: { type: Number, required: true },
    contactNumber: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    availabilityDate: { type: Date, required: true },
    vesselExperience: [
      {
        vesselType: {
          type: String,
          required: true,
          enum: ['Tanker', 'Bulk Carrier', 'Container', 'RoRo', 'Gas Carrier']
        },
        rank: { type: String, required: true },
        months: { type: Number, required: true }
      }
    ],
    status: {
      type: String,
      enum: ['AVAILABLE', 'SHORTLISTED', 'PROPOSED', 'APPROVED', 'DOCUMENTATION', 'ONBOARDED', 'REJECTED_TALENT_POOL'],
      default: 'AVAILABLE'
    },
    remarks: { type: String, default: null },
    createdById: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    // ── Ownership / hierarchy fields (data-scope authorization) ──────────
    // Who is actively responsible for this candidate right now.
    assignedToId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    // The sourcing manager over whichever officer owns/created this record —
    // denormalised so a manager's team-scope query doesn't need a join.
    teamManagerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    // Department the candidate currently belongs to workflow-wise.
    department: {
      type: String,
      enum: ['SOURCING', 'DOCUMENTATION', 'ACCOUNTS', 'ONBOARDING'],
      default: 'SOURCING',
    },
    // Kept in sync with `department` — represents "which team currently
    // owns this candidate" as the single candidate record moves through
    // the workflow (never duplicated between departments).
    currentDepartment: {
      type: String,
      enum: ['SOURCING', 'DOCUMENTATION', 'ACCOUNTS', 'ONBOARDING'],
      default: 'SOURCING',
    },
    // Whoever in currentDepartment is actively handling the candidate.
    currentOwnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    // Fine-grained workflow position, distinct from the coarser `status`
    // enum above — see utils/workflow.js for the allowed transitions.
    workflowStage: {
      type: String,
      enum: [
        'CV_SCREENING', 'CV_REJECTED', 'COMPANY_CV_PREP', 'DOCUMENT_COLLECTION',
        'CONTRACT_CHECKLIST', 'PROPOSED', 'CLIENT_ACCEPTED', 'CLIENT_REJECTED',
        'DOCUMENTATION', 'ACCOUNTS', 'ONBOARDING', 'ONBOARDED'
      ],
      default: 'CV_SCREENING',
    },
  },
  { timestamps: true }
);

candidateSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret.__v;
    return ret;
  },
});

candidateSchema.set('toObject', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('Candidate', candidateSchema);