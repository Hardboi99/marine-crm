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
    createdById: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
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
