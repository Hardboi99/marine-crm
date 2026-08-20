const { Call, FollowUp, Appointment, Contract, Company, Country, Activity, Notification, Reason, Candidate, Requirement, Invoice, Employee, Attendance, Task, Worksheet } = require('../models');
const { getDataScope } = require('../utils/accessScope');
const { ROLES, ORG_WIDE_ROLES } = require('../utils/roles');

// ─── EMPLOYEE PERSONAL DASHBOARD (BDM role) ────────────────────────────────
const getEmployeeDashboard = async (req, res, next) => {
  try {
    const emp = await Employee.findOne({ userId: req.user.id });
    if (!emp) {
      return res.json({ success: true, data: { profile: null, todayAttendance: null, pendingTasks: 0, worksheetsThisMonth: 0 } });
    }

    const today = new Date().toISOString().split('T')[0];
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

    const [todayAttendance, pendingTasks, worksheetsThisMonth, recentTasks, recentWorksheets] = await Promise.all([
      Attendance.findOne({ employeeId: emp._id, date: today }),
      Task.countDocuments({ assignedTo: emp._id, status: { $in: ['PENDING', 'IN_PROGRESS'] } }),
      Worksheet.countDocuments({ employeeId: emp._id, date: { $gte: monthStart } }),
      Task.find({ assignedTo: emp._id }).sort({ createdAt: -1 }).limit(5),
      Worksheet.find({ employeeId: emp._id }).sort({ createdAt: -1 }).limit(5),
    ]);

    res.json({
      success: true,
      data: { profile: emp, todayAttendance, pendingTasks, worksheetsThisMonth, recentTasks, recentWorksheets }
    });
  } catch (err) { next(err); }
};

// ─── DASHBOARD STATS ──────────────────────────────────────────

// §29 — dashboard content changes according to the logged-in user. Crewing
// counts are scoped through the same accessScope utility used by the list
// endpoints so a manager's dashboard matches their team, and an officer's
// dashboard matches only their own work. BDM pipeline stats and revenue
// are only meaningful (and only shown) to BDM + org-wide roles.
const getDashboardStats = async (req, res, next) => {
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const role = req.currentUser?.role;
    const canSeeBdmAndFinance = ORG_WIDE_ROLES.has(role) || role === ROLES.BDM || role === ROLES.ACCOUNTS_OFFICER;

    const [requirementScope, candidateScope] = await Promise.all([
      getDataScope(req.currentUser, 'REQUIREMENT'),
      getDataScope(req.currentUser, 'CANDIDATE'),
    ]);

    const bdmStatsPromise = canSeeBdmAndFinance
      ? Promise.all([
          Call.countDocuments({ callDate: { $gte: todayStart, $lt: todayEnd } }),
          FollowUp.countDocuments({ status: 'PENDING' }),
          Appointment.countDocuments({ scheduledAt: { $gte: now }, outcome: null }),
          Contract.countDocuments({ status: 'ACTIVE' }),
          Company.countDocuments({ createdAt: { $gte: monthStart }, status: 'CLIENT' }),
          Company.countDocuments(),
          (role === ROLES.ACCOUNTS_OFFICER || ORG_WIDE_ROLES.has(role))
            ? Invoice.aggregate([{ $group: { _id: null, total: { $sum: '$amount' } } }])
            : Promise.resolve([]),
        ])
      : Promise.resolve([0, 0, 0, 0, 0, 0, []]);

    const [
      [todaysCalls, pendingFollowups, upcomingMeetings, activeContracts, newClientsThisMonth, totalCompanies, revenueData],
      activeRequirements, candidatesPlaced, totalCandidates
    ] = await Promise.all([
      bdmStatsPromise,
      Requirement.countDocuments({ ...requirementScope, status: 'OPEN' }),
      Candidate.countDocuments({ ...candidateScope, status: 'ONBOARDED' }),
      Candidate.countDocuments(candidateScope),
    ]);

    const totalRevenue = revenueData[0] ? revenueData[0].total : 0;

    res.json({
      success: true,
      data: {
        todaysCalls, pendingFollowups, upcomingMeetings, activeContracts,
        newClientsThisMonth, totalCompanies,
        activeRequirements, candidatesPlaced, totalCandidates,
        totalRevenue: canSeeBdmAndFinance ? totalRevenue : undefined,
      },
    });
  } catch (err) { next(err); }
};

