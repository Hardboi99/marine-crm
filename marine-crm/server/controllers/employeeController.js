const bcrypt = require('bcryptjs');
const { Employee, Attendance, User, Worksheet, Task } = require('../models');
const { logActivity } = require('../utils/activityLogger');

const getTodayDateStr = () => new Date().toISOString().split('T')[0];

// ── Helper: resolve the Employee document for the calling user (BDM) ──────────
const getMyEmployee = async (userId) => {
  return Employee.findOne({ userId });
};

// ── Helper: is this an admin/HR request? ────────────────────────────────────
const isManager = (req) => ['ADMIN', 'HR'].includes(req.user.role);

// ─────────────────────────────────────────────────────────────────────────────
// LIST  GET /api/employees
//   Admin/HR → all employees
//   BDM      → only their own record
// ─────────────────────────────────────────────────────────────────────────────
const listEmployees = async (req, res, next) => {
  try {
    if (isManager(req)) {
      const employees = await Employee.find().sort({ createdAt: -1 });
      return res.json({ success: true, data: employees });
    }
    // BDM: return only own record
    const emp = await getMyEmployee(req.user.id);
    return res.json({ success: true, data: emp ? [emp] : [] });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────────────────────────────────────
// CREATE  POST /api/employees  (Admin/HR only — enforced by route middleware)
// ─────────────────────────────────────────────────────────────────────────────
const createEmployee = async (req, res, next) => {
  try {
    const { name, employeeId, phone, email, password, location, position, joinDate, dateOfBirth } = req.body;

    if (!name || !phone) {
      return res.status(400).json({ success: false, message: 'Name and phone are required.' });
    }

    // ── Determine final employeeId ──────────────────────────────────────────
    let finalEmployeeId = employeeId ? employeeId.trim() : null;
    if (!finalEmployeeId) {
      const count = await Employee.countDocuments();
      let candidate = `EMP-${String(count + 1).padStart(3, '0')}`;
      let exists = await Employee.findOne({ employeeId: candidate });
      let attempt = count + 1;
      while (exists) {
        attempt++;
        candidate = `EMP-${String(attempt).padStart(3, '0')}`;
        exists = await Employee.findOne({ employeeId: candidate });
      }
      finalEmployeeId = candidate;
    } else {
      const conflict = await Employee.findOne({ employeeId: finalEmployeeId });
      if (conflict) {
        return res.status(409).json({ success: false, message: `Employee ID "${finalEmployeeId}" is already in use.` });
      }
    }

    // ── Create Login User ────────────────────────────────────────────────────
    let userId = null;
    if (email && password) {
      const cleanEmail = email.toLowerCase().trim();
      let user = await User.findOne({ email: cleanEmail });
      if (!user) {
        const passwordHash = await bcrypt.hash(password.trim(), 12);
        user = await User.create({
          name: name.trim(), email: cleanEmail, passwordHash,
          role: 'BDM', phone: phone.trim(),
          department: position ? position.trim() : 'Sales',
          isActive: true
        });
      }
      userId = user._id;
    }

    const employee = await Employee.create({
      name: name.trim(), employeeId: finalEmployeeId,
      phone: phone.trim(),
      email: email ? email.toLowerCase().trim() : null,
      location: location ? location.trim() : null,
      position: position ? position.trim() : null,
      joinDate: joinDate ? new Date(joinDate) : null,
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
      userId,
      createdById: req.user.id,
      createdByName: req.user.name,
    });

    await logActivity({
      userId: req.user.id, entityType: 'EMPLOYEE',
      entityId: employee._id.toString(), action: 'CREATED',
      details: { name: employee.name, createdByRole: req.user.role },
    });

    res.status(201).json({ success: true, data: employee, message: 'Employee and login user created successfully.' });
  } catch (err) {
    if (err.code === 11000) {
      const field = Object.keys(err.keyPattern || {})[0] || 'field';
      return res.status(409).json({ success: false, message: `A record with this ${field} already exists.` });
    }
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// UPDATE  PUT /api/employees/:id  (Admin/HR only)
// ─────────────────────────────────────────────────────────────────────────────
const updateEmployee = async (req, res, next) => {
  try {
    const employee = await Employee.findById(req.params.id);
    if (!employee) return res.status(404).json({ success: false, message: 'Employee not found.' });

    const { name, phone, email, password, location, position, joinDate, employeeId, dateOfBirth } = req.body;
    if (name) employee.name = name.trim();
    if (phone) employee.phone = phone.trim();
    if (email !== undefined) employee.email = email ? email.toLowerCase().trim() : null;
    if (location !== undefined) employee.location = location ? location.trim() : null;
    if (position !== undefined) employee.position = position ? position.trim() : null;
    if (joinDate !== undefined) employee.joinDate = joinDate ? new Date(joinDate) : null;
    if (dateOfBirth !== undefined) employee.dateOfBirth = dateOfBirth ? new Date(dateOfBirth) : null;

    if (employeeId !== undefined && employeeId !== null && employeeId.trim() !== employee.employeeId) {
      const conflict = await Employee.findOne({ employeeId: employeeId.trim(), _id: { $ne: employee._id } });
      if (conflict) return res.status(409).json({ success: false, message: `Employee ID "${employeeId.trim()}" is already in use.` });
      employee.employeeId = employeeId.trim();
    }

    if (employee.userId && password) {
      const passwordHash = await bcrypt.hash(password.trim(), 12);
      await User.findByIdAndUpdate(employee.userId, { passwordHash });
    }

    await employee.save();

    await logActivity({
      userId: req.user.id, entityType: 'EMPLOYEE',
      entityId: employee._id.toString(), action: 'UPDATED',
      details: { name: employee.name, updatedByRole: req.user.role },
    });

    res.json({ success: true, data: employee, message: 'Employee updated successfully.' });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────────────────────────────────────
// DELETE  DELETE /api/employees/:id  (Admin/HR only)
// ─────────────────────────────────────────────────────────────────────────────
const deleteEmployee = async (req, res, next) => {
  try {
    const employee = await Employee.findById(req.params.id);
    if (!employee) return res.status(404).json({ success: false, message: 'Employee not found.' });
    await employee.deleteOne();
    await logActivity({
      userId: req.user.id, entityType: 'EMPLOYEE',
      entityId: req.params.id, action: 'DELETED',
      details: { deletedByRole: req.user.role },
    });
    res.json({ success: true, message: 'Employee deleted successfully.' });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────────────────────────────────────
// ATTENDANCE TODAY  GET /api/employees/attendance/today
//   Admin/HR → all records; BDM → only their own
// ─────────────────────────────────────────────────────────────────────────────
const getTodayAttendance = async (req, res, next) => {
  try {
    const today = getTodayDateStr();
    if (isManager(req)) {
      const records = await Attendance.find({ date: today });
      return res.json({ success: true, data: records });
    }
    // BDM: own attendance only
    const emp = await getMyEmployee(req.user.id);
    if (!emp) return res.json({ success: true, data: [] });
    const record = await Attendance.findOne({ employeeId: emp._id, date: today });
    return res.json({ success: true, data: record ? [record] : [] });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────────────────────────────────────
// CHECK-IN  POST /api/employees/checkin/:id
//   Admin/HR → any employee; BDM → only themselves
// ─────────────────────────────────────────────────────────────────────────────
const checkIn = async (req, res, next) => {
  try {
    const employeeId = req.params.id;

    // BDM: must match their own employee record
    if (!isManager(req)) {
      const myEmp = await getMyEmployee(req.user.id);
      if (!myEmp || myEmp._id.toString() !== employeeId) {
        return res.status(403).json({ success: false, message: 'You can only check in for yourself.' });
      }
    }

    const today = getTodayDateStr();
    let record = await Attendance.findOne({ employeeId, date: today });
    if (!record) {
      record = new Attendance({ employeeId, date: today, checkIn: new Date() });
    } else if (!record.checkIn) {
      record.checkIn = new Date();
    } else {
      return res.status(400).json({ success: false, message: 'Already checked in today.' });
    }
    await record.save();
    res.json({ success: true, data: record, message: 'Checked in successfully.' });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────────────────────────────────────
// CHECK-OUT  POST /api/employees/checkout/:id
//   Admin/HR → any employee; BDM → only themselves
// ─────────────────────────────────────────────────────────────────────────────
const checkOut = async (req, res, next) => {
  try {
    const employeeId = req.params.id;

    if (!isManager(req)) {
      const myEmp = await getMyEmployee(req.user.id);
      if (!myEmp || myEmp._id.toString() !== employeeId) {
        return res.status(403).json({ success: false, message: 'You can only check out for yourself.' });
      }
    }

    const today = getTodayDateStr();
    const record = await Attendance.findOne({ employeeId, date: today });
    if (!record || !record.checkIn) {
      return res.status(400).json({ success: false, message: 'Must check in before check out.' });
    }
    if (record.checkOut) {
      return res.status(400).json({ success: false, message: 'Already checked out today.' });
    }
    record.checkOut = new Date();
    await record.save();
    res.json({ success: true, data: record, message: 'Checked out successfully.' });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────────────────────────────────────
// WORKSHEETS
// ─────────────────────────────────────────────────────────────────────────────
const submitWorksheet = async (req, res, next) => {
  try {
    const { employeeId, summaryOfWork, callsMade, vesselsContacted, notes } = req.body;
    if (!employeeId || !summaryOfWork) {
      return res.status(400).json({ success: false, message: 'Employee and summary of work are required.' });
    }

    // BDM: can only submit for themselves
    if (!isManager(req)) {
      const myEmp = await getMyEmployee(req.user.id);
      if (!myEmp || myEmp._id.toString() !== employeeId) {
        return res.status(403).json({ success: false, message: 'You can only submit worksheets for yourself.' });
      }
    }

    const today = getTodayDateStr();
    const worksheet = await Worksheet.create({
      employeeId, userId: req.user.id, date: today,
      summaryOfWork: summaryOfWork.trim(),
      callsMade: callsMade ? Number(callsMade) : 0,
      vesselsContacted: vesselsContacted ? Number(vesselsContacted) : 0,
      notes: notes ? notes.trim() : '',
      submittedAt: new Date()
    });

    res.status(201).json({ success: true, data: worksheet, message: 'Worksheet submitted successfully.' });
  } catch (err) { next(err); }
};

const getWorksheets = async (req, res, next) => {
  try {
    let filter = {};
    if (isManager(req)) {
      // Admin/HR: optional filter by employeeId query param
      if (req.query.employeeId) filter.employeeId = req.query.employeeId;
    } else {
      // BDM: only their own worksheets
      const myEmp = await getMyEmployee(req.user.id);
      if (!myEmp) return res.json({ success: true, data: [] });
      filter.employeeId = myEmp._id;
    }
    const worksheets = await Worksheet.find(filter)
      .populate('employeeId', 'name position employeeId')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: worksheets });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────────────────────────────────────
// TASKS
// ─────────────────────────────────────────────────────────────────────────────
const createTask = async (req, res, next) => {
  try {
    const { title, description, assignedTo, priority, dueDate } = req.body;
    if (!title || !assignedTo) {
      return res.status(400).json({ success: false, message: 'Title and assigned employee are required.' });
    }
    const task = await Task.create({
      title: title.trim(),
      description: description ? description.trim() : '',
      assignedTo, assignedBy: req.user.id,
      assignedByName: req.user.name,
      priority: priority || 'MEDIUM',
      dueDate: dueDate ? new Date(dueDate) : null
    });
    res.status(201).json({ success: true, data: task, message: 'Task assigned successfully.' });
  } catch (err) { next(err); }
};

const getTasks = async (req, res, next) => {
  try {
    let filter = {};
    if (isManager(req)) {

      if (req.query.assignedTo) {
        filter.assignedTo = req.query.assignedTo;
      }

      if (req.query.status) {
        filter.status = req.query.status;
      }

      if (req.query.priority) {
        filter.priority = req.query.priority;
      }
    }

    else {
      // BDM: only tasks assigned to them
      const myEmp = await getMyEmployee(req.user.id);
      if (!myEmp) return res.json({ success: true, data: [] });
      filter.assignedTo = myEmp._id;
    }
    const tasks = await Task.find(filter)
      .populate('assignedTo', 'name position employeeId')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: tasks });
  } catch (err) { next(err); }
};

const updateTaskStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const task = await Task.findById(id).populate('assignedTo');
    if (!task) return res.status(404).json({ success: false, message: 'Task not found.' });

    // BDM: can only update tasks assigned to them
    if (!isManager(req)) {
      const myEmp = await getMyEmployee(req.user.id);
      const assignedToId = task.assignedTo?._id?.toString() || task.assignedTo?.toString();
      if (!myEmp || assignedToId !== myEmp._id.toString()) {
        return res.status(403).json({ success: false, message: 'You can only update your own tasks.' });
      }
    }

    task.status = status;
    if (status === 'COMPLETED') task.completedAt = new Date();
    await task.save();
    res.json({ success: true, data: task, message: 'Task status updated.' });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────────────────────────────────────
// MY PROFILE  GET /api/employees/me  (BDM convenience endpoint)
// ─────────────────────────────────────────────────────────────────────────────
const getMyProfile = async (req, res, next) => {
  try {
    const emp = await getMyEmployee(req.user.id);
    if (!emp) return res.status(404).json({ success: false, message: 'No employee profile found for your account.' });
    res.json({ success: true, data: emp });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────────────────────────────────────
// BULK IMPORT  POST /api/employees/bulk-import  (Admin/HR only)
// Expects: { rows: [{ name, position, phone, email, location, joinDate, dateOfBirth }] }
// Returns: { imported, skipped, failed, details }
// ─────────────────────────────────────────────────────────────────────────────
const bulkImportEmployees = async (req, res, next) => {
  try {
    const { rows } = req.body;
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ success: false, message: 'No rows provided.' });
    }

    let imported = 0, skipped = 0, failed = 0;
    const details = [];

    for (const [i, row] of rows.entries()) {
      const name = (row.name || row.Name || '').trim();
      const phone = (row.phone || row.Phone || '').toString().trim();
      const email = (row.email || row.Email || '').toString().toLowerCase().trim();
      const position = (row.position || row.Position || '').trim();
      const location = (row.location || row.Location || '').trim();
      const joinDateRaw = row.joinDate || row['Joining Date'] || row.joining_date || null;
      const dobRaw = row.dateOfBirth || row['Date of Birth'] || row.date_of_birth || null;

      if (!name || !phone) {
        failed++;
        details.push({ row: i + 1, status: 'failed', reason: 'Name and Phone required', name: name || '(blank)' });
        continue;
      }

      // Check duplicate: phone or email
      const dupFilter = email
        ? { $or: [{ phone }, { email }] }
        : { phone };
      const existing = await Employee.findOne(dupFilter);
      if (existing) {
        skipped++;
        details.push({ row: i + 1, status: 'skipped', reason: 'Duplicate phone/email', name });
        continue;
      }

      // Auto-generate Employee ID (reusing existing logic)
      const count = await Employee.countDocuments();
      let candidate = `EMP-${String(count + 1).padStart(3, '0')}`;
      let exists = await Employee.findOne({ employeeId: candidate });
      let attempt = count + 1;
      while (exists) {
        attempt++;
        candidate = `EMP-${String(attempt).padStart(3, '0')}`;
        exists = await Employee.findOne({ employeeId: candidate });
      }

      try {
        await Employee.create({
          name,
          employeeId: candidate,
          phone,
          email: email || null,
          position: position || null,
          location: location || null,
          joinDate: joinDateRaw ? new Date(joinDateRaw) : null,
          dateOfBirth: dobRaw ? new Date(dobRaw) : null,
          createdById: req.user.id,
          createdByName: req.user.name,
        });
        imported++;
        details.push({ row: i + 1, status: 'imported', name, employeeId: candidate });
      } catch (createErr) {
        failed++;
        details.push({ row: i + 1, status: 'failed', reason: createErr.message, name });
      }
    }

    res.json({ success: true, data: { imported, skipped, failed, details } });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────────────────────────────────────
// UPCOMING BIRTHDAYS  GET /api/employees/birthdays/upcoming  (Admin/HR only)
// Returns employees whose birthday falls today or in the next 30 days
// ─────────────────────────────────────────────────────────────────────────────
const getUpcomingBirthdays = async (req, res, next) => {
  try {
    const employees = await Employee.find({ dateOfBirth: { $ne: null } }).select('name position dateOfBirth email employeeId');
    const now = new Date();
    const todayMD = now.getMonth() * 100 + now.getDate(); // e.g. 0810 for Aug 10

    const results = [];
    for (const emp of employees) {
      const dob = new Date(emp.dateOfBirth);
      const empMonth = dob.getMonth();
      const empDay = dob.getDate();

      // Days until next birthday (handles year wrap)
      const thisYear = new Date(now.getFullYear(), empMonth, empDay);
      let diff = Math.ceil((thisYear - now) / (1000 * 60 * 60 * 24));
      if (diff < 0) {
        const nextYear = new Date(now.getFullYear() + 1, empMonth, empDay);
        diff = Math.ceil((nextYear - now) / (1000 * 60 * 60 * 24));
      }

      if (diff <= 30) {
        results.push({
          id: emp.id,
          name: emp.name,
          position: emp.position,
          employeeId: emp.employeeId,
          dateOfBirth: emp.dateOfBirth,
          daysUntil: diff,
          isToday: diff === 0,
        });
      }
    }

    results.sort((a, b) => a.daysUntil - b.daysUntil);
    res.json({ success: true, data: results });
  } catch (err) { next(err); }
};

module.exports = {
  listEmployees, createEmployee, updateEmployee, deleteEmployee,
  getTodayAttendance, checkIn, checkOut,
  submitWorksheet, getWorksheets,
  createTask, getTasks, updateTaskStatus,
  getMyProfile,
  bulkImportEmployees,
  getUpcomingBirthdays,
};
