const mongoose = require('mongoose');

const ppeStockSchema = new mongoose.Schema(
  {
    itemName: { type: String, required: true, unique: true, trim: true },
    totalQuantity: { type: Number, default: 0 },
    availableQuantity: { type: Number, default: 0 }
  },
  { timestamps: true }
);

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
