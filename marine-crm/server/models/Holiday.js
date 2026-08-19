const mongoose = require('mongoose');

// Company-wide holidays used by the attendance calendar (yellow status).
// Kept intentionally small and separate from Attendance — a holiday is a
// company-wide calendar fact, not a per-employee attendance record, so it
// does not belong inside the Attendance collection/model.
const holidaySchema = new mongoose.Schema(
  {
    date: { type: String, required: true, unique: true, trim: true }, // YYYY-MM-DD
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: '' },
    createdById: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdByName: { type: String, trim: true },
  },
  { timestamps: true }
);

holidaySchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
  },
});

module.exports = mongoose.model('Holiday', holidaySchema);
