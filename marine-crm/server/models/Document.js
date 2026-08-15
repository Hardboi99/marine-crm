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
      enum: ['CONTRACT', 'CREW_CERTIFICATE', 'COMPLIANCE', 'HR', 'OTHER'],
      default: 'OTHER',
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
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true } // gives us createdAt / updatedAt for free
);

module.exports = mongoose.model('Document', documentSchema);