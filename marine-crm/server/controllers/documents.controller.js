// controllers/documents.controller.js

const fs = require('fs');
const { Document } = require('../models');

// GET /api/documents
async function getAllDocuments(req, res, next) {
  try {
    const { category, status, search } = req.query;
    const filter = {};
    if (category) filter.category = category;
    if (status) filter.status = status;
    if (search) filter.name = { $regex: search, $options: 'i' };

    const documents = await Document.find(filter)
      .populate('uploadedBy', 'name email')
      .sort({ createdAt: -1 });

    return res.status(200).json({ success: true, data: documents });
  } catch (err) {
    console.error('getAllDocuments error:', err);
    return res.status(500).json({ success: false, message: err.message || 'Failed to fetch documents.' });
  }
}

// POST /api/documents  (multipart/form-data: file, category, notes)
// Expects `documentUpload.single('file')` to have already run so that
// req.file and req.body.category / req.body.notes are populated.
async function createDocument(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file was uploaded. Attach a file and try again.' });
    }

    const userId = req.user?.id || req.user?._id;
    if (!userId) {
      if (req.file?.path) {
        fs.unlink(req.file.path, () => {});
      }
      return res.status(401).json({ success: false, message: 'Authentication required. No valid user session found.' });
    }

    const { category, notes } = req.body;

    const doc = await Document.create({
      name: req.file.originalname,
      filePath: req.file.path,
      fileUrl: `/uploads/documents/${req.file.filename}`,
      mimeType: req.file.mimetype,
      size: req.file.size,
      category: category || 'OTHER',
      notes: notes ? notes.trim() : '',
      status: 'PENDING',
      uploadedBy: userId,
    });

    const populated = await doc.populate('uploadedBy', 'name email');

    return res.status(201).json({ success: true, data: populated });
  } catch (err) {
    console.error('createDocument error:', err);

    // Clean up the file that multer already wrote to disk if the DB
    // insert failed, so we don't leak orphaned uploads.
    if (req.file?.path) {
      fs.unlink(req.file.path, () => {});
    }

    if (err.name === 'ValidationError') {
      return res.status(400).json({ success: false, message: err.message });
    }

    return res.status(500).json({ success: false, message: err.message || 'Failed to save document.' });
  }
}

module.exports = { getAllDocuments, createDocument };