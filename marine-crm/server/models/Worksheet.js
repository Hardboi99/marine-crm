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
    submittedAt: { type: Date, default: Date.now },
    // Optional link to the full worksheet/report stored externally
    // (e.g. Google Drive) — surfaced on the worksheet card.
    driveLink: { type: String, trim: true, default: null },
    // Uploaded worksheet file, stored via the existing multer uploads
    // pipeline (same as profile photos / contracts).
    uploadedFileUrl: { type: String, trim: true, default: null },
    uploadedFileName: { type: String, trim: true, default: null },
    // Denormalized at submission time purely for display in worksheet
    // history/review lists (avoids a join back to Attendance for every
    // row) — the Attendance record itself remains the source of truth.
    dayType: { type: String, enum: ['FULL_DAY', 'HALF_DAY'], default: null },
    // Manager/COO/Admin review — kept on the same Worksheet doc rather
    // than a separate comments/chat system, since none exists in this
    // project and the brief asked not to build an unrelated one.
    status: { type: String, enum: ['SUBMITTED', 'REVIEWED'], default: 'SUBMITTED' },
    reply: { type: String, trim: true, default: null },
    repliedById: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    repliedByName: { type: String, trim: true, default: null },
    repliedAt: { type: Date, default: null },
    employeeResponse: { type: String, trim: true, default: null },
    employeeRespondedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

worksheetSchema.set('toJSON', {
  transform: (doc, ret) => {
    ret.id = ret._id ? ret._id.toString() : undefined;
    if (ret.employeeId) ret.employeeId = ret.employeeId.toString();
    if (ret.userId) ret.userId = ret.userId.toString();
    if (ret.repliedById) ret.repliedById = ret.repliedById.toString();
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('Worksheet', worksheetSchema);