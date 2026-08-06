const mongoose = require('mongoose');

const invoiceSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    candidateId: { type: mongoose.Schema.Types.ObjectId, ref: 'Candidate', required: true },
    requirementId: { type: mongoose.Schema.Types.ObjectId, ref: 'Requirement', required: true },
    invoiceNumber: { type: String, required: true, unique: true },
    amount: { type: Number, required: true },
    candidateCharges: { type: Number, default: 0 },
    salaryAgreed: { type: Number, default: 0 },
    paymentStatus: {
      type: String,
      enum: ['PENDING', 'PAID', 'OVERDUE'],
      default: 'PENDING'
    },
    invoiceDate: { type: Date, default: Date.now },
    dueDate: { type: Date, required: true },
    createdById: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
  },
  { timestamps: true }
);

invoiceSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret.__v;
    return ret;
  },
});

invoiceSchema.set('toObject', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('Invoice', invoiceSchema);
