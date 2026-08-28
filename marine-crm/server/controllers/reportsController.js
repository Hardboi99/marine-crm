'use strict';
const JobApplication = require('../models/JobApplication.model');
const Candidate      = require('../models/Candidate');
const Visitor        = require('../models/Visitor');
const DocIntake      = require('../models/DocIntake');

let ReceptionCallModel;
try { ReceptionCallModel = require('../models/ReceptionCall'); } catch (_) { ReceptionCallModel = null; }

function buildDateRange(dateFrom, dateTo, field) {
  if (!field) field = 'createdAt';
  const cond = {};
  if (dateFrom || dateTo) {
    cond[field] = {};
    if (dateFrom) cond[field]['$gte'] = new Date(dateFrom);
    if (dateTo)   cond[field]['$lte'] = new Date(new Date(dateTo).setHours(23, 59, 59, 999));
  }
  return cond;
}

exports.getCrewingReport = async (req, res) => {
  try {
    const { dateFrom, dateTo, department, rank, status } = req.query;
    const appMatch = Object.assign({}, buildDateRange(dateFrom, dateTo));
    if (department) appMatch.department = department;
    if (rank)       appMatch.rankAppliedFor = rank;
    if (status)     appMatch.status = status;

    const [totalApplications, newApplications, shortlistedCount, hiredCount, rejectedCount, totalCandidates, availableCandidates] = await Promise.all([
      JobApplication.countDocuments(appMatch),
      JobApplication.countDocuments(Object.assign({}, appMatch, { status: 'NEW' })),
      JobApplication.countDocuments(Object.assign({}, appMatch, { status: 'SHORTLISTED' })),
      JobApplication.countDocuments(Object.assign({}, appMatch, { status: 'HIRED' })),
      JobApplication.countDocuments(Object.assign({}, appMatch, { status: 'REJECTED' })),
      Candidate.countDocuments({}),
      Candidate.countDocuments({ status: 'AVAILABLE' }),
    ]);

    const conversionRate = totalApplications > 0 ? ((hiredCount / totalApplications) * 100).toFixed(1) : '0.0';

    const pipelineByStatus = await JobApplication.aggregate([
      { $match: appMatch },
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 11);
    twelveMonthsAgo.setDate(1);
    twelveMonthsAgo.setHours(0,0,0,0);

    const trendMonthly = await JobApplication.aggregate([
      { $match: { createdAt: { $gte: twelveMonthsAgo } } },
      { $group: { _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } }, count: { $sum: 1 }, hired: { $sum: { $cond: [{ $eq: ['$status', 'HIRED'] }, 1, 0] } } } },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    const rankDistribution = await JobApplication.aggregate([
      { $match: appMatch }, { $group: { _id: '$rankAppliedFor', count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 15 }
    ]);
    const deptDistribution = await JobApplication.aggregate([
      { $match: appMatch }, { $group: { _id: '$department', count: { $sum: 1 } } }, { $sort: { count: -1 } }
    ]);
    const nationalityTop = await Candidate.aggregate([
      { $group: { _id: '$nationality', count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 10 }
    ]);

    const [withCoc, withoutCoc] = await Promise.all([
      Candidate.countDocuments({ cocNumber: { $nin: [null, ''] } }),
      Candidate.countDocuments({ $or: [{ cocNumber: null }, { cocNumber: '' }, { cocNumber: { $exists: false } }] })
    ]);

    const availabilityBreakdown = await Candidate.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }, { $sort: { count: -1 } }
    ]);
    const workflowBreakdown = await Candidate.aggregate([
      { $group: { _id: '$workflowStage', count: { $sum: 1 } } }, { $sort: { count: -1 } }
    ]);
    const expProfile = await Candidate.aggregate([
      { $match: { experienceYears: { $gt: 0 } } },
      { $group: { _id: null, avgExp: { $avg: '$experienceYears' }, maxExp: { $max: '$experienceYears' }, minExp: { $min: '$experienceYears' } } }
    ]);
    const sourceBreakdown = await JobApplication.aggregate([
      { $match: appMatch }, { $group: { _id: '$referralSource', count: { $sum: 1 } } }, { $sort: { count: -1 } }
    ]);
    const attentionQueue = await JobApplication.find({ status: 'NEW' })
      .sort({ createdAt: -1 }).limit(8)
      .select('fullName rankAppliedFor department cocNumber createdAt status mobileNumber nationality');

    res.json({
      success: true,
      data: {
        kpis: { totalApplications, newApplications, shortlistedCount, hiredCount, rejectedCount, conversionRate: parseFloat(conversionRate), totalCandidates, availableCandidates },
        pipelineByStatus, trendMonthly, rankDistribution, deptDistribution, nationalityTop,
        cocHealth: { withCoc, withoutCoc },
        availabilityBreakdown, workflowBreakdown,
        experienceProfile: expProfile[0] || { avgExp: 0, maxExp: 0, minExp: 0 },
        sourceBreakdown, attentionQueue,
      }
    });
  } catch (err) {
    console.error('[reportsController] getCrewingReport:', err);
    res.status(500).json({ success: false, message: 'Failed to generate crewing report.', error: err.message });
  }
};