// ─── CHART DATA ───────────────────────────────────────────────

const getCallsByStatus = async (req, res, next) => {
  try {
    const groups = await Call.aggregate([
      { $group: { _id: '$statusColor', count: { $sum: 1 } } },
    ]);
    const data = groups.map((g) => ({
      statusColor: g._id,
      _count: { id: g.count },
    }));
    res.json({ success: true, data });
  } catch (err) { next(err); }
};

const getCountryPipeline = async (req, res, next) => {
  try {
    const groups = await Company.aggregate([
      { $group: { _id: { countryId: '$countryId', status: '$status' }, count: { $sum: 1 } } },
    ]);

    const countries = await Country.find().select('_id name');
    const countryMap = Object.fromEntries(countries.map((c) => [c._id.toString(), c.name]));

    const data = groups.map((row) => {
      const cId = row._id.countryId ? row._id.countryId.toString() : null;
      return {
        countryId: cId,
        status: row._id.status,
        _count: { id: row.count },
        countryName: cId ? (countryMap[cId] || 'Unknown') : 'Unknown',
      };
    });

    res.json({ success: true, data });
  } catch (err) { next(err); }
};

const getMonthlyContracts = async (req, res, next) => {
  try {
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    const contracts = await Contract.find({ createdAt: { $gte: twelveMonthsAgo } }).select('createdAt status');
    res.json({ success: true, data: contracts });
  } catch (err) { next(err); }
};

// ─── RECENT ACTIVITY ──────────────────────────────────────────

const getRecentActivity = async (req, res, next) => {
  try {
    const activities = await Activity.find()
      .sort({ createdAt: -1 })
      .limit(20)
      .populate('userId', 'name role');

    const data = activities.map((act) => {
      const obj = act.toJSON();
      obj.user = act.userId ? { name: act.userId.name, role: act.userId.role } : null;
      return obj;
    });

    res.json({ success: true, data });
  } catch (err) { next(err); }
};

// ─── NOTIFICATIONS ────────────────────────────────────────────

const getNotifications = async (req, res, next) => {
  try {
    const notifications = await Notification.find({ userId: req.user.id })
      .sort({ createdAt: -1 })
      .limit(50);
    res.json({ success: true, data: notifications });
  } catch (err) { next(err); }
};

const markNotificationRead = async (req, res, next) => {
  try {
    await Notification.updateMany(
      { userId: req.user.id, _id: req.params.id },
      { $set: { isRead: true } }
    );
    res.json({ success: true });
  } catch (err) { next(err); }
};

const markAllNotificationsRead = async (req, res, next) => {
  try {
    await Notification.updateMany(
      { userId: req.user.id, isRead: false },
      { $set: { isRead: true } }
    );
    res.json({ success: true });
  } catch (err) { next(err); }
};

// ─── REPORTS ──────────────────────────────────────────────────

const getRejectionReasonReport = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const match = { reasonId: { $ne: null } };

    if (startDate || endDate) {
      match.decidedAt = {};
      if (startDate) match.decidedAt.$gte = new Date(startDate);
      if (endDate) match.decidedAt.$lte = new Date(endDate);
    }

    const appointmentReasons = await Appointment.aggregate([
      { $match: match },
      { $group: { _id: '$reasonId', count: { $sum: 1 } } },
    ]);

    const reasonIds = appointmentReasons.map((r) => r._id).filter(Boolean);
    const reasons = await Reason.find({ _id: { $in: reasonIds } }).select('_id label category');
    const reasonMap = Object.fromEntries(reasons.map((r) => [r._id.toString(), r.toJSON()]));

    const report = {
      appointments: appointmentReasons.map((r) => {
        const idStr = r._id.toString();
        return {
          reasonId: idStr,
          _count: { id: r.count },
          reason: reasonMap[idStr] || null,
        };
      }),
    };
    res.json({ success: true, data: report });
  } catch (err) { next(err); }
};

