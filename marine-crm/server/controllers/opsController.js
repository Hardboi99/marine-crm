const { Onboarding, Candidate, Requirement, Invoice, Company } = require('../models');
const { logActivity } = require('../utils/activityLogger');
const crypto = require('crypto');

// ─── ONBOARDING & DOCUMENTATION CHECKLISTS ────────────────────────

const getOnboardings = async (req, res, next) => {
  try {
    const { candidateId, status } = req.query;
    const query = {};

    if (candidateId) query.candidateId = candidateId;
    if (status) query.status = status;

    const onboardings = await Onboarding.find(query)
      .sort({ createdAt: -1 })
      .populate('candidateId')
      .populate({
        path: 'requirementId',
        populate: { path: 'companyId', select: 'name' }
      });

    res.json({ success: true, data: onboardings });
  } catch (err) {
    next(err);
  }
};

const updateOnboarding = async (req, res, next) => {
  try {
    const allowed = [
      'contractPrepared', 'contractSigned', 'cdcValidityChecked', 'passportValidityChecked',
      'medicalCleared', 'visaProcessed', 'ticketBooked', 'flightDetails', 'vesselName',
      'portOfJoining', 'reportingDate', 'status'
    ];
    const updateData = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));

    if (updateData.reportingDate) updateData.reportingDate = new Date(updateData.reportingDate);

    // Save update who edited
    updateData.updatedById = req.user.id;

    const onboarding = await Onboarding.findByIdAndUpdate(req.params.id, updateData, { new: true })
      .populate('candidateId')
      .populate({
        path: 'requirementId',
        populate: { path: 'companyId', select: 'name' }
      });

    if (!onboarding) return res.status(404).json({ success: false, message: 'Onboarding record not found.' });

    // Auto-update Candidate status if Onboarding checklist items are fully completed
    const candidate = await Candidate.findById(onboarding.candidateId._id);
    if (candidate) {
      if (onboarding.status === 'COMPLETED') {
        candidate.status = 'ONBOARDED';
        await candidate.save();

        // Mark requirement as fulfilled too
        await Requirement.findByIdAndUpdate(onboarding.requirementId._id, { status: 'FULFILLED' });
      } else {
        candidate.status = 'DOCUMENTATION';
        await candidate.save();
      }
    }

    await logActivity({
      userId: req.user.id,
      entityType: 'ONBOARDING',
      entityId: onboarding._id.toString(),
      action: 'UPDATED_ONBOARDING',
      details: { candidate: onboarding.candidateId?.name, status: onboarding.status }
    });

    res.json({ success: true, data: onboarding });
  } catch (err) {
    next(err);
  }
};

// ─── CLIENT INVOICES (ACCOUNTS) ───────────────────────────────────

const getInvoices = async (req, res, next) => {
  try {
    const { companyId, paymentStatus } = req.query;
    const query = {};

    if (companyId) query.companyId = companyId;
    if (paymentStatus) query.paymentStatus = paymentStatus;

    const invoices = await Invoice.find(query)
      .sort({ createdAt: -1 })
      .populate('companyId', 'name')
      .populate('candidateId', 'name rank')
      .populate('requirementId', 'rank vesselType');

    res.json({ success: true, data: invoices });
  } catch (err) {
    next(err);
  }
};

const createInvoice = async (req, res, next) => {
  try {
    const { companyId, candidateId, requirementId, amount, candidateCharges, salaryAgreed, dueDate } = req.body;
    if (!companyId || !candidateId || !requirementId || !amount || !dueDate) {
      return res.status(400).json({ success: false, message: 'companyId, candidateId, requirementId, amount, and dueDate are required.' });
    }

    // Generate unique invoice number
    const dateStr = new Date().getFullYear().toString();
    const rand = crypto.randomBytes(3).toString('hex').toUpperCase();
    const invoiceNumber = `INV-${dateStr}-${rand}`;

    const invoice = await Invoice.create({
      companyId,
      candidateId,
      requirementId,
      invoiceNumber,
      amount: parseFloat(amount),
      candidateCharges: candidateCharges ? parseFloat(candidateCharges) : 0,
      salaryAgreed: salaryAgreed ? parseFloat(salaryAgreed) : 0,
      dueDate: new Date(dueDate),
      createdById: req.user.id
    });

    await invoice.populate('companyId', 'name');
    await invoice.populate('candidateId', 'name');

    await logActivity({
      userId: req.user.id,
      entityType: 'INVOICE',
      entityId: invoice._id.toString(),
      action: 'GENERATED_INVOICE',
      details: { invoiceNumber, company: invoice.companyId?.name, candidate: invoice.candidateId?.name }
    });

    res.status(201).json({ success: true, data: invoice });
  } catch (err) {
    next(err);
  }
};

const updateInvoice = async (req, res, next) => {
  try {
    const allowed = ['paymentStatus', 'amount', 'candidateCharges', 'salaryAgreed', 'dueDate'];
    const updateData = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));

    if (updateData.dueDate) updateData.dueDate = new Date(updateData.dueDate);

    const invoice = await Invoice.findByIdAndUpdate(req.params.id, updateData, { new: true })
      .populate('companyId', 'name')
      .populate('candidateId', 'name');

    if (!invoice) return res.status(404).json({ success: false, message: 'Invoice not found.' });

    res.json({ success: true, data: invoice });
  } catch (err) {
    next(err);
  }
};

// ─── DOCUMENT EXPIRY & COMPLIANCE ALERTS ─────────────────────────

const getExpiryAlerts = async (req, res, next) => {
  try {
    // Queries all candidates where passport, CDC, or COC will expire in 90 days
    const alertThreshold = new Date();
    alertThreshold.setDate(alertThreshold.getDate() + 90);

    const expiringCandidates = await Candidate.find({
      $or: [
        { 'passportDetails.expiryDate': { $lte: alertThreshold } },
        { 'cdcDetails.expiryDate': { $lte: alertThreshold } },
        { 'cocDetails.expiryDate': { $lte: alertThreshold } }
      ]
    }).sort({ name: 1 });

    const alerts = expiringCandidates.map(c => {
      const candidateAlerts = [];
      const now = new Date();

      if (c.passportDetails.expiryDate <= alertThreshold) {
        const days = Math.round((c.passportDetails.expiryDate - now) / (1000 * 60 * 60 * 24));
        candidateAlerts.push({ type: 'PASSPORT', expiryDate: c.passportDetails.expiryDate, daysLeft: days });
      }
      if (c.cdcDetails.expiryDate <= alertThreshold) {
        const days = Math.round((c.cdcDetails.expiryDate - now) / (1000 * 60 * 60 * 24));
        candidateAlerts.push({ type: 'CDC', expiryDate: c.cdcDetails.expiryDate, daysLeft: days });
      }
      if (c.cocDetails.expiryDate <= alertThreshold) {
        const days = Math.round((c.cocDetails.expiryDate - now) / (1000 * 60 * 60 * 24));
        candidateAlerts.push({ type: 'COC', expiryDate: c.cocDetails.expiryDate, daysLeft: days });
      }

      return {
        id: c._id.toString(),
        name: c.name,
        rank: c.rank,
        contactNumber: c.contactNumber,
        email: c.email,
        alerts: candidateAlerts
      };
    });

    res.json({ success: true, data: alerts });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getOnboardings,
  updateOnboarding,
  getInvoices,
  createInvoice,
  updateInvoice,
  getExpiryAlerts
};
