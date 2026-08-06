const express = require('express');
const router = express.Router();
const { authenticate } = require('../middlewares/auth');
const { requireRole } = require('../middlewares/roleCheck');
const { upload } = require('../middlewares/upload');
const {
  getCalls, createCall, updateCall, deleteCall,
  getAppointments, createAppointment, setAppointmentOutcome, updateAppointment, deleteAppointment,
  getReasons, createReason,
  getFollowUps, createFollowUp, updateFollowUp, deleteFollowUp,
} = require('../controllers/callsController');
const { getContracts, getContract, createContract, updateContract, deleteContract } = require('../controllers/contractsController');

// Calls
router.get('/calls', authenticate, getCalls);
router.post('/calls', authenticate, requireRole('ADMIN', 'BDM', 'MANAGER'), createCall);
router.put('/calls/:id', authenticate, requireRole('ADMIN', 'BDM', 'MANAGER'), updateCall);
router.delete('/calls/:id', authenticate, requireRole('ADMIN', 'BDM', 'MANAGER'), deleteCall);

// Appointments
router.get('/appointments', authenticate, getAppointments);
router.post('/appointments', authenticate, requireRole('ADMIN', 'BDM', 'MANAGER'), createAppointment);
router.put('/appointments/:id', authenticate, requireRole('ADMIN', 'BDM', 'MANAGER'), updateAppointment);
router.patch('/appointments/:id/outcome', authenticate, requireRole('ADMIN', 'BDM', 'MANAGER'), setAppointmentOutcome);
router.delete('/appointments/:id', authenticate, requireRole('ADMIN', 'BDM', 'MANAGER'), deleteAppointment);

// Reasons (shared taxonomy)
router.get('/reasons', authenticate, getReasons);
router.post('/reasons', authenticate, requireRole('ADMIN', 'MANAGER'), createReason);

// Follow-ups
router.get('/followups', authenticate, getFollowUps);
router.post('/followups', authenticate, requireRole('ADMIN', 'BDM', 'MANAGER'), createFollowUp);
router.patch('/followups/:id', authenticate, requireRole('ADMIN', 'BDM', 'HR', 'MANAGER'), updateFollowUp);
router.delete('/followups/:id', authenticate, requireRole('ADMIN', 'BDM', 'MANAGER'), deleteFollowUp);

// Contracts
router.get('/contracts', authenticate, getContracts);
router.get('/contracts/:id', authenticate, getContract);
router.post('/contracts', authenticate, requireRole('ADMIN', 'BDM', 'MANAGER'), upload.single('file'), createContract);
router.put('/contracts/:id', authenticate, requireRole('ADMIN', 'BDM', 'MANAGER'), upload.single('file'), updateContract);
router.delete('/contracts/:id', authenticate, requireRole('ADMIN', 'BDM', 'MANAGER'), deleteContract);

module.exports = router;
