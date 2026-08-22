// controllers/documents.controller.js

const fs = require('fs');
const { Document } = require('../models');
const { ROLES, ORG_WIDE_ROLES } = require('../utils/roles');

// GET /api/documents
// NOTE (limitation — see final response §H): the Document model has no
// candidate/department link, only `uploadedBy` — so scoping here is by
// upload ownership rather than the full ownership-chain used for
// Candidate/Requirement. DOCUMENTATION_OFFICER sees their own uploads;
// DOCUMENTATION_MANAGER and org-wide roles see the whole documentation
// queue (route-level requireRole already excludes every other department).
async function getAllDocuments(req, res, next) {
  try {
    const { category, status, search } = req.query;
    const filter = {};
    if (category) filter.category = category;
    if (status) filter.status = status;
    if (search) filter.name = { $regex: search, $options: 'i' };

    const role = req.currentUser?.role;
    if (role === ROLES.DOCUMENTATION_OFFICER) {
      filter.uploadedBy = req.currentUser._id;
    }
    // DOCUMENTATION_MANAGER / org-wide roles: no extra restriction (route
    // gating in routes/documents.routes.js already limits who reaches here).

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

    const { category, notes, candidateId, employeeId } = req.body;

    const doc = await Document.create({
      name: req.file.originalname,
      filePath: req.file.path,
      fileUrl: `/api/documents/download-temp/${req.file.filename}`, // internal ref
      mimeType: req.file.mimetype,
      size: req.file.size,
      category: category || 'OTHER',
      candidateId: candidateId || null,
      employeeId: employeeId || null,
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

// GET /api/documents/:id/file
async function downloadDocumentFile(req, res, next) {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) return res.status(404).json({ success: false, message: 'Document not found.' });

    const role = req.currentUser?.role;
    const uid = (req.currentUser?._id || req.user?.id || '').toString();
    if (role === ROLES.DOCUMENTATION_OFFICER && doc.uploadedBy.toString() !== uid) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    if (!doc.filePath || !fs.existsSync(doc.filePath)) {
      return res.status(404).json({ success: false, message: 'File not found on disk.' });
    }

    return res.download(doc.filePath, doc.name);
  } catch (err) {
    next(err);
  }
}

// PATCH /api/documents/:id/status
async function updateDocumentStatus(req, res, next) {
  try {
    const { status, notes } = req.body;
    const allowed = ['PENDING', 'APPROVED', 'REJECTED'];
    if (status && !allowed.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status value.' });
    }
    const doc = await Document.findById(req.params.id);
    if (!doc) return res.status(404).json({ success: false, message: 'Document not found.' });

    if (status) doc.status = status;
    if (notes !== undefined) doc.notes = notes;
    await doc.save();
    return res.json({ success: true, data: doc });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/documents/:id
async function deleteDocument(req, res, next) {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) return res.status(404).json({ success: false, message: 'Document not found.' });

    if (doc.filePath && fs.existsSync(doc.filePath)) {
      fs.unlink(doc.filePath, () => {});
    }
    await Document.findByIdAndDelete(req.params.id);
    return res.json({ success: true, message: 'Document deleted successfully.' });
  } catch (err) {
    next(err);
  }
}

module.exports = { getAllDocuments, createDocument, downloadDocumentFile, updateDocumentStatus, deleteDocument };