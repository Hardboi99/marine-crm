const express = require('express');
const router = express.Router();
const { authenticate, loadCurrentUser } = require('../middlewares/auth');
const { requireRole } = require('../middlewares/roleCheck');
const {
  getRequirements, createRequirement, updateRequirement, deleteRequirement,
  getCandidates, createCandidate, updateCandidate, deleteCandidate,
  matchCandidates, getApplications, proposeCandidate, setApplicationDecision
} = require('../controllers/crewingController');

// All crewing routes need the fresh DB user (role/department/reportingTo)
// for record-level scoping — see utils/accessScope.js.
router.use(authenticate, loadCurrentUser);

// Requirements vacancy routes
router.get('/requirements', getRequirements);
router.post('/requirements', requireRole('ADMIN', 'BDM', 'SOURCING_MANAGER', 'MANAGER'), createRequirement);
router.put('/requirements/:id', requireRole('ADMIN', 'BDM', 'SOURCING_MANAGER', 'SOURCING_OFFICER', 'MANAGER'), updateRequirement);
router.delete('/requirements/:id', requireRole('ADMIN', 'SOURCING_MANAGER', 'MANAGER'), deleteRequirement);

// Candidate profile routes
router.get('/candidates', getCandidates);
router.post('/candidates', requireRole('ADMIN', 'HR', 'SOURCING_MANAGER', 'SOURCING_OFFICER', 'MANAGER'), createCandidate);
router.put('/candidates/:id', requireRole('ADMIN', 'HR', 'SOURCING_MANAGER', 'SOURCING_OFFICER', 'DOCUMENTATION_MANAGER', 'DOCUMENTATION_OFFICER', 'ACCOUNTS_OFFICER', 'MANAGER'), updateCandidate);
router.delete('/candidates/:id', requireRole('ADMIN', 'SOURCING_MANAGER', 'MANAGER'), deleteCandidate);

// Automated matching endpoint
router.get('/requirements/:id/match', matchCandidates);

// Applications / Client submission pipeline
router.get('/applications', getApplications);
router.post('/applications/propose', requireRole('ADMIN', 'HR', 'SOURCING_MANAGER', 'SOURCING_OFFICER', 'MANAGER'), proposeCandidate);
router.patch('/applications/:id/decision', requireRole('ADMIN', 'HR', 'SOURCING_MANAGER', 'SOURCING_OFFICER', 'MANAGER'), setApplicationDecision);

module.exports = router;