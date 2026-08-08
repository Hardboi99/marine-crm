const mongoose = require('mongoose');

const receptionCallSchema = new mongoose.Schema(
  {
    callerName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    company: { type: String, trim: true, default: '' },
    message: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ['PENDING', 'RESOLVED', 'FORWARDED', 'CALLBACK'],
      default: 'PENDING'
    },
    forwardedTo: { type: String, trim: true, default: '' },
    createdById: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
  },
  { timestamps: true }
);

receptionCallSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret.__v;
    return ret;
  }
});

receptionCallSchema.set('toObject', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('ReceptionCall', receptionCallSchema);
