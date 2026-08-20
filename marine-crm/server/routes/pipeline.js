const express = require('express');
const router = express.Router();
const { authenticate, loadCurrentUser } = require('../middlewares/auth');
const { requireRole } = require('../middlewares/roleCheck');
const { upload } = require('../middlewares/upload');
const {
  getCalls, createCall, updateCall, deleteCall,
  getAppointments, createAppointment, setAppointmentOutcome, updateAppointment, deleteAppointment,
  getReasons, createReason,
  getFollowUps, createFollowUp, updateFollowUp, deleteFollowUp,
} = require('../controllers/callsController');
const { getContracts, getContract, createContract, updateContract, deleteContract } = require('../controllers/contractsController');

router.use(authenticate, loadCurrentUser);

// Calls
router.get('/calls', getCalls);
router.post('/calls', requireRole('ADMIN', 'BDM', 'MANAGER'), createCall);
router.put('/calls/:id', requireRole('ADMIN', 'BDM', 'MANAGER'), updateCall);
router.delete('/calls/:id', requireRole('ADMIN', 'BDM', 'MANAGER'), deleteCall);

// Appointments
router.get('/appointments', getAppointments);
router.post('/appointments', requireRole('ADMIN', 'BDM', 'MANAGER'), createAppointment);
router.put('/appointments/:id', requireRole('ADMIN', 'BDM', 'MANAGER'), updateAppointment);
router.patch('/appointments/:id/outcome', requireRole('ADMIN', 'BDM', 'MANAGER'), setAppointmentOutcome);
router.delete('/appointments/:id', requireRole('ADMIN', 'BDM', 'MANAGER'), deleteAppointment);

// Reasons (shared taxonomy — not ownable, no record-level scoping needed)
router.get('/reasons', getReasons);
router.post('/reasons', requireRole('ADMIN', 'MANAGER'), createReason);

// Follow-ups
// NOTE (limitation — see final response §H): FollowUp records have no
// creator/owner field in the existing schema (only an optional
// appointmentId link), so they are gated by role only, not per-record
// ownership. See utils/accessScope.js header comment for the reasoning.
router.get('/followups', getFollowUps);
router.post('/followups', requireRole('ADMIN', 'BDM', 'MANAGER'), createFollowUp);
router.patch('/followups/:id', requireRole('ADMIN', 'BDM', 'HR', 'MANAGER'), updateFollowUp);
router.delete('/followups/:id', requireRole('ADMIN', 'BDM', 'MANAGER'), deleteFollowUp);

// Contracts
router.get('/contracts', getContracts);
router.get('/contracts/:id', getContract);
router.post('/contracts', requireRole('ADMIN', 'BDM', 'MANAGER'), upload.single('file'), createContract);
router.put('/contracts/:id', requireRole('ADMIN', 'BDM', 'MANAGER'), upload.single('file'), updateContract);
router.delete('/contracts/:id', requireRole('ADMIN', 'BDM', 'MANAGER'), deleteContract);

module.exports = router;