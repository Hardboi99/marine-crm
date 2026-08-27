const mongoose = require('mongoose');

const ppeStockSchema = new mongoose.Schema(
  {
    itemName: { type: String, required: true, trim: true },
    category: { type: String, default: 'General', trim: true },
    colorSpec: { type: String, default: 'Standard', trim: true },
    applicableTo: { type: String, default: 'All Ranks', trim: true },
    size: { type: String, default: 'Standard', trim: true },
    totalQuantity: { type: Number, default: 0, min: 0 },
    availableQuantity: { type: Number, default: 0, min: 0 },
    reorderLevel: { type: Number, default: 5, min: 0 }
  },
  { timestamps: true }
);

ppeStockSchema.index({ itemName: 1, colorSpec: 1, size: 1 }, { unique: true });

ppeStockSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret.__v;
    return ret;
  }
});

ppeStockSchema.set('toObject', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('PpeStock', ppeStockSchema);
