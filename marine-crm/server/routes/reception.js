const express = require('express');
const router = express.Router();
const { authenticate, loadCurrentUser } = require('../middlewares/auth');
const { requireRole } = require('../middlewares/roleCheck');

const {
  listVisitors, createVisitor, checkOutVisitor,
  listCalls, createCall, updateCallStatus,
  listPpeStock, updatePpeStock, listPpeIssuances, issuePpe, returnPpe,
  listDocIntakes, createDocIntake, updateDocIntakeStatus
} = require('../controllers/receptionController');

// All reception routes require authentication and staff/reception/admin roles
router.use(authenticate, loadCurrentUser, requireRole('ADMIN', 'HR', 'ADMIN_OFFICER', 'DIRECTOR', 'COO', 'RECEPTION'));

// Visitors
router.get('/visitors', authenticate, listVisitors);
router.post('/visitors', authenticate, createVisitor);
router.patch('/visitors/:id/checkout', authenticate, checkOutVisitor);

// General incoming calls
router.get('/calls', authenticate, listCalls);
router.post('/calls', authenticate, createCall);
router.patch('/calls/:id/status', authenticate, updateCallStatus);

// PPE Stock & Issuance
router.get('/ppe/stock', authenticate, listPpeStock);
router.post('/ppe/stock', authenticate, updatePpeStock);
router.get('/ppe/issuances', authenticate, listPpeIssuances);
router.post('/ppe/issuances', authenticate, issuePpe);
router.patch('/ppe/issuances/:id/return', authenticate, returnPpe);

// CDC & Passport collections
router.get('/docs', authenticate, listDocIntakes);
router.post('/docs', authenticate, createDocIntake);
router.patch('/docs/:id/status', authenticate, updateDocIntakeStatus);

module.exports = router;
