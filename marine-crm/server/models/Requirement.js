const mongoose = require('mongoose');

const requirementSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    vesselType: {
      type: String,
      required: true,
      enum: ['Tanker', 'Bulk Carrier', 'Container', 'RoRo', 'Gas Carrier']
    },
    rank: {
      type: String,
      required: true,
      enum: [
        'Master', 'Chief Officer', '2nd Officer', '3rd Officer', 'Junior Officer', 'Bosun', 'AB', 'OS',
        'Chief Engineer', '2E', '3E', '4E', 'ETO', 'Fitter', 'Oiler', 'Wiper',
        'Cook', 'Messman'
      ]
    },
    experienceMonthsRequired: { type: Number, required: true, default: 0 },
    joiningDate: { type: Date, required: true },
    salaryOffered: { type: Number, default: null },
    status: {
      type: String,
      enum: ['OPEN', 'FULFILLED', 'CANCELLED'],
      default: 'OPEN'
    },
    createdById: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
  },
  { timestamps: true }
);

requirementSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret.__v;
    return ret;
  },
});

requirementSchema.set('toObject', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('Requirement', requirementSchema);
