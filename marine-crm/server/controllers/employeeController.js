const bcrypt = require("bcryptjs");
const { Employee, Attendance, User, Worksheet, Task } = require("../models");
const { logActivity } = require("../utils/activityLogger");
const { generateVerificationToken, sendVerificationEmail } = require("../services/emailService");

const ALLOWED_ROLES = ['ADMIN', 'BDM', 'MANAGER_DOCS', 'MANAGER_SOURCING', 'HR'];
const getBaseUrl = (req) => `${req.protocol}://${req.get('host')}`;

const getTodayDateStr = () => new Date().toISOString().split("T")[0];

// ── Helper: resolve the Employee document for the calling user (BDM) ──────────
const getMyEmployee = async (userId) => {
  return Employee.findOne({ userId });
};

// ── Helper: is this an admin/HR request? ────────────────────────────────────
const isManager = (req) => ["ADMIN", "HR"].includes(req.user.role);

// ─────────────────────────────────────────────────────────────────────────────
// LIST  GET /api/employees
//   Admin/HR → all employees (optionally filtered by ?status=ACTIVE|EXITED|ALL)
//              defaults to ACTIVE only (exited employees are hidden unless asked)
//   BDM      → only their own record, regardless of status
// ─────────────────────────────────────────────────────────────────────────────
const listEmployees = async (req, res, next) => {
  try {
    if (isManager(req)) {
      const statusParam = (req.query.status || "").toUpperCase();
      let filter = {};
      if (statusParam === "EXITED") {
        filter.status = "EXITED";
      } else if (statusParam === "ALL") {
        // no filter — everyone
      } else {
        // default: active only (docs with no status field yet are treated as active)
        filter.status = { $ne: "EXITED" };
      }
      const employees = await Employee.find(filter).sort({ createdAt: -1 });

      // Enrich with emailVerified from linked User records
      const userIds = employees.map((e) => e.userId).filter(Boolean);
      const users = userIds.length
        ? await User.find({ _id: { $in: userIds } }).select('_id emailVerified role')
        : [];
      const userMap = {};
      users.forEach((u) => { userMap[u._id.toString()] = u; });

      const enriched = employees.map((e) => {
        const obj = e.toJSON();
        if (e.userId) {
          const u = userMap[e.userId.toString()];
          if (u) {
            obj.emailVerified = u.emailVerified;
            obj.userRole = u.role;
          }
        }
        return obj;
      });

      return res.json({ success: true, data: enriched });
    }
    // BDM: return only own record
    const emp = await getMyEmployee(req.user.id);
    return res.json({ success: true, data: emp ? [emp] : [] });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// CREATE  POST /api/employees  (Admin/HR only — enforced by route middleware)
// ─────────────────────────────────────────────────────────────────────────────
const createEmployee = async (req, res, next) => {
  try {
    const {
      name,
      employeeId,
      phone,
      email,
      password,
      role,
      location,
      position,
      joinDate,
      dateOfBirth,
    } = req.body;

    if (!name || !phone) {
      return res
        .status(400)
        .json({ success: false, message: "Name and phone are required." });
    }

    // Validate role if provided
    const assignedRole = role && ALLOWED_ROLES.includes(role) ? role : 'BDM';

    // ── Determine final employeeId ──────────────────────────────────────────
    let finalEmployeeId = employeeId ? employeeId.trim() : null;
    if (!finalEmployeeId) {
      const count = await Employee.countDocuments();
      let candidate = `EMP-${String(count + 1).padStart(3, "0")}`;
      let exists = await Employee.findOne({ employeeId: candidate });
      let attempt = count + 1;
      while (exists) {
        attempt++;
        candidate = `EMP-${String(attempt).padStart(3, "0")}`;
        exists = await Employee.findOne({ employeeId: candidate });
      }
      finalEmployeeId = candidate;
    } else {
      const conflict = await Employee.findOne({ employeeId: finalEmployeeId });
      if (conflict) {
        return res.status(409).json({
          success: false,
          message: `Employee ID "${finalEmployeeId}" is already in use.`,
        });
      }
    }

    // ── Create Login User with email verification ────────────────────────────
    let userId = null;
    let createdUserEmailVerified = undefined;
    if (email && password) {
      const cleanEmail = email.toLowerCase().trim();
      let user = await User.findOne({ email: cleanEmail });
      if (!user) {
        const passwordHash = await bcrypt.hash(password.trim(), 12);
        const { rawToken, hashedToken } = generateVerificationToken();
        user = await User.create({
          name: name.trim(),
          email: cleanEmail,
          passwordHash,
          role: assignedRole,
          phone: phone.trim(),
          department: position ? position.trim() : 'General',
          isActive: true,
          emailVerified: false,
          verificationToken: hashedToken,
          verificationTokenExpires: new Date(Date.now() + 24 * 60 * 60 * 1000),
          verificationSentAt: new Date(),
        });
        // Send verification email — non-blocking; employee is saved regardless
        sendVerificationEmail(user, rawToken, getBaseUrl(req)).catch(() => {});
      }
      userId = user._id;
      createdUserEmailVerified = user.emailVerified;
    }

    const employee = await Employee.create({
      name: name.trim(),
      employeeId: finalEmployeeId,
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
      userId: req.user.id,
      entityType: "EMPLOYEE",
      entityId: employee._id.toString(),
      action: "CREATED",
      details: { name: employee.name, role: assignedRole, createdByRole: req.user.role },
    });

    res.status(201).json({
      success: true,
      data: { ...employee.toJSON(), emailVerified: createdUserEmailVerified },
      message: email && password
        ? 'Employee created. A verification email has been sent to activate the login.'
        : 'Employee created successfully.',
    });
  } catch (err) {
    if (err.code === 11000) {
      const field = Object.keys(err.keyPattern || {})[0] || "field";
      return res.status(409).json({
        success: false,
        message: `A record with this ${field} already exists.`,
      });
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
    if (!employee)
      return res
        .status(404)
        .json({ success: false, message: "Employee not found." });

    const {
      name,
      phone,
      email,
      password,
      role,
      location,
      position,
      joinDate,
      employeeId,
      dateOfBirth,
    } = req.body;

    if (name) employee.name = name.trim();
    if (phone) employee.phone = phone.trim();
    if (location !== undefined)
      employee.location = location ? location.trim() : null;
    if (position !== undefined)
      employee.position = position ? position.trim() : null;
    if (joinDate !== undefined)
      employee.joinDate = joinDate ? new Date(joinDate) : null;
    if (dateOfBirth !== undefined)
      employee.dateOfBirth = dateOfBirth ? new Date(dateOfBirth) : null;

    if (
      employeeId !== undefined &&
      employeeId !== null &&
      employeeId.trim() !== employee.employeeId
    ) {
      const conflict = await Employee.findOne({
        employeeId: employeeId.trim(),
        _id: { $ne: employee._id },
      });
      if (conflict)
        return res.status(409).json({
          success: false,
          message: `Employee ID "${employeeId.trim()}" is already in use.`,
        });
      employee.employeeId = employeeId.trim();
    }

    // ── Sync linked User record ───────────────────────────────────────────────
    let updatedEmailVerified = undefined;
    if (employee.userId) {
      const linkedUser = await User.findById(employee.userId);
      if (linkedUser) {
        // Password change
        if (password) {
          linkedUser.passwordHash = await bcrypt.hash(password.trim(), 12);
        }

        // Role change (ADMIN/HR only — already enforced at route level)
        if (role && ALLOWED_ROLES.includes(role)) {
          linkedUser.role = role;
        }

        // Email change → reset verification and send new email
        const newEmail = email ? email.toLowerCase().trim() : null;
        const oldEmail = employee.email;
        if (newEmail && newEmail !== oldEmail) {
          const { rawToken, hashedToken } = generateVerificationToken();
          linkedUser.email = newEmail;
          linkedUser.emailVerified = false;
          linkedUser.verificationToken = hashedToken;
          linkedUser.verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
          linkedUser.verificationSentAt = new Date();
          await linkedUser.save();
          // Non-blocking send
          sendVerificationEmail(linkedUser, rawToken, getBaseUrl(req)).catch(() => {});
        } else {
          await linkedUser.save();
        }

        updatedEmailVerified = linkedUser.emailVerified;
      }
    }

    // Update email on employee record
    if (email !== undefined)
      employee.email = email ? email.toLowerCase().trim() : null;

    await employee.save();

    await logActivity({
      userId: req.user.id,
      entityType: "EMPLOYEE",
      entityId: employee._id.toString(),
      action: "UPDATED",
      details: { name: employee.name, updatedByRole: req.user.role },
    });

    res.json({
      success: true,
      data: { ...employee.toJSON(), emailVerified: updatedEmailVerified },
      message: "Employee updated successfully.",
    });
  } catch (err) {
    next(err);
  }
};


// ─────────────────────────────────────────────────────────────────────────────
// DELETE  DELETE /api/employees/:id  (Admin/HR only)
//   Hard delete — permanently removes the record. Prefer exitEmployee() below
//   for normal offboarding; this stays for genuine data-cleanup cases.
// ─────────────────────────────────────────────────────────────────────────────
const deleteEmployee = async (req, res, next) => {
  try {
    const employee = await Employee.findById(req.params.id);
    if (!employee)
      return res
        .status(404)
        .json({ success: false, message: "Employee not found." });
    await employee.deleteOne();
    await logActivity({
      userId: req.user.id,
      entityType: "EMPLOYEE",
      entityId: req.params.id,
      action: "DELETED",
      details: { deletedByRole: req.user.role },
    });
    res.json({ success: true, message: "Employee deleted successfully." });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// EXIT EMPLOYEE  PATCH /api/employees/:id/exit  (Admin/HR only)
//   Marks the employee as EXITED with a date + reason. Keeps the record (and
//   all its worksheet/attendance/task history) intact, just moves it out of
//   the active directory. Also disables their login if they had one.
// ─────────────────────────────────────────────────────────────────────────────
const exitEmployee = async (req, res, next) => {
  try {
    const employee = await Employee.findById(req.params.id);
    if (!employee)
      return res
        .status(404)
        .json({ success: false, message: "Employee not found." });

    if (employee.status === "EXITED") {
      return res
        .status(400)
        .json({ success: false, message: "Employee has already exited." });
    }

    const { exitDate, exitReason } = req.body;
    if (!exitDate) {
      return res
        .status(400)
        .json({ success: false, message: "Exit date is required." });
    }

    employee.status = "EXITED";
    employee.exitDate = new Date(exitDate);
    employee.exitReason = exitReason ? exitReason.trim() : null;
    employee.exitedById = req.user.id;
    employee.exitedByName = req.user.name;
    await employee.save();

    // Disable login access for the exited employee, if they have one
    if (employee.userId) {
      await User.findByIdAndUpdate(employee.userId, { isActive: false });
    }

    await logActivity({
      userId: req.user.id,
      entityType: "EMPLOYEE",
      entityId: employee._id.toString(),
      action: "EXITED",
      details: {
        name: employee.name,
        exitDate: employee.exitDate,
        exitReason: employee.exitReason,
        exitedByRole: req.user.role,
      },
    });

    res.json({
      success: true,
      data: employee,
      message: "Employee marked as exited.",
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// REACTIVATE EMPLOYEE  PATCH /api/employees/:id/reactivate  (Admin/HR only)
//   Reverses an exit — moves the employee back into the active directory and
//   re-enables their login, if they had one.
// ─────────────────────────────────────────────────────────────────────────────
const reactivateEmployee = async (req, res, next) => {
  try {
    const employee = await Employee.findById(req.params.id);
    if (!employee)
      return res
        .status(404)
        .json({ success: false, message: "Employee not found." });

    if (employee.status !== "EXITED") {
      return res
        .status(400)
        .json({ success: false, message: "Employee is not currently exited." });
    }

    employee.status = "ACTIVE";
    employee.exitDate = null;
    employee.exitReason = null;
    employee.exitedById = null;
    employee.exitedByName = null;
    await employee.save();

    if (employee.userId) {
      await User.findByIdAndUpdate(employee.userId, { isActive: true });
    }

    await logActivity({
      userId: req.user.id,
      entityType: "EMPLOYEE",
      entityId: employee._id.toString(),
      action: "REACTIVATED",
      details: { name: employee.name, reactivatedByRole: req.user.role },
    });

    res.json({
      success: true,
      data: employee,
      message: "Employee reactivated successfully.",
    });
  } catch (err) {
    next(err);
  }
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
    const record = await Attendance.findOne({
      employeeId: emp._id,
      date: today,
    });
    return res.json({ success: true, data: record ? [record] : [] });
  } catch (err) {
    next(err);
  }
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
        return res.status(403).json({
          success: false,
          message: "You can only check in for yourself.",
        });
      }
    }

    const empDoc = await Employee.findById(employeeId);
    if (!empDoc) {
      return res
        .status(404)
        .json({ success: false, message: "Employee not found." });
    }
    if (empDoc.status === "EXITED") {
      return res.status(400).json({
        success: false,
        message: "This employee has exited and cannot check in.",
      });
    }

    const today = getTodayDateStr();
    let record = await Attendance.findOne({ employeeId, date: today });
    if (!record) {
      record = new Attendance({ employeeId, date: today, checkIn: new Date() });
    } else if (!record.checkIn) {
      record.checkIn = new Date();
    } else {
      return res
        .status(400)
        .json({ success: false, message: "Already checked in today." });
    }
    await record.save();
    res.json({
      success: true,
      data: record,
      message: "Checked in successfully.",
    });
  } catch (err) {
    next(err);
  }
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
        return res.status(403).json({
          success: false,
          message: "You can only check out for yourself.",
        });
      }
    }

    const today = getTodayDateStr();
    const record = await Attendance.findOne({ employeeId, date: today });
    if (!record || !record.checkIn) {
      return res
        .status(400)
        .json({ success: false, message: "Must check in before check out." });
    }
    if (record.checkOut) {
      return res
        .status(400)
        .json({ success: false, message: "Already checked out today." });
    }
    record.checkOut = new Date();
    await record.save();
    res.json({
      success: true,
      data: record,
      message: "Checked out successfully.",
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// ATTENDANCE — helpers shared by the endpoints below
//
// These extend the SAME Attendance collection/architecture used by
// getTodayAttendance/checkIn/checkOut above (no new model, no new
// router). They exist to power the attendance.html page (today card,
// monthly calendar, monthly summary) and the navbar IN/OUT button,
// which need a normalized single-record shape and month/summary
// views that didn't exist yet.
// ─────────────────────────────────────────────────────────────────────────────

// Shape a raw Attendance doc the way the attendance UI expects.
// Storage still uses checkIn/checkOut (untouched); this is purely a
// response-time convenience so the frontend doesn't need its own
// duplicate time-math.
const normalizeAttendanceRecord = (doc) => {
  if (!doc) return null;
  const checkInTime = doc.checkIn || null;
  const checkOutTime = doc.checkOut || null;
  const totalMinutes =
    checkInTime && checkOutTime
      ? Math.round((new Date(checkOutTime) - new Date(checkInTime)) / 60000)
      : null;
  return {
    date: doc.date,
    status: checkInTime ? "PRESENT" : "NOT_MARKED",
    checkInTime,
    checkOutTime,
    totalMinutes,
    holidayName: null, // no Holiday system exists in this project yet
  };
};

// Resolve which employeeId a request is allowed to view.
//   - No ?employeeId= → always the caller's own Employee record.
//   - ?employeeId=X   → allowed only for ADMIN/HR (per existing
//                        isManager permissions); anyone else gets a
//                        403, even if X happens to equal their own id
//                        spelled differently — this is the "can't
//                        view another employee by editing the API
//                        request" rule enforced server-side.
const resolveEmployeeIdForQuery = async (req) => {
  const queryEmployeeId = (req.query.employeeId || "").trim();

  if (queryEmployeeId) {
    if (isManager(req)) {
      return { ok: true, employeeId: queryEmployeeId };
    }
    const myEmp = await getMyEmployee(req.user.id);
    if (!myEmp || myEmp._id.toString() !== queryEmployeeId) {
      return {
        ok: false,
        status: 403,
        message: "You can only view your own attendance.",
      };
    }
    return { ok: true, employeeId: queryEmployeeId };
  }

  const myEmp = await getMyEmployee(req.user.id);
  return { ok: true, employeeId: myEmp ? myEmp._id.toString() : null };
};

// Build a day-by-day view of a month for one employee: real Attendance
// docs where they exist, and (for past working days with no record,
// after the employee's join date) a synthesized ABSENT entry — since
// this project has no absence-marking or holiday system yet, this is
// the closest reasonable approximation without inventing new storage.
const buildMonthAttendance = async (employeeId, year, month) => {
  const monthStr = String(month).padStart(2, "0");
  const prefix = `${year}-${monthStr}-`;

  const records = await Attendance.find({
    employeeId,
    date: { $gte: `${prefix}01`, $lte: `${prefix}31` },
  }).sort({ date: 1 });

  const recordMap = {};
  records.forEach((r) => {
    recordMap[r.date] = r;
  });

  const empDoc = await Employee.findById(employeeId).select("joinDate");
  const joinDateStr = empDoc && empDoc.joinDate
    ? new Date(empDoc.joinDate).toISOString().split("T")[0]
    : null;

  const daysInMonth = new Date(year, month, 0).getDate();
  const todayStr = getTodayDateStr();

  const result = [];
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${monthStr}-${String(day).padStart(2, "0")}`;
    if (dateStr > todayStr) continue; // future — no data yet
    if (joinDateStr && dateStr < joinDateStr) continue; // before they joined

    const doc = recordMap[dateStr];
    if (doc) {
      result.push(normalizeAttendanceRecord(doc));
    } else if (dateStr !== todayStr) {
      result.push({
        date: dateStr,
        status: "ABSENT",
        checkInTime: null,
        checkOutTime: null,
        totalMinutes: null,
        holidayName: null,
      });
    }
    // today with no record yet is intentionally omitted — the
    // frontend already renders "today, no data" via the live ring.
  }
  return result;
};

// ─────────────────────────────────────────────────────────────────────────────
// MY TODAY ATTENDANCE (normalized)  GET /api/employees/attendance/me/today
//   Self → own record; Admin/HR may pass ?employeeId= to view another.
//   Used by the navbar IN/OUT button and the attendance page's "Today" card.
// ─────────────────────────────────────────────────────────────────────────────
const getMyTodayAttendance = async (req, res, next) => {
  try {
    const resolved = await resolveEmployeeIdForQuery(req);
    if (!resolved.ok) {
      return res.status(resolved.status).json({ success: false, message: resolved.message });
    }
    if (!resolved.employeeId) {
      return res.json({ success: true, data: null });
    }
    const today = getTodayDateStr();
    const record = await Attendance.findOne({ employeeId: resolved.employeeId, date: today });
    res.json({ success: true, data: normalizeAttendanceRecord(record) });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// MONTHLY ATTENDANCE  GET /api/employees/attendance/month?year=&month=&employeeId=
//   Powers the attendance calendar. Same access rules as above.
// ─────────────────────────────────────────────────────────────────────────────
const getAttendanceMonth = async (req, res, next) => {
  try {
    const year = parseInt(req.query.year, 10);
    const month = parseInt(req.query.month, 10);
    if (!year || !month || month < 1 || month > 12) {
      return res.status(400).json({
        success: false,
        message: "Valid year and month query params are required.",
      });
    }

    const resolved = await resolveEmployeeIdForQuery(req);
    if (!resolved.ok) {
      return res.status(resolved.status).json({ success: false, message: resolved.message });
    }
    if (!resolved.employeeId) {
      return res.json({ success: true, data: [] });
    }

    const data = await buildMonthAttendance(resolved.employeeId, year, month);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// MONTHLY SUMMARY  GET /api/employees/attendance/summary?year=&month=&employeeId=
//   Powers the present/absent/holiday/hours cards atop the attendance page.
// ─────────────────────────────────────────────────────────────────────────────
const getAttendanceSummary = async (req, res, next) => {
  try {
    const year = parseInt(req.query.year, 10);
    const month = parseInt(req.query.month, 10);
    if (!year || !month || month < 1 || month > 12) {
      return res.status(400).json({
        success: false,
        message: "Valid year and month query params are required.",
      });
    }

    const resolved = await resolveEmployeeIdForQuery(req);
    if (!resolved.ok) {
      return res.status(resolved.status).json({ success: false, message: resolved.message });
    }
    if (!resolved.employeeId) {
      return res.json({
        success: true,
        data: { presentDays: 0, absentDays: 0, holidays: 0, totalMinutes: 0, averageMinutes: 0 },
      });
    }

    const records = await buildMonthAttendance(resolved.employeeId, year, month);

    let presentDays = 0, absentDays = 0, holidays = 0, totalMinutes = 0, presentWithHoursCount = 0;
    records.forEach((r) => {
      if (r.status === "PRESENT") {
        presentDays += 1;
        if (r.totalMinutes) {
          totalMinutes += r.totalMinutes;
          presentWithHoursCount += 1;
        }
      } else if (r.status === "ABSENT") {
        absentDays += 1;
      } else if (r.status === "HOLIDAY") {
        holidays += 1;
      }
    });
    const averageMinutes = presentWithHoursCount
      ? Math.round(totalMinutes / presentWithHoursCount)
      : 0;

    res.json({
      success: true,
      data: {
        presentDays,
        absentDays,
        holidays,
        totalMinutes: Math.round(totalMinutes),
        averageMinutes,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// WORKSHEETS
// ─────────────────────────────────────────────────────────────────────────────
const submitWorksheet = async (req, res, next) => {
  try {
    const { employeeId, summaryOfWork, callsMade, vesselsContacted, notes } =
      req.body;
    if (!employeeId || !summaryOfWork) {
      return res.status(400).json({
        success: false,
        message: "Employee and summary of work are required.",
      });
    }

    // BDM: can only submit for themselves
    if (!isManager(req)) {
      const myEmp = await getMyEmployee(req.user.id);
      if (!myEmp || myEmp._id.toString() !== employeeId) {
        return res.status(403).json({
          success: false,
          message: "You can only submit worksheets for yourself.",
        });
      }
    }

    const today = getTodayDateStr();
    const worksheet = await Worksheet.create({
      employeeId,
      userId: req.user.id,
      date: today,
      summaryOfWork: summaryOfWork.trim(),
      callsMade: callsMade ? Number(callsMade) : 0,
      vesselsContacted: vesselsContacted ? Number(vesselsContacted) : 0,
      notes: notes ? notes.trim() : "",
      submittedAt: new Date(),
    });

    res.status(201).json({
      success: true,
      data: worksheet,
      message: "Worksheet submitted successfully.",
    });
  } catch (err) {
    next(err);
  }
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
      .populate("employeeId", "name position employeeId")
      .sort({ createdAt: -1 });
    res.json({ success: true, data: worksheets });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// TASKS
// ─────────────────────────────────────────────────────────────────────────────
const createTask = async (req, res, next) => {
  try {
    const { title, description, assignedTo, priority, dueDate } = req.body;
    if (!title || !assignedTo) {
      return res.status(400).json({
        success: false,
        message: "Title and assigned employee are required.",
      });
    }
    const task = await Task.create({
      title: title.trim(),
      description: description ? description.trim() : "",
      assignedTo,
      assignedBy: req.user.id,
      assignedByName: req.user.name,
      priority: priority || "MEDIUM",
      dueDate: dueDate ? new Date(dueDate) : null,
    });
    res.status(201).json({
      success: true,
      data: task,
      message: "Task assigned successfully.",
    });
  } catch (err) {
    next(err);
  }
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
    } else {
      // BDM: only tasks assigned to them
      const myEmp = await getMyEmployee(req.user.id);
      if (!myEmp) return res.json({ success: true, data: [] });
      filter.assignedTo = myEmp._id;
    }
    const tasks = await Task.find(filter)
      .populate("assignedTo", "name position employeeId")
      .sort({ createdAt: -1 });
    res.json({ success: true, data: tasks });
  } catch (err) {
    next(err);
  }
};

const updateTaskStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const task = await Task.findById(id).populate("assignedTo");
    if (!task)
      return res
        .status(404)
        .json({ success: false, message: "Task not found." });

    // BDM: can only update tasks assigned to them
    if (!isManager(req)) {
      const myEmp = await getMyEmployee(req.user.id);
      const assignedToId =
        task.assignedTo?._id?.toString() || task.assignedTo?.toString();
      if (!myEmp || assignedToId !== myEmp._id.toString()) {
        return res.status(403).json({
          success: false,
          message: "You can only update your own tasks.",
        });
      }
    }

    task.status = status;
    if (status === "COMPLETED") task.completedAt = new Date();
    await task.save();
    res.json({ success: true, data: task, message: "Task status updated." });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// MY PROFILE  GET /api/employees/me  (BDM convenience endpoint)
// ─────────────────────────────────────────────────────────────────────────────
const getMyProfile = async (req, res, next) => {
  try {
    const emp = await getMyEmployee(req.user.id);
    if (!emp)
      return res.status(404).json({
        success: false,
        message: "No employee profile found for your account.",
      });
    res.json({ success: true, data: emp });
  } catch (err) {
    next(err);
  }
};

const checkMyBirthdayToday = async (req, res, next) => {
  try {
    const emp = await getMyEmployee(req.user.id);
    if (!emp || !emp.dateOfBirth) {
      return res.json({ success: true, data: { isBirthdayToday: false } });
    }
    const now = new Date();
    const dob = new Date(emp.dateOfBirth);
    const isBirthdayToday =
      dob.getUTCMonth() === now.getUTCMonth() &&
      dob.getUTCDate() === now.getUTCDate();
    res.json({
      success: true,
      data: { isBirthdayToday, firstName: emp.name.split(" ")[0] },
    });
  } catch (err) {
    next(err);
  }
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
      return res
        .status(400)
        .json({ success: false, message: "No rows provided." });
    }

    let imported = 0,
      skipped = 0,
      failed = 0;
    const details = [];

    for (const [i, row] of rows.entries()) {
      const name = (row.name || row.Name || "").trim();
      const phone = (row.phone || row.Phone || "").toString().trim();
      const email = (row.email || row.Email || "")
        .toString()
        .toLowerCase()
        .trim();
      const position = (row.position || row.Position || "").trim();
      const location = (row.location || row.Location || "").trim();
      const joinDateRaw =
        row.joinDate || row["Joining Date"] || row.joining_date || null;
      const dobRaw =
        row.dateOfBirth || row["Date of Birth"] || row.date_of_birth || null;

      if (!name || !phone) {
        failed++;
        details.push({
          row: i + 1,
          status: "failed",
          reason: "Name and Phone required",
          name: name || "(blank)",
        });
        continue;
      }

      // Check duplicate: phone or email
      const dupFilter = email ? { $or: [{ phone }, { email }] } : { phone };
      const existing = await Employee.findOne(dupFilter);
      if (existing) {
        skipped++;
        details.push({
          row: i + 1,
          status: "skipped",
          reason: "Duplicate phone/email",
          name,
        });
        continue;
      }

      // Auto-generate Employee ID (reusing existing logic)
      const count = await Employee.countDocuments();
      let candidate = `EMP-${String(count + 1).padStart(3, "0")}`;
      let exists = await Employee.findOne({ employeeId: candidate });
      let attempt = count + 1;
      while (exists) {
        attempt++;
        candidate = `EMP-${String(attempt).padStart(3, "0")}`;
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
        details.push({
          row: i + 1,
          status: "imported",
          name,
          employeeId: candidate,
        });
      } catch (createErr) {
        failed++;
        details.push({
          row: i + 1,
          status: "failed",
          reason: createErr.message,
          name,
        });
      }
    }

    res.json({ success: true, data: { imported, skipped, failed, details } });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// UPCOMING BIRTHDAYS  GET /api/employees/birthdays/upcoming
// Returns employees whose birthday falls today or in the next 30 days.
// Only considers active employees.
// ─────────────────────────────────────────────────────────────────────────────
const getUpcomingBirthdays = async (req, res, next) => {
  try {
    const employees = await Employee.find({
      dateOfBirth: { $ne: null },
      status: { $ne: "EXITED" },
    }).select("name position dateOfBirth email employeeId");
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
  } catch (err) {
    next(err);
  }
};

module.exports = {
  listEmployees,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  exitEmployee,
  reactivateEmployee,
  getTodayAttendance,
  getMyTodayAttendance,
  getAttendanceMonth,
  getAttendanceSummary,
  checkIn,
  checkOut,
  submitWorksheet,
  getWorksheets,
  createTask,
  getTasks,
  updateTaskStatus,
  getMyProfile,
  bulkImportEmployees,
  getUpcomingBirthdays,
  checkMyBirthdayToday,
};