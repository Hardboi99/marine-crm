const mongoose = require('mongoose');

const companySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    countryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Country', required: true },
    fleetDetails: { type: String, default: null },
    contactPerson: { type: String, default: null },
    email: { type: String, lowercase: true, trim: true, default: null },
    phone: { type: String, default: null },
    website: { type: String, default: null },
    status: { type: String, enum: ['PROSPECT', 'NEGOTIATING', 'CLIENT', 'REJECTED'], default: 'PROSPECT' },
    notes: { type: String, default: null },
    createdById: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

companySchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret.__v;
    return ret;
  },
});

companySchema.set('toObject', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('Company', companySchema);
