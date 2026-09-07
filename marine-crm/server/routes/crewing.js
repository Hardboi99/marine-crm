const express = require('express');
const router = express.Router();
const { authenticate, loadCurrentUser } = require('../middlewares/auth');
const { requireRole } = require('../middlewares/roleCheck');
const { documentUpload } = require('../middlewares/documentUpload');
const {
  getRequirements, createRequirement, updateRequirement, deleteRequirement,
  getVessels, createVessel,
  getCandidates, getCandidateByCoc, createCandidate, updateCandidate, reassignCandidate, deleteCandidate,
  matchCandidates, getApplications, proposeCandidate, setApplicationDecision,
  getCandidateDocuments, uploadCandidateDocument, updateCandidateDocument, deleteCandidateDocument
} = require('../controllers/crewingController');

// All crewing routes need the fresh DB user (role/department/reportingTo)
// for record-level scoping — see utils/accessScope.js.
router.use(authenticate, loadCurrentUser);

// Requirements vacancy routes
router.get('/requirements', getRequirements);
router.get('/vessels', getVessels);
router.post('/vessels', requireRole('ADMIN', 'DIRECTOR', 'COO', 'BDM', 'SOURCING_MANAGER'), createVessel);
router.post('/requirements', requireRole('ADMIN', 'DIRECTOR', 'COO', 'BDM', 'SOURCING_MANAGER'), createRequirement);
router.put('/requirements/:id', requireRole('ADMIN', 'DIRECTOR', 'COO', 'BDM', 'SOURCING_MANAGER', 'SOURCING_OFFICER'), updateRequirement);
router.delete('/requirements/:id', requireRole('ADMIN', 'DIRECTOR', 'COO', 'SOURCING_MANAGER'), deleteRequirement);

// Candidate profile routes
router.get('/candidates', getCandidates);
router.get('/candidates/by-coc/:cocNumber', getCandidateByCoc);
router.post('/candidates', requireRole('ADMIN', 'DIRECTOR', 'COO', 'HR', 'SOURCING_MANAGER', 'SOURCING_OFFICER'), createCandidate);
router.put('/candidates/:id', requireRole('ADMIN', 'DIRECTOR', 'COO', 'HR', 'SOURCING_MANAGER', 'SOURCING_OFFICER', 'DOCUMENTATION_MANAGER', 'DOCUMENTATION_OFFICER', 'ACCOUNTS_OFFICER'), updateCandidate);
router.patch('/candidates/:id/reassign', requireRole('ADMIN', 'DIRECTOR', 'COO', 'HR', 'SOURCING_MANAGER', 'DOCUMENTATION_MANAGER'), reassignCandidate);
router.delete('/candidates/:id', requireRole('ADMIN', 'DIRECTOR', 'COO', 'SOURCING_MANAGER'), deleteCandidate);

// Automated matching endpoint
router.get('/requirements/:id/match', matchCandidates);

// Applications / Client submission pipeline
router.get('/applications', getApplications);
router.post('/applications/propose', requireRole('ADMIN', 'DIRECTOR', 'COO', 'HR', 'SOURCING_MANAGER', 'SOURCING_OFFICER'), proposeCandidate);
router.patch('/applications/:id/decision', requireRole('ADMIN', 'DIRECTOR', 'COO', 'HR', 'SOURCING_MANAGER', 'SOURCING_OFFICER'), setApplicationDecision);

// Candidate Documentation & Hierarchy routes
router.get(
  '/candidates/:candidateId/documents',
  requireRole('ADMIN', 'DIRECTOR', 'COO', 'HR', 'SOURCING_MANAGER', 'SOURCING_OFFICER', 'DOCUMENTATION_MANAGER', 'DOCUMENTATION_OFFICER', 'ACCOUNTS_OFFICER'),
  getCandidateDocuments
);
router.post(
  '/candidates/:candidateId/documents',
  requireRole('ADMIN', 'DIRECTOR', 'COO', 'HR', 'SOURCING_MANAGER', 'SOURCING_OFFICER', 'DOCUMENTATION_MANAGER', 'DOCUMENTATION_OFFICER'),
  documentUpload.single('file'),
  uploadCandidateDocument
);
router.put(
  '/candidates/:candidateId/documents/:documentId',
  requireRole('ADMIN', 'DIRECTOR', 'COO', 'HR', 'SOURCING_MANAGER', 'SOURCING_OFFICER', 'DOCUMENTATION_MANAGER', 'DOCUMENTATION_OFFICER'),
  updateCandidateDocument
);
router.patch(
  '/candidates/:candidateId/documents/:documentId',
  requireRole('ADMIN', 'DIRECTOR', 'COO', 'HR', 'SOURCING_MANAGER', 'SOURCING_OFFICER', 'DOCUMENTATION_MANAGER', 'DOCUMENTATION_OFFICER'),
  updateCandidateDocument
);
router.delete(
  '/candidates/:candidateId/documents/:documentId',
  requireRole('ADMIN', 'DIRECTOR', 'COO', 'HR', 'SOURCING_MANAGER', 'SOURCING_OFFICER', 'DOCUMENTATION_MANAGER', 'DOCUMENTATION_OFFICER'),
  deleteCandidateDocument
);

// Handle multer file upload errors on the candidate-documents routes
// with the same descriptive JSON as routes/documents.routes.js.
router.use((err, req, res, next) => {
  if (err && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ success: false, message: 'File is larger than 25MB.' });
  }
  if (err && err.message === 'UNSUPPORTED_FILE_TYPE') {
    return res.status(400).json({ success: false, message: 'That file type is not supported.' });
  }
  if (err) {
    console.error('Crewing route error:', err);
    return res.status(500).json({ success: false, message: err.message || 'Request failed.' });
  }
  next();
});

module.exports = router;