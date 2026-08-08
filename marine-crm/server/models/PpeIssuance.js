const mongoose = require('mongoose');

const ppeIssuanceSchema = new mongoose.Schema(
  {
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    itemName: { type: String, required: true, trim: true },
    quantity: { type: Number, default: 1 },
    issueDate: { type: Date, default: Date.now },
    status: {
      type: String,
      enum: ['ISSUED', 'RETURNED'],
      default: 'ISSUED'
    },
    returnDate: { type: Date, default: null },
    createdById: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
  },
  { timestamps: true }
);

ppeIssuanceSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret.__v;
    return ret;
  }
});

ppeIssuanceSchema.set('toObject', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('PpeIssuance', ppeIssuanceSchema);
