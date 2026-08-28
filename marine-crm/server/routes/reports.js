const express = require('express');
const router  = express.Router();
const { authenticate, loadCurrentUser } = require('../middlewares/auth');
const { requireRole } = require('../middlewares/roleCheck');
const { getCrewingReport, getFrontDeskReport } = require('../controllers/reportsController');

const REPORT_ROLES = ['ADMIN', 'DIRECTOR', 'COO', 'HR', 'MANAGER', 'SOURCING_MANAGER'];

router.use(authenticate, loadCurrentUser, requireRole(...REPORT_ROLES));

router.get('/crewing',   getCrewingReport);
router.get('/frontdesk', getFrontDeskReport);

module.exports = router;
