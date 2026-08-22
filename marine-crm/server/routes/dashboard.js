const express = require('express');
const router = express.Router();
const { requireRole } = require('../middlewares/roleCheck');
const {
  getDashboardStats, getCallsByStatus, getCountryPipeline, getMonthlyContracts, getRecentActivity,
  getNotifications, markNotificationRead, markAllNotificationsRead,
  getRejectionReasonReport, getDailyReport, getCountryWiseReport,
  getEmployeeDashboard,
} = require('../controllers/dashboardController');

// Employee personal dashboard (BDM)
router.get('/dashboard/employee', getEmployeeDashboard);

// §29 — dashboard/stats is now open to every authenticated role; the
// controller itself scopes the numbers per-role (team for managers, own
// work for officers, BDM/finance figures hidden from non-BDM/Accounts).
router.get('/dashboard/stats', getDashboardStats);

// BDM commercial-pipeline charts & reports — org-wide + BDM/Accounts only,
// never Sourcing/Documentation/Admin (§8/§9/§14 — no unrelated BDM data).
const BDM_REPORT_ROLES = ['ADMIN', 'DIRECTOR', 'COO', 'BDM', 'ACCOUNTS_OFFICER', 'HR'];
router.get('/dashboard/charts/calls-by-status',   requireRole(...BDM_REPORT_ROLES), getCallsByStatus);
router.get('/dashboard/charts/country-pipeline',  requireRole(...BDM_REPORT_ROLES), getCountryPipeline);
router.get('/dashboard/charts/monthly-contracts', requireRole(...BDM_REPORT_ROLES), getMonthlyContracts);
router.get('/dashboard/activity',                 requireRole('ADMIN', 'DIRECTOR', 'COO', 'HR'), getRecentActivity);

// Notifications — static route MUST come before parameterized /:id route
router.patch('/notifications/read-all', markAllNotificationsRead);
router.get('/notifications',            getNotifications);
router.patch('/notifications/:id/read', markNotificationRead);

// Reports
router.get('/reports/daily',             requireRole(...BDM_REPORT_ROLES), getDailyReport);
router.get('/reports/country-wise',      requireRole(...BDM_REPORT_ROLES), getCountryWiseReport);
router.get('/reports/rejection-reasons', requireRole(...BDM_REPORT_ROLES), getRejectionReasonReport);

module.exports = router;