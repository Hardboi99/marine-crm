const bcrypt = require("bcryptjs");
const { Employee, Attendance, Holiday, User, Worksheet, Task, Notification } = require("../models");
const { logActivity } = require("../utils/activityLogger");
const { generateVerificationToken, sendVerificationEmail } = require("../services/emailService");

const { ALL_ROLES, ROLE_GROUPS } = require("../utils/roles");

const getBaseUrl = (req) => `${req.protocol}://${req.get('host')}`;

const getTodayDateStr = () => new Date().toISOString().split("T")[0];

// ── Helper: resolve the Employee document for the calling user ──────────
const getMyEmployee = async (userId, email) => {
  let emp = await Employee.findOne({ userId });
  if (!emp && email) {
    emp = await Employee.findOne({ email: email.toLowerCase().trim() });
  }
  return emp;
};

// ── Helper: is this an admin/HR request? ────────────────────────────────────
const isManager = (req) => ["ADMIN", "HR"].includes(req.user.role);

// ── Helper: can this request see/manage EVERY employee's worksheets? ───────
// Deliberately narrower than isManager() — HR manages employee CRUD/tasks/
// holidays but, per the worksheet-visibility spec, only ever sees its own
// worksheets, same as BDM/Recruitment/Crewing.
const canManageAllWorksheets = (req) => ROLE_GROUPS.WORKSHEET_ALL_ACCESS.includes(req.user.role);

