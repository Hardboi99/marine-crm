const mongoose = require('mongoose');

const ppeStandardSchema = new mongoose.Schema(
  {
    ownerType: {
      type: String,
      required: true,
      enum: ['Common', 'Turkey Owner', 'Other Owners'],
      trim: true
    },
    category: { type: String, required: true, trim: true },
    itemName: { type: String, required: true, trim: true },
    applicableRank: { type: String, default: 'All Ranks', trim: true },
    colorSpec: { type: String, default: 'Standard', trim: true },
    remarks: { type: String, default: '', trim: true },
    active: { type: Boolean, default: true }
  },
  { timestamps: true }
);

ppeStandardSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret.__v;
    return ret;
  }
});

ppeStandardSchema.set('toObject', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('PpeStandard', ppeStandardSchema);
