const express = require('express');
const router = express.Router();
const { requireRole } = require('../middlewares/roleCheck');
const { upload } = require('../middlewares/upload');
const {
  getCalls, createCall, updateCall, deleteCall,
  getAppointments, createAppointment, setAppointmentOutcome, updateAppointment, deleteAppointment,
  getReasons, createReason,
  getFollowUps, getFollowUpsDue, createFollowUp, updateFollowUp, deleteFollowUp,
} = require('../controllers/callsController');
const { getContracts, getContract, createContract, updateContract, deleteContract, downloadContractFile } = require('../controllers/contractsController');

// Calls
router.get('/calls', getCalls);
router.post('/calls', requireRole('ADMIN', 'DIRECTOR', 'COO', 'BDM'), createCall);
router.put('/calls/:id', requireRole('ADMIN', 'DIRECTOR', 'COO', 'BDM'), updateCall);
router.delete('/calls/:id', requireRole('ADMIN', 'DIRECTOR', 'COO', 'BDM'), deleteCall);

// Appointments
router.get('/appointments', getAppointments);
router.post('/appointments', requireRole('ADMIN', 'DIRECTOR', 'COO', 'BDM'), createAppointment);
router.put('/appointments/:id', requireRole('ADMIN', 'DIRECTOR', 'COO', 'BDM'), updateAppointment);
router.patch('/appointments/:id/outcome', requireRole('ADMIN', 'DIRECTOR', 'COO', 'BDM'), setAppointmentOutcome);
router.delete('/appointments/:id', requireRole('ADMIN', 'DIRECTOR', 'COO', 'BDM'), deleteAppointment);

// Reasons (shared taxonomy — not ownable, no record-level scoping needed)
router.get('/reasons', getReasons);
router.post('/reasons', requireRole('ADMIN', 'DIRECTOR', 'COO', 'BDM'), createReason);

// Follow-ups
router.get('/followups/due', getFollowUpsDue);
router.get('/followups', getFollowUps);
router.post('/followups', requireRole('ADMIN', 'DIRECTOR', 'COO', 'BDM'), createFollowUp);
router.patch('/followups/:id', requireRole('ADMIN', 'DIRECTOR', 'COO', 'BDM', 'HR'), updateFollowUp);
router.delete('/followups/:id', requireRole('ADMIN', 'DIRECTOR', 'COO', 'BDM'), deleteFollowUp);

// Contracts
router.get('/contracts', getContracts);
router.get('/contracts/:id', getContract);
router.get('/contracts/:id/file', downloadContractFile);
router.post('/contracts', requireRole('ADMIN', 'DIRECTOR', 'COO', 'BDM'), upload.single('file'), createContract);
router.put('/contracts/:id', requireRole('ADMIN', 'DIRECTOR', 'COO', 'BDM'), upload.single('file'), updateContract);
router.delete('/contracts/:id', requireRole('ADMIN', 'DIRECTOR', 'COO', 'BDM'), deleteContract);

module.exports = router;