const express = require('express');
const router = express.Router();
const { authenticate } = require('../middlewares/auth');
const { requireRole } = require('../middlewares/roleCheck');
const {
  listEmployees, createEmployee, updateEmployee, deleteEmployee,
  exitEmployee, reactivateEmployee,
  getTodayAttendance, getMyTodayAttendance, getAttendanceMonth, getAttendanceSummary, checkIn, checkOut,
  listHolidays, createHoliday, updateHoliday, deleteHoliday,
  submitWorksheet, getWorksheets, replyToWorksheet, respondToWorksheetReply,
  createTask, getTasks, updateTaskStatus,
  getMyProfile, updateMyProfile,
  bulkImportEmployees,
  getUpcomingBirthdays,
  checkMyBirthdayToday,
} = require('../controllers/employeeController');

// ── Own profile (self-service profile read/update) ───────────────────────────
router.get('/me', authenticate, getMyProfile);
router.get('/me/profile', authenticate, getMyProfile);
router.patch('/me/profile', authenticate, updateMyProfile);
router.put('/me/profile', authenticate, updateMyProfile);
router.get('/me/birthday-check', authenticate, checkMyBirthdayToday);

// ── Directory (filtered by role + ?status= inside handler) ────────────────────
router.get('/', authenticate, listEmployees);

// ── Attendance (filtered by role inside handler) ──────────────────────────────
router.get('/attendance/today',    authenticate, getTodayAttendance);
router.get('/attendance/me/today', authenticate, getMyTodayAttendance);
router.get('/attendance/month',    authenticate, getAttendanceMonth);
router.get('/attendance/summary',  authenticate, getAttendanceSummary);
router.post('/checkin/:id',     authenticate, checkIn);
router.post('/checkout/:id',    authenticate, checkOut);

// ── Holidays (read: everyone authenticated; write: ADMIN/HR only) ─────────────
router.get('/holidays',      authenticate, listHolidays);
router.post('/holidays',     authenticate, requireRole('ADMIN', 'HR'), createHoliday);
router.put('/holidays/:id',  authenticate, requireRole('ADMIN', 'HR'), updateHoliday);
router.delete('/holidays/:id', authenticate, requireRole('ADMIN', 'HR'), deleteHoliday);

// ── Worksheets (filtered by role inside handler) ──────────────────────────────
router.post('/worksheet',  authenticate, submitWorksheet);
router.get('/worksheets',  authenticate, getWorksheets);
router.patch('/worksheets/:id/reply',    authenticate, requireRole('ADMIN', 'DIRECTOR', 'COO'), replyToWorksheet);
router.patch('/worksheets/:id/response', authenticate, respondToWorksheetReply);

// ── Tasks (Admin/HR create; everyone can read/update own) ─────────────────────
router.post('/tasks',             authenticate, requireRole('ADMIN', 'HR'), createTask);
router.get('/tasks',              authenticate, getTasks);
router.patch('/tasks/:id/status', authenticate, updateTaskStatus);

// ── Exit / Reactivate (offboarding) — Admin/HR only ────────────────────────────────────────────────
router.route('/:id/exit')
  .patch(authenticate, requireRole('ADMIN', 'HR'), exitEmployee)
  .post(authenticate, requireRole('ADMIN', 'HR'), exitEmployee)
  .put(authenticate, requireRole('ADMIN', 'HR'), exitEmployee);

router.route('/:id/reactivate')
  .patch(authenticate, requireRole('ADMIN', 'HR'), reactivateEmployee)
  .post(authenticate, requireRole('ADMIN', 'HR'), reactivateEmployee)
  .put(authenticate, requireRole('ADMIN', 'HR'), reactivateEmployee);

// ── CRUD — Admin/HR only ───────────────────────────────────────────────────────────────────────────
router.post('/',    authenticate, requireRole('ADMIN', 'HR'), createEmployee);
router.put('/:id',  authenticate, requireRole('ADMIN', 'HR'), updateEmployee);
router.delete('/:id', authenticate, requireRole('ADMIN', 'HR'), deleteEmployee);

// ── Bulk Import — Admin/HR only ───────────────────────────────────────────────────────────────────────
router.post('/bulk-import', authenticate, requireRole('ADMIN', 'HR'), bulkImportEmployees);

// ── Birthdays — visible to all authenticated employees ─────────────────────────────────────────────────
router.get('/birthdays/upcoming', authenticate, getUpcomingBirthdays);

module.exports = router;