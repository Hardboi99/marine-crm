const express = require('express');
const router = express.Router();
const { authenticate } = require('../middlewares/auth');
const { requireRole } = require('../middlewares/roleCheck');
const {
  getOnboardings, updateOnboarding,
  getInvoices, createInvoice, updateInvoice,
  getExpiryAlerts
} = require('../controllers/opsController');

// Onboarding checklists
router.get('/onboardings', authenticate, getOnboardings);
router.put('/onboardings/:id', authenticate, requireRole('ADMIN', 'HR', 'MANAGER'), updateOnboarding);

// Invoices & accounts
router.get('/invoices', authenticate, getInvoices);
router.post('/invoices', authenticate, requireRole('ADMIN', 'MANAGER'), createInvoice);
router.put('/invoices/:id', authenticate, requireRole('ADMIN', 'MANAGER'), updateInvoice);

// Expiry alerts & Compliance
router.get('/expiry-alerts', authenticate, getExpiryAlerts);

module.exports = router;
