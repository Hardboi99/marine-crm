const express = require('express');
const router = express.Router();
const { authenticate } = require('../middlewares/auth');
const { requireRole } = require('../middlewares/roleCheck');
const {
  getDashboardStats, getCallsByStatus, getCountryPipeline, getMonthlyContracts, getRecentActivity,
  getNotifications, markNotificationRead, markAllNotificationsRead,
  getRejectionReasonReport, getDailyReport, getCountryWiseReport,
  getEmployeeDashboard,
} = require('../controllers/dashboardController');

// Employee personal dashboard (BDM)
router.get('/dashboard/employee', authenticate, getEmployeeDashboard);

// Admin/HR org-wide dashboard
router.get('/dashboard/stats',                   authenticate, requireRole('ADMIN', 'HR', 'MANAGER'), getDashboardStats);
router.get('/dashboard/charts/calls-by-status',  authenticate, requireRole('ADMIN', 'HR', 'MANAGER'), getCallsByStatus);
router.get('/dashboard/charts/country-pipeline', authenticate, requireRole('ADMIN', 'HR', 'MANAGER'), getCountryPipeline);
router.get('/dashboard/charts/monthly-contracts',authenticate, requireRole('ADMIN', 'HR', 'MANAGER'), getMonthlyContracts);
router.get('/dashboard/activity',                authenticate, requireRole('ADMIN', 'HR', 'MANAGER'), getRecentActivity);

// Notifications — static route MUST come before parameterized /:id route
router.patch('/notifications/read-all', authenticate, markAllNotificationsRead);
router.get('/notifications',            authenticate, getNotifications);
router.patch('/notifications/:id/read', authenticate, markNotificationRead);

// Reports (Admin/HR only)
router.get('/reports/daily',             authenticate, requireRole('ADMIN', 'HR', 'MANAGER'), getDailyReport);
router.get('/reports/country-wise',      authenticate, requireRole('ADMIN', 'HR', 'MANAGER'), getCountryWiseReport);
router.get('/reports/rejection-reasons', authenticate, requireRole('ADMIN', 'HR', 'MANAGER'), getRejectionReasonReport);

module.exports = router;
