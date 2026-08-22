const express = require('express');
const router = express.Router();
const { authenticate, loadCurrentUser } = require('../middlewares/auth');
const { requireRole } = require('../middlewares/roleCheck');
const {
  getRequirements, createRequirement, updateRequirement, deleteRequirement,
  getCandidates, createCandidate, updateCandidate, reassignCandidate, deleteCandidate,
  matchCandidates, getApplications, proposeCandidate, setApplicationDecision
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

module.exports = router;