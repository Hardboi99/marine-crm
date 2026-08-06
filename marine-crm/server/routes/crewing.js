const express = require('express');
const router = express.Router();
const { authenticate } = require('../middlewares/auth');
const { requireRole } = require('../middlewares/roleCheck');
const {
  getRequirements, createRequirement, updateRequirement, deleteRequirement,
  getCandidates, createCandidate, updateCandidate, deleteCandidate,
  matchCandidates, getApplications, proposeCandidate, setApplicationDecision
} = require('../controllers/crewingController');

// Requirements vacancy routes
router.get('/requirements', authenticate, getRequirements);
router.post('/requirements', authenticate, requireRole('ADMIN', 'BDM', 'MANAGER'), createRequirement);
router.put('/requirements/:id', authenticate, requireRole('ADMIN', 'BDM', 'MANAGER'), updateRequirement);
router.delete('/requirements/:id', authenticate, requireRole('ADMIN', 'MANAGER'), deleteRequirement);

// Candidate profile routes
router.get('/candidates', authenticate, getCandidates);
router.post('/candidates', authenticate, requireRole('ADMIN', 'HR', 'MANAGER'), createCandidate);
router.put('/candidates/:id', authenticate, requireRole('ADMIN', 'HR', 'MANAGER'), updateCandidate);
router.delete('/candidates/:id', authenticate, requireRole('ADMIN', 'MANAGER'), deleteCandidate);

// Automated matching endpoint
router.get('/requirements/:id/match', authenticate, matchCandidates);

// Applications / Client submission pipeline
router.get('/applications', authenticate, getApplications);
router.post('/applications/propose', authenticate, requireRole('ADMIN', 'HR', 'MANAGER'), proposeCandidate);
router.patch('/applications/:id/decision', authenticate, requireRole('ADMIN', 'HR', 'MANAGER'), setApplicationDecision);

module.exports = router;
