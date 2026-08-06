const express = require('express');
const router = express.Router();
const { authenticate } = require('../middlewares/auth');
const {
  getDashboardStats, getCallsByStatus, getCountryPipeline, getMonthlyContracts, getRecentActivity,
  getNotifications, markNotificationRead, markAllNotificationsRead,
  getRejectionReasonReport, getDailyReport, getCountryWiseReport,
} = require('../controllers/dashboardController');

// Dashboard
router.get('/dashboard/stats', authenticate, getDashboardStats);
router.get('/dashboard/charts/calls-by-status', authenticate, getCallsByStatus);
router.get('/dashboard/charts/country-pipeline', authenticate, getCountryPipeline);
router.get('/dashboard/charts/monthly-contracts', authenticate, getMonthlyContracts);
router.get('/dashboard/activity', authenticate, getRecentActivity);

// Notifications — static route MUST come before parameterized /:id route
router.patch('/notifications/read-all', authenticate, markAllNotificationsRead);
router.get('/notifications', authenticate, getNotifications);
router.patch('/notifications/:id/read', authenticate, markNotificationRead);

// Reports
router.get('/reports/daily', authenticate, getDailyReport);
router.get('/reports/country-wise', authenticate, getCountryWiseReport);
router.get('/reports/rejection-reasons', authenticate, getRejectionReasonReport);

module.exports = router;
