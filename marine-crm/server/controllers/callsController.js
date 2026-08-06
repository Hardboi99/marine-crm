const { Call, Appointment, Reason, FollowUp, Company } = require('../models');
const { validateOutcome } = require('../utils/reasonValidator');
const { logActivity } = require('../utils/activityLogger');

// ─── CALLS ────────────────────────────────────────────────────

const getCalls = async (req, res, next) => {
  try {
    const { companyId, statusColor, date, page = 1, limit = 50 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {};
    if (companyId) where.companyId = companyId;
    if (statusColor) where.statusColor = statusColor;

    if (date) {
      const start = new Date(date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(date);
      end.setHours(23, 59, 59, 999);
      where.callDate = { $gte: start, $lte: end };
    }

    const [calls, total] = await Promise.all([
      Call.find(where)
        .sort({ callDate: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate('userId', 'name')
        .populate('companyId', 'name'),
      Call.countDocuments(where),
    ]);

    const data = calls.map((c) => {
      const obj = c.toJSON();
      obj.user = c.userId ? { name: c.userId.name } : null;
      obj.company = c.companyId ? { name: c.companyId.name } : null;
      return obj;
    });

    res.json({ success: true, data, meta: { total, page: parseInt(page), limit: parseInt(limit) } });
  } catch (err) {
    next(err);
  }
};

const createCall = async (req, res, next) => {
  try {
    const { companyId, callDate, durationMinutes, statusColor, notes, nextFollowupDate } = req.body;
    if (!companyId || !callDate || !statusColor) {
      return res.status(400).json({ success: false, message: 'companyId, callDate, and statusColor are required.' });
    }

    const call = await Call.create({
      companyId,
      callDate: new Date(callDate),
      durationMinutes: durationMinutes ? parseInt(durationMinutes) : null,
      statusColor,
      notes: notes?.trim() || null,
      nextFollowupDate: nextFollowupDate ? new Date(nextFollowupDate) : null,
      userId: req.user.id,
    });

    await call.populate('userId', 'name');
    await call.populate('companyId', 'name');

    const obj = call.toJSON();
    obj.user = call.userId ? { name: call.userId.name } : null;
    obj.company = call.companyId ? { name: call.companyId.name } : null;

    await logActivity({
      userId: req.user.id,
      entityType: 'CALL',
      entityId: call._id.toString(),
      action: 'LOGGED_CALL',
      details: { company: call.companyId?.name, statusColor: call.statusColor },
    });

    res.status(201).json({ success: true, data: obj });
  } catch (err) {
    next(err);
  }
};

const updateCall = async (req, res, next) => {
  try {
    const allowed = ['callDate', 'durationMinutes', 'statusColor', 'notes', 'nextFollowupDate'];
    const data = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
    if (data.callDate) data.callDate = new Date(data.callDate);
    if (data.nextFollowupDate) data.nextFollowupDate = new Date(data.nextFollowupDate);
    if (data.durationMinutes !== undefined) data.durationMinutes = data.durationMinutes ? parseInt(data.durationMinutes) : null;

    const call = await Call.findByIdAndUpdate(req.params.id, data, { new: true })
      .populate('userId', 'name')
      .populate('companyId', 'name');

    if (!call) return res.status(404).json({ success: false, message: 'Call not found.' });

    const obj = call.toJSON();
    obj.user = call.userId ? { name: call.userId.name } : null;
    obj.company = call.companyId ? { name: call.companyId.name } : null;

    res.json({ success: true, data: obj });
  } catch (err) {
    next(err);
  }
};

const deleteCall = async (req, res, next) => {
  try {
    const call = await Call.findByIdAndDelete(req.params.id);
    if (!call) return res.status(404).json({ success: false, message: 'Call not found.' });
    res.json({ success: true, message: 'Call deleted.' });
  } catch (err) {
    next(err);
  }
};

// ─── APPOINTMENTS ─────────────────────────────────────────────

const getAppointments = async (req, res, next) => {
  try {
    const { companyId, outcome, upcoming, page = 1, limit = 50 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const now = new Date();

    const where = {};
    if (companyId) where.companyId = companyId;
    if (outcome) where.outcome = outcome;
    if (upcoming === 'true') where.scheduledAt = { $gte: now };

    const [appointments, total] = await Promise.all([
      Appointment.find(where)
        .sort({ scheduledAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate('companyId', 'name contactPerson email phone')
        .populate('reasonId')
        .populate('decidedById', 'name')
        .populate('createdById', 'name'),
      Appointment.countDocuments(where),
    ]);

    const data = appointments.map((a) => {
      const obj = a.toJSON();
      obj.company = a.companyId ? { id: a.companyId._id.toString(), name: a.companyId.name, contactPerson: a.companyId.contactPerson, email: a.companyId.email, phone: a.companyId.phone } : null;
      obj.reason = a.reasonId;
      obj.decidedBy = a.decidedById ? { name: a.decidedById.name } : null;
      obj.createdBy = a.createdById ? { name: a.createdById.name } : null;
      return obj;
    });

    res.json({ success: true, data, meta: { total, page: parseInt(page), limit: parseInt(limit) } });
  } catch (err) {
    next(err);
  }
};

const createAppointment = async (req, res, next) => {
  try {
    const { companyId, scheduledAt, meetingNotes, reminderAt } = req.body;
    if (!companyId || !scheduledAt) return res.status(400).json({ success: false, message: 'companyId and scheduledAt are required.' });

    const appt = await Appointment.create({
      companyId,
      scheduledAt: new Date(scheduledAt),
      meetingNotes: meetingNotes?.trim() || null,
      reminderAt: reminderAt ? new Date(reminderAt) : null,
      createdById: req.user.id,
    });

    await appt.populate('companyId', 'name contactPerson email phone');
    const obj = appt.toJSON();
    obj.company = appt.companyId
      ? {
          id: appt.companyId._id.toString(),
          name: appt.companyId.name,
          contactPerson: appt.companyId.contactPerson,
          email: appt.companyId.email,
          phone: appt.companyId.phone,
        }
      : null;
    obj.createdBy = { name: req.user.name || 'User' };

    await logActivity({
      userId: req.user.id,
      entityType: 'APPOINTMENT',
      entityId: appt._id.toString(),
      action: 'BOOKED_APPOINTMENT',
      details: { company: appt.companyId?.name, scheduledAt: appt.scheduledAt },
    });

    res.status(201).json({ success: true, data: obj });
  } catch (err) {
    next(err);
  }
};

const setAppointmentOutcome = async (req, res, next) => {
  try {
    const { outcome, reasonId, bookedAt, reminderAt, meetingNotes } = req.body;

    const validation = validateOutcome(outcome, reasonId);
    if (!validation.valid) {
      return res.status(400).json({ success: false, message: validation.message });
    }

    const data = {
      outcome,
      reasonId: reasonId || null,
      decidedById: req.user.id,
      decidedAt: new Date(),
      ...(bookedAt && { bookedAt: new Date(bookedAt) }),
      ...(reminderAt && { reminderAt: new Date(reminderAt) }),
      ...(meetingNotes && { meetingNotes: meetingNotes.trim() }),
    };

    const appt = await Appointment.findByIdAndUpdate(req.params.id, data, { new: true })
      .populate('reasonId')
      .populate('decidedById', 'name')
      .populate('companyId', 'name');

    if (!appt) return res.status(404).json({ success: false, message: 'Appointment not found.' });

    // If NO/PENDING → auto-create a FollowUp record
    if (outcome === 'NO' || outcome === 'PENDING') {
      await FollowUp.create({
        sourceType: 'APPOINTMENT',
        sourceId: appt._id,
        appointmentId: appt._id,
        reasonId: reasonId || null,
        status: 'PENDING',
        nextFollowupDate: req.body.nextFollowupDate ? new Date(req.body.nextFollowupDate) : null,
      });
    }

    const obj = appt.toJSON();
    obj.reason = appt.reasonId;
    obj.decidedBy = appt.decidedById ? { name: appt.decidedById.name } : null;
    obj.company = appt.companyId ? { name: appt.companyId.name } : null;

    await logActivity({
      userId: req.user.id,
      entityType: 'APPOINTMENT',
      entityId: appt._id.toString(),
      action: 'SET_APPOINTMENT_OUTCOME',
      details: { company: appt.companyId?.name, outcome: appt.outcome, reason: appt.reasonId?.label },
    });

    res.json({ success: true, data: obj });
  } catch (err) {
    next(err);
  }
};

const updateAppointment = async (req, res, next) => {
  try {
    const allowed = ['scheduledAt', 'meetingNotes', 'reminderAt'];
    const data = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
    if (data.scheduledAt) data.scheduledAt = new Date(data.scheduledAt);
    if (data.reminderAt) data.reminderAt = new Date(data.reminderAt);

    const appt = await Appointment.findByIdAndUpdate(req.params.id, data, { new: true });
    if (!appt) return res.status(404).json({ success: false, message: 'Appointment not found.' });
    res.json({ success: true, data: appt });
  } catch (err) {
    next(err);
  }
};

const deleteAppointment = async (req, res, next) => {
  try {
    const appt = await Appointment.findByIdAndDelete(req.params.id);
    if (!appt) return res.status(404).json({ success: false, message: 'Appointment not found.' });
    res.json({ success: true, message: 'Appointment deleted.' });
  } catch (err) {
    next(err);
  }
};

// ─── REASONS ──────────────────────────────────────────────────

const getReasons = async (req, res, next) => {
  try {
    const { category } = req.query;
    const reasons = await Reason.find({ isActive: true, ...(category && { category }) }).sort({
      category: 1,
      sortOrder: 1,
      label: 1,
    });
    res.json({ success: true, data: reasons });
  } catch (err) {
    next(err);
  }
};

const createReason = async (req, res, next) => {
  try {
    const { category, label, sortOrder } = req.body;
    if (!category || !label) return res.status(400).json({ success: false, message: 'Category and label are required.' });

    const reason = await Reason.create({ category, label: label.trim(), sortOrder: sortOrder || 0 });
    res.status(201).json({ success: true, data: reason });
  } catch (err) {
    next(err);
  }
};

// ─── FOLLOW-UPS ───────────────────────────────────────────────

const getFollowUps = async (req, res, next) => {
  try {
    const { status, sourceType, page = 1, limit = 50 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {};
    if (status) where.status = status;
    if (sourceType) where.sourceType = sourceType;

    const [followUps, total] = await Promise.all([
      FollowUp.find(where)
        .sort({ nextFollowupDate: 1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate('reasonId')
        .populate({
          path: 'appointmentId',
          populate: { path: 'companyId', select: 'name' },
        }),
      FollowUp.countDocuments(where),
    ]);

    const data = followUps.map((f) => {
      const obj = f.toJSON();
      obj.reason = f.reasonId;
      if (f.appointmentId) {
        const apptObj = f.appointmentId.toJSON();
        apptObj.company = f.appointmentId.companyId ? { name: f.appointmentId.companyId.name } : null;
        obj.appointment = apptObj;
      } else {
        obj.appointment = null;
      }
      return obj;
    });

    res.json({ success: true, data, meta: { total, page: parseInt(page), limit: parseInt(limit) } });
  } catch (err) {
    next(err);
  }
};

const createFollowUp = async (req, res, next) => {
  try {
    const { appointmentId, status, nextFollowupDate, notes } = req.body;

    const followUp = await FollowUp.create({
      sourceType: 'APPOINTMENT',
      appointmentId: appointmentId || null,
      status: status || 'PENDING',
      nextFollowupDate: nextFollowupDate && nextFollowupDate !== 'null' ? new Date(nextFollowupDate) : null,
      notes: notes?.trim() || null,
    });

    if (followUp.appointmentId) {
      await followUp.populate({
        path: 'appointmentId',
        populate: { path: 'companyId', select: 'name' },
      });
    }

    const obj = followUp.toJSON();
    if (followUp.appointmentId) {
      const apptObj = followUp.appointmentId.toJSON();
      apptObj.company = followUp.appointmentId.companyId ? { name: followUp.appointmentId.companyId.name } : null;
      obj.appointment = apptObj;
    } else {
      obj.appointment = null;
    }

    res.status(201).json({ success: true, data: obj });
  } catch (err) {
    next(err);
  }
};

const updateFollowUp = async (req, res, next) => {
  try {
    const { status, nextFollowupDate, notes } = req.body;
    const data = {};
    if (status) data.status = status;
    if (nextFollowupDate !== undefined) {
      data.nextFollowupDate = nextFollowupDate && nextFollowupDate !== 'null' ? new Date(nextFollowupDate) : null;
    }
    if (notes !== undefined) data.notes = notes?.trim() || null;

    const followUp = await FollowUp.findByIdAndUpdate(req.params.id, data, { new: true }).populate({
      path: 'appointmentId',
      populate: { path: 'companyId', select: 'name' },
    });

    if (!followUp) return res.status(404).json({ success: false, message: 'FollowUp not found.' });

    const obj = followUp.toJSON();
    if (followUp.appointmentId) {
      const apptObj = followUp.appointmentId.toJSON();
      apptObj.company = followUp.appointmentId.companyId ? { name: followUp.appointmentId.companyId.name } : null;
      obj.appointment = apptObj;
    }

    res.json({ success: true, data: obj });
  } catch (err) {
    next(err);
  }
};

const deleteFollowUp = async (req, res, next) => {
  try {
    const followUp = await FollowUp.findByIdAndDelete(req.params.id);
    if (!followUp) return res.status(404).json({ success: false, message: 'FollowUp not found.' });
    res.json({ success: true, message: 'FollowUp deleted.' });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getCalls,
  createCall,
  updateCall,
  deleteCall,
  getAppointments,
  createAppointment,
  setAppointmentOutcome,
  updateAppointment,
  deleteAppointment,
  getReasons,
  createReason,
  getFollowUps,
  createFollowUp,
  updateFollowUp,
  deleteFollowUp,
};
