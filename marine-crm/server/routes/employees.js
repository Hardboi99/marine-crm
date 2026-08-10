const express = require('express');
const router = express.Router();
const { authenticate } = require('../middlewares/auth');
const { requireRole } = require('../middlewares/roleCheck');
const {
  listEmployees, createEmployee, updateEmployee, deleteEmployee,
  getTodayAttendance, checkIn, checkOut,
  submitWorksheet, getWorksheets,
  createTask, getTasks, updateTaskStatus,
  getMyProfile,
  bulkImportEmployees,
  getUpcomingBirthdays,
  checkMyBirthdayToday,
} = require('../controllers/employeeController');

// ── Own profile (BDM convenience) ────────────────────────────────────────────
router.get('/me', authenticate, getMyProfile);
router.get('/me/birthday-check', authenticate, checkMyBirthdayToday);

// ── Directory (filtered by role inside handler) ───────────────────────────────
router.get('/', authenticate, listEmployees);

// ── Attendance (filtered by role inside handler) ──────────────────────────────
router.get('/attendance/today', authenticate, getTodayAttendance);
router.post('/checkin/:id',     authenticate, checkIn);
router.post('/checkout/:id',    authenticate, checkOut);

// ── Worksheets (filtered by role inside handler) ──────────────────────────────
router.post('/worksheet',  authenticate, submitWorksheet);
router.get('/worksheets',  authenticate, getWorksheets);

// ── Tasks (Admin/HR create; everyone can read/update own) ─────────────────────
router.post('/tasks',             authenticate, requireRole('ADMIN', 'HR'), createTask);
router.get('/tasks',              authenticate, getTasks);
router.patch('/tasks/:id/status', authenticate, updateTaskStatus);

// ── CRUD — Admin/HR only ───────────────────────────────────────────────────────────────────────────
router.post('/',    authenticate, requireRole('ADMIN', 'HR'), createEmployee);
router.put('/:id',  authenticate, requireRole('ADMIN', 'HR'), updateEmployee);
router.delete('/:id', authenticate, requireRole('ADMIN', 'HR'), deleteEmployee);

// ── Bulk Import — Admin/HR only ───────────────────────────────────────────────────────────────────────
router.post('/bulk-import', authenticate, requireRole('ADMIN', 'HR'), bulkImportEmployees);

// ── Birthdays — Admin/HR only ────────────────────────────────────────────────────────────────────────
router.get('/birthdays/upcoming', authenticate, requireRole('ADMIN', 'HR'), getUpcomingBirthdays);

module.exports = router;
