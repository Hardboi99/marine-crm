const mongoose = require('mongoose');

const worksheetSchema = new mongoose.Schema(
  {
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    date: { type: String, required: true }, // YYYY-MM-DD
    summaryOfWork: { type: String, required: true, trim: true },
    callsMade: { type: Number, default: 0 },
    vesselsContacted: { type: Number, default: 0 },
    notes: { type: String, trim: true, default: '' },
    submittedAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Worksheet', worksheetSchema);
