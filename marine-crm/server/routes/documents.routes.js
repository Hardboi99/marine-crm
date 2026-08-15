// routes/documents.routes.js

const express = require('express');
const router = express.Router();

const { documentUpload } = require('../middlewares/documentUpload');
const { getAllDocuments, createDocument } = require('../controllers/documents.controller');
const { authenticate } = require('../middlewares/auth');
const { requireRole } = require('../middlewares/roleCheck');

// authenticate populates req.user ({ id, email, role, name }) from the JWT.
// requireRole restricts access strictly to ADMIN and MANAGER_DOCS.
router.use(authenticate, requireRole('ADMIN', 'MANAGER_DOCS'));

router.get('/', getAllDocuments);

// documentUpload.single('file') processes multipart payload before createDocument
router.post('/', documentUpload.single('file'), createDocument);

// Handle multer file upload errors with descriptive JSON
router.use((err, req, res, next) => {
  if (err && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ success: false, message: 'File is larger than 25MB.' });
  }
  if (err && err.message === 'UNSUPPORTED_FILE_TYPE') {
    return res.status(400).json({ success: false, message: 'That file type is not supported.' });
  }
  if (err) {
    console.error('Documents route error:', err);
    return res.status(500).json({ success: false, message: err.message || 'Upload failed.' });
  }
  next();
});

module.exports = router;