const getDailyReport = async (req, res, next) => {
  try {
    const date = req.query.date ? new Date(req.query.date) : new Date();
    const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);

    const [callsRaw, apptsRaw, contractsRaw] = await Promise.all([
      Call.find({ callDate: { $gte: start, $lt: end } })
        .populate('userId', 'name')
        .populate('companyId', 'name'),
      Appointment.find({ scheduledAt: { $gte: start, $lt: end } })
        .populate('companyId', 'name'),
      Contract.find({ createdAt: { $gte: start, $lt: end } })
        .populate('companyId', 'name'),
    ]);

    const calls = callsRaw.map((c) => {
      const obj = c.toJSON();
      obj.user = c.userId ? { name: c.userId.name } : null;
      obj.company = c.companyId ? { name: c.companyId.name } : null;
      return obj;
    });

    const appointments = apptsRaw.map((a) => {
      const obj = a.toJSON();
      obj.company = a.companyId ? { name: a.companyId.name } : null;
      return obj;
    });

    const contracts = contractsRaw.map((ct) => {
      const obj = ct.toJSON();
      obj.company = ct.companyId ? { name: ct.companyId.name } : null;
      return obj;
    });

    res.json({ success: true, data: { date: start, calls, appointments, contracts } });
  } catch (err) { next(err); }
};

const getCountryWiseReport = async (req, res, next) => {
  try {
    const companies = await Company.find().populate('countryId', 'name');
    const companyIds = companies.map((c) => c._id);

    const [callsGroup, apptsGroup, contractsGroup] = await Promise.all([
      Call.aggregate([{ $match: { companyId: { $in: companyIds } } }, { $group: { _id: '$companyId', count: { $sum: 1 } } }]),
      Appointment.aggregate([{ $match: { companyId: { $in: companyIds } } }, { $group: { _id: '$companyId', count: { $sum: 1 } } }]),
      Contract.aggregate([{ $match: { companyId: { $in: companyIds } } }, { $group: { _id: '$companyId', count: { $sum: 1 } } }]),
    ]);

    const callsMap = Object.fromEntries(callsGroup.map((g) => [g._id.toString(), g.count]));
    const apptsMap = Object.fromEntries(apptsGroup.map((g) => [g._id.toString(), g.count]));
    const contractsMap = Object.fromEntries(contractsGroup.map((g) => [g._id.toString(), g.count]));

    const byCountry = {};
    for (const c of companies) {
      const cObj = c.toJSON();
      cObj.country = c.countryId ? { name: c.countryId.name } : null;
      const numCalls = callsMap[c._id.toString()] || 0;
      const numAppts = apptsMap[c._id.toString()] || 0;
      const numContracts = contractsMap[c._id.toString()] || 0;
      cObj._count = { calls: numCalls, appointments: numAppts, contracts: numContracts };

      const key = c.countryId?.name || 'Unknown';
      if (!byCountry[key]) {
        byCountry[key] = { country: key, companies: [], totals: { calls: 0, appointments: 0, contracts: 0 } };
      }
      byCountry[key].companies.push(cObj);
      byCountry[key].totals.calls += numCalls;
      byCountry[key].totals.appointments += numAppts;
      byCountry[key].totals.contracts += numContracts;
    }

    res.json({ success: true, data: Object.values(byCountry) });
  } catch (err) { next(err); }
};

module.exports = {
  getDashboardStats,
  getCallsByStatus,
  getCountryPipeline,
  getMonthlyContracts,
  getRecentActivity,
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  getRejectionReasonReport,
  getDailyReport,
  getCountryWiseReport,
  getEmployeeDashboard,
};