// ── Helper: is this role excluded from attendance entirely (Founder)? ──────
const isAttendanceExempt = (role) => ROLE_GROUPS.ATTENDANCE_EXCLUDED.includes(role);

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
    if (role && !ALL_ROLES.includes(role)) {
      return res.status(400).json({
        success: false,
        message: `Invalid role "${role}". Allowed roles are: ${ALL_ROLES.join(', ')}`,
      });
    }
    const assignedRole = role || 'BDM';

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
        if (role) {
          if (!ALL_ROLES.includes(role)) {
            return res.status(400).json({
              success: false,
              message: `Invalid role "${role}". Allowed roles are: ${ALL_ROLES.join(', ')}`,
            });
          }
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
// LOCATION — optional, captured only at check-in/check-out (no background
// or continuous tracking)
// ─────────────────────────────────────────────────────────────────────────────
// ── Helper: validate + resolve an optional check-in/out location ──────────────
// Location is OPTIONAL at this layer — employee.html's existing admin-driven
// checkin/checkout (marking attendance for someone else from the directory)
// never sends coordinates, and must keep working exactly as before. It's
// only ever populated by the employee's own self-service check-in/out,
// where the browser Geolocation API supplies real coordinates client-side.
//
// This can't stop someone from spoofing GPS at the OS level — no server can
// — but it does the validation that's actually possible here: reject
// anything that isn't a real, in-range coordinate pair.
const https = require("https");

const isValidCoordinate = (lat, lng) =>
  typeof lat === "number" && typeof lng === "number" &&
  Number.isFinite(lat) && Number.isFinite(lng) &&
  lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;

// Best-effort reverse geocode via OpenStreetMap's Nominatim (no API key,
// no new dependency — uses Node's built-in https). If it fails or times
// out, the check-in/out itself still proceeds with the raw coordinates;
// only the human-readable address is left null, since the actual GPS
// fix (already validated above) is the source of truth, not the label.
const reverseGeocode = (lat, lng) =>
  new Promise((resolve) => {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=14&addressdetails=1`;
    const req = https.get(
      url,
      { headers: { "User-Agent": "MarineCRM-Attendance/1.0" }, timeout: 4000 },
      (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => {
          try {
            const parsed = JSON.parse(body);
            const a = parsed.address || {};
            const locality = a.suburb || a.neighbourhood || a.village || a.town || a.city_district || null;
            const city = a.city || a.town || a.county || null;
            const parts = [locality, city, a.state, a.country].filter(Boolean);
            resolve(parts.length ? parts.join(", ") : parsed.display_name || null);
          } catch {
            resolve(null);
          }
        });
      }
    );
    req.on("timeout", () => req.destroy());
    req.on("error", () => resolve(null));
  });

// ── Office geofence (500m, Haversine) ─────────────────────────────────────────
// Fixed center point provided by the company. Authoritative check happens
// here, server-side — the frontend only ever displays the distance for
// user feedback, never enforces it.
const OFFICE_LATITUDE = 19.0158689625056;
const OFFICE_LONGITUDE = 73.03920102540052;
const OFFICE_RADIUS_METERS = 500;

const haversineDistanceMeters = (lat1, lon1, lat2, lon2) => {
  const R = 6371000; // Earth radius in meters
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// Returns null if inside the geofence (no violation), otherwise an object describing violation/distance.
const checkGeofence = (locationOrLat, maybeLng) => {
  let lat, lng;
  if (typeof locationOrLat === "number" && typeof maybeLng === "number") {
    lat = locationOrLat;
    lng = maybeLng;
  } else if (locationOrLat && typeof locationOrLat === "object") {
    lat = locationOrLat.latitude;
    lng = locationOrLat.longitude;
  }

  if (typeof lat !== "number" || typeof lng !== "number" || isNaN(lat) || isNaN(lng)) {
    return { inRange: false, distance: Infinity, missing: true };
  }

  const distance = haversineDistanceMeters(
    lat, lng, OFFICE_LATITUDE, OFFICE_LONGITUDE
  );
  if (distance <= OFFICE_RADIUS_METERS) return null;
  return { inRange: false, distance: Math.round(distance) };
};

const resolveLocationFromBody = async (body, allowMissing = false) => {
  if (body == null || (body.latitude === undefined && body.longitude === undefined)) {
    if (allowMissing) return { ok: true, location: null };
    return { ok: false, missing: true };
  }
  const lat = typeof body.latitude === "string" ? parseFloat(body.latitude) : body.latitude;
  const lng = typeof body.longitude === "string" ? parseFloat(body.longitude) : body.longitude;
  if (lat === undefined || lng === undefined || isNaN(lat) || isNaN(lng) || !isValidCoordinate(lat, lng)) {
    return { ok: false, invalid: true };
  }
  const address = await reverseGeocode(lat, lng);
  return { ok: true, location: { latitude: lat, longitude: lng, address, capturedAt: new Date() } };
};

// If a saved location has coordinates but no address yet (e.g. Nominatim
// was briefly unreachable when it was first captured), look it up now and
// persist it so it's cached for next time. Returns the (possibly updated)
// location object; never throws.
const ensureLocationAddress = async (location) => {
  if (!location || location.address) return location;
  const address = await reverseGeocode(location.latitude, location.longitude);
  if (address) location.address = address;
  return location;
};

// ── Company attendance policy (Working Days: Mon–Sat, 10:00 AM start) ────────
// All times are interpreted in IST (UTC+5:30) — the whole app/company
// context (Marine CRM, Belapur/Navi Mumbai) is India-based and there is no
// per-company timezone setting anywhere in this project, so this is the
// one explicit assumption; change IST_OFFSET_MINUTES if that's wrong.
const IST_OFFSET_MINUTES = 5 * 60 + 30;
const DAY_START_MINUTES = 10 * 60;      // 10:00 AM — on-time / late-mark cutoff
const FULL_DAY_MINUTES = 9 * 60;        // 540 minutes — the ONLY thing that decides Full vs Half Day

const getIstMinutesOfDay = (date) => {
  const istMs = date.getTime() + IST_OFFSET_MINUTES * 60 * 1000;
  const ist = new Date(istMs);
  return ist.getUTCHours() * 60 + ist.getUTCMinutes();
};

// Late Mark is independent of Full/Half Day — it's purely "did they arrive
// after 10:00 AM IST". 3 Late Marks = 1 Half Day, but that's a MONTH-END
// derived count (see getAttendanceSummary), never a same-day reclassification.
const isLateCheckIn = (checkInDate) => getIstMinutesOfDay(checkInDate) > DAY_START_MINUTES;

// Final Full Day / Half Day classification — decided ONLY at checkout, from
// the ACTUAL worked duration (checkOut − checkIn), never from check-in time
// alone. This is intentionally the single source of truth used both to
// pick which worksheet to open and to store the final dayType:
//   totalWorkingMinutes >= 540 (9h) → FULL_DAY
//   totalWorkingMinutes <  540      → HALF_DAY
const classifyByDuration = (totalWorkingMinutes) =>
  totalWorkingMinutes >= FULL_DAY_MINUTES ? "FULL_DAY" : "HALF_DAY";

// ─────────────────────────────────────────────────────────────────────────────
// CHECK-IN  POST /api/employees/checkin/:id
//   Admin/HR → any employee; Other roles → only themselves
// ─────────────────────────────────────────────────────────────────────────────
const checkIn = async (req, res, next) => {
  try {
    const employeeId = req.params.id;

    // Founder (DIRECTOR) is monitoring-only — never creates attendance,
    // for themselves or (since isManager doesn't include DIRECTOR anyway)
    // anyone else.
    if (isAttendanceExempt(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Founders do not have attendance check-in/out — this role only monitors reports.",
      });
    }

    // Must match their own employee record unless Admin/HR
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

    const allowMissing = isManager(req) && (req.body.latitude === undefined && req.body.longitude === undefined);
    const locationResult = await resolveLocationFromBody(req.body, allowMissing);
    if (!locationResult.ok) {
      return res.status(400).json({
        success: false,
        message: locationResult.missing
          ? "Location coordinates (latitude and longitude) are required for check-in."
          : "Invalid location coordinates.",
      });
    }

    if (locationResult.location) {
      const geofenceViolation = checkGeofence(locationResult.location);
      if (geofenceViolation) {
        return res.status(403).json({
          success: false,
          message: `Check In is not allowed. You must be within ${OFFICE_RADIUS_METERS} meters of the office. Distance from office: ${geofenceViolation.distance} meters.`,
          distanceMeters: geofenceViolation.distance,
          radiusMeters: OFFICE_RADIUS_METERS,
        });
      }
    }

    const today = getTodayDateStr();
    let record = await Attendance.findOne({ employeeId, date: today });
    const checkInAt = new Date();
    const isLate = isLateCheckIn(checkInAt);
    if (!record) {
      record = new Attendance({
        employeeId,
        date: today,
        checkIn: checkInAt,
        checkInLocation: locationResult.location,
        isLate,
      });
    } else if (!record.checkIn) {
      record.checkIn = checkInAt;
      record.checkInLocation = locationResult.location;
      record.isLate = isLate;
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
    if (err.code === 11000) {
      return res.status(400).json({ success: false, message: "Already checked in today." });
    }
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// CHECK-OUT  POST /api/employees/checkout/:id
//   Admin/HR → any employee; Other roles → only themselves
// ─────────────────────────────────────────────────────────────────────────────
const checkOut = async (req, res, next) => {
  try {
    const employeeId = req.params.id;

    if (isAttendanceExempt(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Founders do not have attendance check-in/out — this role only monitors reports.",
      });
    }

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

    const allowMissing = isManager(req) && (req.body.latitude === undefined && req.body.longitude === undefined);
    const locationResult = await resolveLocationFromBody(req.body, allowMissing);
    if (!locationResult.ok) {
      return res.status(400).json({
        success: false,
        message: locationResult.missing
          ? "Location coordinates (latitude and longitude) are required for check-out."
          : "Invalid location coordinates.",
      });
    }

    if (locationResult.location) {
      const geofenceViolation = checkGeofence(locationResult.location);
      if (geofenceViolation) {
        return res.status(403).json({
          success: false,
          message: `Check Out is not allowed. You must be within ${OFFICE_RADIUS_METERS} meters of the office. Distance from office: ${geofenceViolation.distance} meters.`,
          distanceMeters: geofenceViolation.distance,
          radiusMeters: OFFICE_RADIUS_METERS,
        });
      }
    }

    const checkOutAt = new Date();
    const totalWorkingMinutes = Math.round((checkOutAt - record.checkIn) / 60000);
    record.checkOut = checkOutAt;
    record.checkOutLocation = locationResult.location;
    record.dayType = classifyByDuration(totalWorkingMinutes);
    await record.save();
    await Worksheet.updateMany(
      { employeeId, date: today },
      { $set: { dayType: record.dayType } }
    ).catch(() => {}); // best-effort; never blocks checkout itself
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
// Shape a raw Attendance doc the way the attendance UI expects.
// Storage still uses checkIn/checkOut (untouched); this is purely a
// response-time convenience so the frontend doesn't need its own
// duplicate time-math. Async because it opportunistically backfills a
// missing reverse-geocoded address (see ensureLocationAddress above).
const normalizeAttendanceRecord = async (doc) => {
  if (!doc) return null;
  const checkInTime = doc.checkIn || null;
  const checkOutTime = doc.checkOut || null;
  const totalMinutes =
    checkInTime && checkOutTime
      ? Math.round((new Date(checkOutTime) - new Date(checkInTime)) / 60000)
      : null;

  let checkInLocation = doc.checkInLocation || null;
  let checkOutLocation = doc.checkOutLocation || null;
  let addressBackfilled = false;
  if (checkInLocation && !checkInLocation.address) {
    checkInLocation = await ensureLocationAddress({ ...checkInLocation });
    if (checkInLocation.address) addressBackfilled = true;
  }
  if (checkOutLocation && !checkOutLocation.address) {
    checkOutLocation = await ensureLocationAddress({ ...checkOutLocation });
    if (checkOutLocation.address) addressBackfilled = true;
  }
  // Persist the backfilled address so we don't re-geocode on every read.
  if (addressBackfilled && doc.save) {
    doc.checkInLocation = checkInLocation;
    doc.checkOutLocation = checkOutLocation;
    doc.save().catch(() => {}); // best-effort cache write; never blocks the response
  }

  const dayType = doc.dayType || "FULL_DAY";
  const status = checkInTime ? (dayType === "HALF_DAY" ? "HALF_DAY" : "PRESENT") : "NOT_MARKED";

  return {
    date: doc.date,
    status,
    dayType,
    isLate: !!doc.isLate,
    checkInTime,
    checkOutTime,
    totalMinutes,
    holidayName: null, // no Holiday system exists in this project yet
    checkInLocation,
    checkOutLocation,
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
    const myEmp = await getMyEmployee(req.user.id, req.user?.email);
    if (!myEmp || myEmp._id.toString() !== queryEmployeeId) {
      return {
        ok: false,
        status: 403,
        message: "You can only view your own attendance.",
      };
    }
    return { ok: true, employeeId: queryEmployeeId };
  }

  const myEmp = await getMyEmployee(req.user.id, req.user?.email);
  return { ok: true, employeeId: myEmp ? myEmp._id.toString() : null };
};

// Build a day-by-day view of a month for one employee: real Attendance
// docs where they exist, and (for past working days with no record,
// after the employee's join date) a synthesized ABSENT entry — since
// this project has no absence-marking or holiday system yet, this is
// the closest reasonable approximation without inventing new storage.
// Default weekly off — Saturday(6) / Sunday(0). There is no working-days,
// weekly-off, or HR-settings config anywhere in this project (Employee and
// User schemas have neither), so this is the standard 5-day-week default,
// applied explicitly here rather than silently assumed. If the company's
// actual schedule differs, this is the one place to change it.
// Company policy: Working Days are Monday → Saturday, so Sunday is the
// only weekly off. (Was Saturday+Sunday before the company policy was
// provided — updated to match.)
const WEEK_OFF_DAYS = [0]; // Sun only

const buildMonthAttendance = async (employeeId, year, month) => {
  const monthStr = String(month).padStart(2, "0");
  const prefix = `${year}-${monthStr}-`;

  const [records, holidays, worksheets] = await Promise.all([
    Attendance.find({
      employeeId,
      date: { $gte: `${prefix}01`, $lte: `${prefix}31` },
    }).sort({ date: 1 }),
    Holiday.find({ date: { $gte: `${prefix}01`, $lte: `${prefix}31` } }),
    Worksheet.find({
      employeeId,
      date: { $gte: `${prefix}01`, $lte: `${prefix}31` },
    }).select('date driveLink status'),
  ]);

  const recordMap = {};
  records.forEach((r) => {
    recordMap[r.date] = r;
  });
  const holidayMap = {};
  holidays.forEach((h) => {
    holidayMap[h.date] = h;
  });
  const worksheetMap = {};
  worksheets.forEach((w) => {
    worksheetMap[w.date] = w;
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
    const holiday = holidayMap[dateStr];
    const worksheet = worksheetMap[dateStr];
    const dayOfWeek = new Date(`${dateStr}T00:00:00`).getDay();
    const isWeekOff = WEEK_OFF_DAYS.includes(dayOfWeek);
    const worksheetFields = {
      worksheetSubmitted: !!worksheet,
      worksheetDriveLink: worksheet ? worksheet.driveLink || null : null,
    };

    if (holiday) {
      // A company holiday always wins for display — it's never Absent —
      // but if the employee actually checked in that day, keep their times.
      const base = doc
        ? await normalizeAttendanceRecord(doc)
        : { date: dateStr, checkInTime: null, checkOutTime: null, totalMinutes: null, checkInLocation: null, checkOutLocation: null };
      result.push({ ...base, ...worksheetFields, date: dateStr, status: "HOLIDAY", holidayName: holiday.name, holidayType: holiday.type || 'COMPANY' });
    } else if (doc) {
      result.push({ ...(await normalizeAttendanceRecord(doc)), ...worksheetFields });
    } else if (isWeekOff) {
      result.push({
        date: dateStr,
        status: "WEEK_OFF",
        checkInTime: null,
        checkOutTime: null,
        totalMinutes: null,
        holidayName: null,
        checkInLocation: null,
        checkOutLocation: null,
        ...worksheetFields,
      });
    } else if (dateStr !== todayStr) {
      result.push({
        date: dateStr,
        status: "ABSENT",
        checkInTime: null,
        checkOutTime: null,
        totalMinutes: null,
        holidayName: null,
        checkInLocation: null,
        checkOutLocation: null,
        ...worksheetFields,
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
    // Reuse the same day-decision logic (holiday / week-off / present /
    // absent) the calendar uses, so "today" never disagrees with what
    // clicking today's cell in the calendar would show.
    const now = new Date();
    const monthRecords = await buildMonthAttendance(resolved.employeeId, now.getFullYear(), now.getMonth() + 1);
    const todayStr = getTodayDateStr();
    const record = monthRecords.find((r) => r.date === todayStr) || null;
    res.json({ success: true, data: record });
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
        data: {
          presentDays: 0, absentDays: 0, holidays: 0, weekOffs: 0,
          halfDays: 0, lateMarks: 0, halfDaysFromLateMarks: 0,
          totalMinutes: 0, averageMinutes: 0,
        },
      });
    }

    const records = await buildMonthAttendance(resolved.employeeId, year, month);

    let presentDays = 0, absentDays = 0, holidays = 0, weekOffs = 0, halfDays = 0, lateMarks = 0, totalMinutes = 0, presentWithHoursCount = 0;
    records.forEach((r) => {
      if (r.status === "PRESENT" || r.status === "HALF_DAY") {
        presentDays += 1;
        if (r.status === "HALF_DAY") halfDays += 1;
        if (r.totalMinutes) {
          totalMinutes += r.totalMinutes;
          presentWithHoursCount += 1;
        }
      } else if (r.status === "ABSENT") {
        absentDays += 1;
      } else if (r.status === "HOLIDAY") {
        holidays += 1;
      } else if (r.status === "WEEK_OFF") {
        weekOffs += 1;
      }
      if (r.isLate) lateMarks += 1;
    });
    const averageMinutes = presentWithHoursCount
      ? Math.round(totalMinutes / presentWithHoursCount)
      : 0;
    // Company policy: 3 Late Marks = 1 Half Day, calculated at month end.
    // This is a derived/informational count — it does NOT retroactively
    // rewrite any day's actual status; it's surfaced so HR can apply it
    // during payroll/month-end review.
    const halfDaysFromLateMarks = Math.floor(lateMarks / 3);

    res.json({
      success: true,
      data: {
        presentDays,
        absentDays,
        holidays,
        weekOffs,
        halfDays,
        lateMarks,
        halfDaysFromLateMarks,
        totalMinutes: Math.round(totalMinutes),
        averageMinutes,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// HOLIDAYS  /api/employees/holidays
//   Company-wide calendar facts, deliberately kept separate from the
//   Attendance model/architecture. Everyone authenticated can read them
//   (the attendance calendar needs this for every employee viewing their
//   own month); only ADMIN/HR can create/update/delete, enforced both by
//   route middleware (requireRole) and again here as a second check.
// ─────────────────────────────────────────────────────────────────────────────
const listHolidays = async (req, res, next) => {
  try {
    const filter = {};
    const year = parseInt(req.query.year, 10);
    const month = parseInt(req.query.month, 10);
    if (year && month && month >= 1 && month <= 12) {
      const monthStr = String(month).padStart(2, "0");
      const prefix = `${year}-${monthStr}-`;
      filter.date = { $gte: `${prefix}01`, $lte: `${prefix}31` };
    } else if (year) {
      filter.date = { $gte: `${year}-01-01`, $lte: `${year}-12-31` };
    }
    const holidays = await Holiday.find(filter).sort({ date: 1 });
    res.json({ success: true, data: holidays });
  } catch (err) {
    next(err);
  }
};

const createHoliday = async (req, res, next) => {
  try {
    if (!isManager(req)) {
      return res.status(403).json({
        success: false,
        message: "Only Admin/HR can manage holidays.",
      });
    }
    const { date, name, description, type } = req.body;
    if (!date || !name) {
      return res.status(400).json({
        success: false,
        message: "Holiday date and name are required.",
      });
    }
    const dateStr = new Date(date).toISOString().split("T")[0];
    const existing = await Holiday.findOne({ date: dateStr });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: `A holiday is already set for ${dateStr}.`,
      });
    }
    const holiday = await Holiday.create({
      date: dateStr,
      name: name.trim(),
      description: description ? description.trim() : "",
      type: type === 'NATIONAL' ? 'NATIONAL' : 'COMPANY',
      createdById: req.user.id,
      createdByName: req.user.name,
    });
    res.status(201).json({ success: true, data: holiday, message: "Holiday added." });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ success: false, message: "A holiday already exists for that date." });
    }
    next(err);
  }
};

const updateHoliday = async (req, res, next) => {
  try {
    if (!isManager(req)) {
      return res.status(403).json({
        success: false,
        message: "Only Admin/HR can manage holidays.",
      });
    }
    const holiday = await Holiday.findById(req.params.id);
    if (!holiday) {
      return res.status(404).json({ success: false, message: "Holiday not found." });
    }
    const { date, name, description, type } = req.body;
    if (date) holiday.date = new Date(date).toISOString().split("T")[0];
    if (name) holiday.name = name.trim();
    if (description !== undefined) holiday.description = description ? description.trim() : "";
    if (type !== undefined) holiday.type = type === 'NATIONAL' ? 'NATIONAL' : 'COMPANY';
    await holiday.save();
    res.json({ success: true, data: holiday, message: "Holiday updated." });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ success: false, message: "A holiday already exists for that date." });
    }
    next(err);
  }
};

const deleteHoliday = async (req, res, next) => {
  try {
    if (!isManager(req)) {
      return res.status(403).json({
        success: false,
        message: "Only Admin/HR can manage holidays.",
      });
    }
    const holiday = await Holiday.findByIdAndDelete(req.params.id);
    if (!holiday) {
      return res.status(404).json({ success: false, message: "Holiday not found." });
    }
    res.json({ success: true, message: "Holiday removed." });
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
      // dayType isn't known yet — checkout (which happens right after this,
      // per the mandated flow) is what actually decides it from the real
      // worked duration; checkOut() backfills this field once it does.
      dayType: null,
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

// ── Filters available to Admin/Founder/COO on GET /worksheets ──────────────
//   employeeId — exact employee
//   department — matches the employee's linked User.department
//   date       — exact YYYY-MM-DD
//   month      — YYYY-MM (all worksheets in that month)
//   status     — SUBMITTED | REVIEWED
const getWorksheets = async (req, res, next) => {
  try {
    let filter = {};
    if (canManageAllWorksheets(req)) {
      // Admin/Founder/COO: full visibility, plus optional filters.
      if (req.query.employeeId) filter.employeeId = req.query.employeeId;
      if (req.query.date) filter.date = req.query.date;
      if (req.query.month) filter.date = { $regex: `^${req.query.month}` }; // YYYY-MM prefix
      if (req.query.status) filter.status = req.query.status;

      if (req.query.department) {
        // Department lives on User, not Employee — resolve matching
        // employees first, then filter worksheets by their ids.
        const usersInDept = await User.find({ department: req.query.department }).select('_id');
        const userIds = usersInDept.map((u) => u._id);
        const employeesInDept = await Employee.find({ userId: { $in: userIds } }).select('_id');
        filter.employeeId = { $in: employeesInDept.map((e) => e._id) };
      }
    } else {
      // Everyone else (BDM/HR/Recruitment/Crewing/etc.): only their own.
      const myEmp = await getMyEmployee(req.user.id, req.user.email);
      if (!myEmp) return res.json({ success: true, data: [] });
      filter.employeeId = myEmp._id;
    }
    const worksheets = await Worksheet.find(filter)
      .populate("employeeId", "name position employeeId")
      .sort({ createdAt: -1 });

    // Enrich each worksheet with that day's attendance (check-in/out,
    // worked minutes) so the worksheet card can show them without a
    // separate Attendance model/route on the frontend.
    const pairs = worksheets
      .filter((w) => w.employeeId)
      .map((w) => ({ employeeId: w.employeeId._id.toString(), date: w.date }));
    const attendanceDocs = pairs.length
      ? await Attendance.find({ $or: pairs.map((p) => ({ employeeId: p.employeeId, date: p.date })) })
      : [];
    const attendanceMap = {};
    attendanceDocs.forEach((a) => {
      attendanceMap[`${a.employeeId.toString()}_${a.date}`] = a;
    });

    const enriched = await Promise.all(worksheets.map(async (w) => {
      const obj = w.toJSON();
      if (w.employeeId) {
        const key = `${w.employeeId._id.toString()}_${w.date}`;
        const att = attendanceMap[key];
        if (att) {
          const norm = await normalizeAttendanceRecord(att);
          obj.attendance = {
            checkIn: norm.checkInTime,
            checkOut: norm.checkOutTime,
            totalMinutes: norm.totalMinutes,
          };
        }
      }
      return obj;
    }));

    res.json({ success: true, data: enriched });
  } catch (err) {
    next(err);
  }
};

// ── Founder/COO/Admin reply to a worksheet ────────────────────────────────────
// PATCH /api/employees/worksheets/:id/reply — Admin/Founder/COO only, per
// Task 2's worksheet-visibility table (HR is intentionally excluded — HR
// cannot see other employees' worksheets, so it can't reply to them either).
// Creates a popup notification for the worksheet's employee.
const replyToWorksheet = async (req, res, next) => {
  try {
    if (!canManageAllWorksheets(req)) {
      return res.status(403).json({
        success: false,
        message: "Only Admin, Founder, or COO can reply to worksheets.",
      });
    }
    const { reply } = req.body;
    if (!reply || !reply.trim()) {
      return res.status(400).json({ success: false, message: "Reply text is required." });
    }
    const worksheet = await Worksheet.findById(req.params.id).populate('employeeId', 'userId email name');
    if (!worksheet) {
      return res.status(404).json({ success: false, message: "Worksheet not found." });
    }
    worksheet.reply = reply.trim();
    worksheet.repliedById = req.user.id;
    worksheet.repliedByName = req.user.name;
    worksheet.repliedAt = new Date();
    worksheet.status = "REVIEWED";
    await worksheet.save();

    // Notify the assigned employee (only them) so they get an immediate
    // popup after login, per Task 4.
    try {
      let targetUserId = worksheet.employeeId && worksheet.employeeId.userId;
      if (!targetUserId && worksheet.employeeId && worksheet.employeeId.email) {
        const u = await User.findOne({ email: worksheet.employeeId.email.toLowerCase().trim() });
        targetUserId = u && u._id;
      }
      if (targetUserId) {
        const prettyDate = new Date(`${worksheet.date}T00:00:00`).toLocaleDateString('en-GB', {
          day: '2-digit', month: 'short', year: 'numeric',
        });
        await Notification.create({
          userId: targetUserId,
          type: 'WORKSHEET_REPLY',
          message: `${req.user.name} replied to your worksheet for ${prettyDate}.`,
          link: `/pages/worksheets.html?worksheetId=${worksheet._id}`,
        });
      }
    } catch (notifyErr) {
      // Never fail the reply itself over a notification hiccup.
      console.error('Failed to create worksheet-reply notification:', notifyErr);
    }

    res.json({ success: true, data: worksheet, message: "Reply sent." });
  } catch (err) {
    next(err);
  }
};

// ── Employee responds to a manager's reply ────────────────────────────────────
// PATCH /api/employees/worksheets/:id/response — only the worksheet's own
// employee may respond. Backend re-verifies ownership from the worksheet's
// stored employeeId against the caller's own resolved Employee._id — the
// worksheetId in the URL cannot be used to respond on someone else's
// worksheet no matter what value is passed.
const respondToWorksheetReply = async (req, res, next) => {
  try {
    const { response } = req.body;
    if (!response || !response.trim()) {
      return res.status(400).json({ success: false, message: "Response text is required." });
    }
    const worksheet = await Worksheet.findById(req.params.id);
    if (!worksheet) {
      return res.status(404).json({ success: false, message: "Worksheet not found." });
    }
    if (!isManager(req)) {
      const myEmp = await getMyEmployee(req.user.id);
      if (!myEmp || myEmp._id.toString() !== worksheet.employeeId.toString()) {
        return res.status(403).json({
          success: false,
          message: "You can only respond to your own worksheets.",
        });
      }
    }
    worksheet.employeeResponse = response.trim();
    worksheet.employeeRespondedAt = new Date();
    await worksheet.save();
    res.json({ success: true, data: worksheet, message: "Response saved." });
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
// MY PROFILE  GET /api/employees/me & /api/employees/me/profile (Strictly Read-Only)
// ─────────────────────────────────────────────────────────────────────────────
const getMyProfile = async (req, res, next) => {
  try {
    let emp = await Employee.findOne({ userId: req.user.id });
    if (!emp && req.user.email) {
      emp = await Employee.findOne({ email: req.user.email.toLowerCase().trim() });
    }
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

// ─────────────────────────────────────────────────────────────────────────────
// UPDATE MY PROFILE  PATCH /api/employees/me/profile
// ─────────────────────────────────────────────────────────────────────────────
const updateMyProfile = async (req, res, next) => {
  try {
    let emp = await Employee.findOne({ userId: req.user.id });
    if (!emp && req.user.email) {
      emp = await Employee.findOne({ email: req.user.email.toLowerCase().trim() });
    }
    if (!emp)
      return res.status(404).json({
        success: false,
        message: "No employee profile found for your account.",
      });

    const { phone, location, address, dateOfBirth, gender, bloodGroup } = req.body;
    if (phone) emp.phone = phone.trim();
    if (location !== undefined) emp.location = location ? location.trim() : null;
    if (address !== undefined) emp.address = address ? address.trim() : null;
    if (dateOfBirth !== undefined) emp.dateOfBirth = dateOfBirth ? new Date(dateOfBirth) : null;
    if (gender !== undefined) emp.gender = gender || null;
    if (bloodGroup !== undefined) emp.bloodGroup = bloodGroup || null;

    await emp.save();
    res.json({
      success: true,
      data: emp,
      message: "Profile updated successfully.",
    });
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
  listHolidays,
  createHoliday,
  updateHoliday,
  deleteHoliday,
  submitWorksheet,
  getWorksheets,
  replyToWorksheet,
  respondToWorksheetReply,
  createTask,
  getTasks,
  updateTaskStatus,
  getMyProfile,
  updateMyProfile,
  bulkImportEmployees,
  getUpcomingBirthdays,
  checkMyBirthdayToday,
  checkGeofence,
};