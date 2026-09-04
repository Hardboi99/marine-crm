const express = require('express');
const router = express.Router();
const { authenticate, loadCurrentUser } = require('../middlewares/auth');
const { requireRole } = require('../middlewares/roleCheck');
const { documentUpload } = require('../middlewares/documentUpload');
const {
  getRequirements, createRequirement, updateRequirement, deleteRequirement,
  getCandidates, getCandidateByCoc, createCandidate, updateCandidate, reassignCandidate, deleteCandidate,
  matchCandidates, getApplications, proposeCandidate, setApplicationDecision,
  getCandidateDocuments, uploadCandidateDocument
} = require('../controllers/crewingController');

// All crewing routes need the fresh DB user (role/department/reportingTo)
// for record-level scoping — see utils/accessScope.js.
router.use(authenticate, loadCurrentUser);

// Requirements vacancy routes
router.get('/requirements', getRequirements);
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

// Candidate Documentation (Part 3) — deliberately NOT under
// /api/documents, which is gated to Documentation-only roles for the
// whole module (§6/§24). These two routes give the sourcing/crewing
// officers candidate-specific documentation access without opening up
// the general Documents page to them; access to a specific candidate is
// still enforced inside the controller via canAccessRecord(), and the
// controller also checks the candidate is actually in the DOCUMENTATION
// stage before allowing an upload — role membership here is necessary
// but not sufficient.
router.get(
  '/candidates/:candidateId/documents',
  requireRole('ADMIN', 'DIRECTOR', 'COO', 'HR', 'SOURCING_MANAGER', 'SOURCING_OFFICER', 'DOCUMENTATION_MANAGER', 'DOCUMENTATION_OFFICER', 'ACCOUNTS_OFFICER'),
  getCandidateDocuments
);
router.post(
  '/candidates/:candidateId/documents',
  requireRole('ADMIN', 'DIRECTOR', 'COO', 'SOURCING_MANAGER', 'SOURCING_OFFICER', 'DOCUMENTATION_MANAGER', 'DOCUMENTATION_OFFICER'),
  documentUpload.single('file'),
  uploadCandidateDocument
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