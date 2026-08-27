const mongoose = require('mongoose');

const ppeStockHistorySchema = new mongoose.Schema(
  {
    stockId: { type: mongoose.Schema.Types.ObjectId, ref: 'PpeStock' },
    itemName: { type: String, required: true, trim: true },
    colorSpec: { type: String, default: 'Standard', trim: true },
    size: { type: String, default: 'Standard', trim: true },
    quantityChanged: { type: Number, required: true },
    beforeQuantity: { type: Number, required: true },
    afterQuantity: { type: Number, required: true },
    reason: {
      type: String,
      required: true,
      enum: ['New Stock', 'Correction', 'Damaged', 'Lost', 'Other', 'Issuance', 'Return'],
      trim: true
    },
    createdById: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
  },
  { timestamps: true }
);

ppeStockHistorySchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret.__v;
    return ret;
  }
});

ppeStockHistorySchema.set('toObject', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('PpeStockHistory', ppeStockHistorySchema);
