// models/Document.js
//
// Assumption: the rest of this project uses Mongoose (candidates,
// requirements, tasks all use `_id`, `.find()`, populated refs, etc.
// in the frontend). Adjust field names if your actual schema differs.

const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    // Path on disk relative to the project root, e.g. "uploads/documents/171234-cert.pdf"
    filePath: {
      type: String,
      required: true,
    },
    // Public URL the frontend can use directly in <a href> / fetch, e.g. "/uploads/documents/171234-cert.pdf"
    fileUrl: {
      type: String,
      required: true,
    },
    mimeType: {
      type: String,
    },
    size: {
      type: Number, // bytes
    },
    category: {
      type: String,
      default: 'OTHER',
    },
    subCategory: {
      type: String, // PASSPORT, CPC, RENAME, ILO_MEDICAL, COVID_VACCINE, YELLOW_FEVER, FLAG_STATE, etc.
      default: null,
    },
    country: {
      type: String,
      default: 'India',
    },
    flagState: {
      type: String, // e.g. Panama, Liberia, Marshall Islands, Bahamas, Malta, Cyprus, Singapore, India MMD, etc.
      default: null,
    },
    rank: {
      type: String, // e.g. Master, Chief Officer, All Ranks, etc.
      default: null,
    },
    customName: {
      type: String, // Customizable document name for 'Rename' or custom doc types
      default: null,
    },
    docNumber: {
      type: String, // Document / Certificate / Passport / CPC number
      default: null,
    },
    issueDate: {
      type: Date,
      default: null,
    },
    expiryDate: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: ['PENDING', 'APPROVED', 'REJECTED'],
      default: 'PENDING',
    },
    notes: {
      type: String,
      trim: true,
    },
    candidateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Candidate',
      default: null,
    },
    applicationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Application',
      default: null,
    },
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      default: null,
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

documentSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('Document', documentSchema);