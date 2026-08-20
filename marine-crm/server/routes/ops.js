const express = require('express');
const router = express.Router();
const { authenticate, loadCurrentUser } = require('../middlewares/auth');
const { requireRole } = require('../middlewares/roleCheck');
const {
  getOnboardings, updateOnboarding,
  getInvoices, createInvoice, updateInvoice,
  getExpiryAlerts
} = require('../controllers/opsController');

router.use(authenticate, loadCurrentUser);

// Onboarding checklists — Accounts + org-wide roles only (§24/§25).
router.get('/onboardings', requireRole('ADMIN', 'DIRECTOR', 'COO', 'HR', 'ACCOUNTS_OFFICER'), getOnboardings);
router.put('/onboardings/:id', requireRole('ADMIN', 'DIRECTOR', 'COO', 'HR', 'ACCOUNTS_OFFICER'), updateOnboarding);

// Invoices & accounts — never exposed to Sourcing/HR (§14).
router.get('/invoices', requireRole('ADMIN', 'DIRECTOR', 'COO', 'ACCOUNTS_OFFICER'), getInvoices);
router.post('/invoices', requireRole('ADMIN', 'DIRECTOR', 'COO', 'ACCOUNTS_OFFICER'), createInvoice);
router.put('/invoices/:id', requireRole('ADMIN', 'DIRECTOR', 'COO', 'ACCOUNTS_OFFICER'), updateInvoice);

// Expiry alerts & Compliance — operationally useful org-wide, kept open to any authenticated staff.
router.get('/expiry-alerts', getExpiryAlerts);

module.exports = router;