exports.getFrontDeskReport = async (req, res) => {
  try {
    const { dateFrom, dateTo } = req.query;
    const visitorMatch  = Object.assign({}, buildDateRange(dateFrom, dateTo, 'checkInTime'));
    const docMatch      = Object.assign({}, buildDateRange(dateFrom, dateTo));
    const callMatchBase = Object.assign({}, buildDateRange(dateFrom, dateTo));

    const [totalVisitors, checkedOutVisitors, stillInside, totalDocs, withAgency, returnedDocs] = await Promise.all([
      Visitor.countDocuments(visitorMatch),
      Visitor.countDocuments(Object.assign({}, visitorMatch, { checkOutTime: { $ne: null } })),
      Visitor.countDocuments(Object.assign({}, visitorMatch, { checkOutTime: null })),
      DocIntake.countDocuments(docMatch),
      DocIntake.countDocuments(Object.assign({}, docMatch, { status: 'WITH_AGENCY' })),
      DocIntake.countDocuments(Object.assign({}, docMatch, { status: 'RETURNED_TO_SEAFARER' })),
    ]);

    let totalCalls = 0, pendingCalls = 0, resolvedCalls = 0, callsByStatus = [];
    if (ReceptionCallModel) {
      [totalCalls, pendingCalls, resolvedCalls] = await Promise.all([
        ReceptionCallModel.countDocuments(callMatchBase),
        ReceptionCallModel.countDocuments(Object.assign({}, callMatchBase, { status: { $in: ['PENDING', 'NEW'] } })),
        ReceptionCallModel.countDocuments(Object.assign({}, callMatchBase, { status: { $in: ['RESOLVED', 'CLOSED', 'DONE'] } })),
      ]);
      callsByStatus = await ReceptionCallModel.aggregate([
        { $match: callMatchBase }, { $group: { _id: '$status', count: { $sum: 1 } } }, { $sort: { count: -1 } }
      ]);
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
    thirtyDaysAgo.setHours(0,0,0,0);

    const visitorsByDay = await Visitor.aggregate([
      { $match: { checkInTime: { $gte: thirtyDaysAgo } } },
      { $group: { _id: { year: { $year: '$checkInTime' }, month: { $month: '$checkInTime' }, day: { $dayOfMonth: '$checkInTime' } }, count: { $sum: 1 } } },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
    ]);
    const visitorsByPurpose = await Visitor.aggregate([
      { $match: visitorMatch },
      { $group: { _id: { $ifNull: ['$purpose', 'Not Specified'] }, count: { $sum: 1 } } },
      { $sort: { count: -1 } }, { $limit: 10 }
    ]);
    const docsByType = await DocIntake.aggregate([
      { $match: docMatch }, { $unwind: '$documentType' },
      { $group: { _id: '$documentType', count: { $sum: 1 } } }, { $sort: { count: -1 } }
    ]);
    const docsByCustody = await DocIntake.aggregate([
      { $match: docMatch }, { $group: { _id: '$status', count: { $sum: 1 } } }, { $sort: { count: -1 } }
    ]);
    const durationAgg = await Visitor.aggregate([
      { $match: Object.assign({}, visitorMatch, { checkOutTime: { $ne: null } }) },
      { $project: { durationMs: { $subtract: ['$checkOutTime', '$checkInTime'] } } },
      { $group: { _id: null, avgMs: { $avg: '$durationMs' } } }
    ]);
    const avgVisitMinutes = durationAgg.length > 0 ? Math.round(durationAgg[0].avgMs / 60000) : 0;

    const recentVisitors = await Visitor.find({}).sort({ checkInTime: -1 }).limit(10)
      .select('name phone company purpose checkInTime checkOutTime contactPerson');
    const docsWithAgency = await DocIntake.find({ status: 'WITH_AGENCY' }).sort({ createdAt: -1 }).limit(10)
      .select('seafarerName documentType documentNumber status createdAt custodyLocation');

    res.json({
      success: true,
      data: {
        kpis: { totalVisitors, checkedOutVisitors, stillInside, totalCalls, pendingCalls, resolvedCalls, totalDocs, withAgency, returnedDocs, avgVisitMinutes },
        visitorsByDay, visitorsByPurpose, callsByStatus, docsByType, docsByCustody,
        recentVisitors, docsWithAgency,
      }
    });
  } catch (err) {
    console.error('[reportsController] getFrontDeskReport:', err);
    res.status(500).json({ success: false, message: 'Failed to generate front desk report.', error: err.message });
  }
};
