const { Country, Company, Call, Appointment, Contract } = require('../models');
const { logActivity } = require('../utils/activityLogger');
const { getDataScope, canAccessRecord } = require('../utils/accessScope');

// ─── COUNTRIES ────────────────────────────────────────────────

const getCountries = async (req, res, next) => {
  try {
    const { search } = req.query;
    const query = search ? { name: { $regex: search, $options: 'i' } } : {};

    const countries = await Country.find(query).sort({ name: 1 });
    const countryIds = countries.map((c) => c._id);

    const companyCounts = await Company.aggregate([
      { $match: { countryId: { $in: countryIds } } },
      { $group: { _id: '$countryId', count: { $sum: 1 } } },
    ]);
    const countMap = Object.fromEntries(companyCounts.map((c) => [c._id.toString(), c.count]));

    const data = countries.map((c) => {
      const obj = c.toJSON();
      obj._count = { companies: countMap[c._id.toString()] || 0 };
      return obj;
    });

    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

const getCountry = async (req, res, next) => {
  try {
    const country = await Country.findById(req.params.id);
    if (!country) return res.status(404).json({ success: false, message: 'Country not found.' });
    res.json({ success: true, data: country });
  } catch (err) {
    next(err);
  }
};

const createCountry = async (req, res, next) => {
  try {
    const { name, code } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Country name is required.' });

    const country = await Country.create({ name: name.trim(), code: code?.trim() });

    if (req.user) {
      await logActivity({
        userId: req.user.id,
        entityType: 'COUNTRY',
        entityId: country._id.toString(),
        action: 'CREATED_COUNTRY',
        details: { name: country.name, code: country.code },
      });
    }

    res.status(201).json({ success: true, data: country });
  } catch (err) {
    next(err);
  }
};

const updateCountry = async (req, res, next) => {
  try {
    const { name, code, isActive } = req.body;
    const country = await Country.findByIdAndUpdate(
      req.params.id,
      {
        ...(name && { name: name.trim() }),
        ...(code !== undefined && { code: code?.trim() || null }),
        ...(isActive !== undefined && { isActive }),
      },
      { new: true }
    );
    if (!country) return res.status(404).json({ success: false, message: 'Country not found.' });
    res.json({ success: true, data: country });
  } catch (err) {
    next(err);
  }
};

const deleteCountry = async (req, res, next) => {
  try {
    const country = await Country.findByIdAndDelete(req.params.id);
    if (!country) return res.status(404).json({ success: false, message: 'Country not found.' });
    res.json({ success: true, message: 'Country deleted.' });
  } catch (err) {
    next(err);
  }
};

// ─── COMPANIES ────────────────────────────────────────────────

const getCompanies = async (req, res, next) => {
  try {
    const { search, countryId, status, page = 1, limit = 50 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {};
    if (search) {
      where.$or = [
        { name: { $regex: search, $options: 'i' } },
        { contactPerson: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
      ];
    }
    if (countryId) where.countryId = countryId;
    if (status) where.status = status;

    // Ownership-scoped: a BDM only sees companies they created/own unless
    // their role has organisation-wide visibility (see accessScope.js).
    const scope = await getDataScope(req.currentUser, 'COMPANY');
    if (scope.$or && where.$or) {
      const { $or: scopeOr } = scope;
      where.$and = [{ $or: where.$or }, { $or: scopeOr }];
      delete where.$or;
    } else {
      Object.assign(where, scope);
    }

    const [companies, total] = await Promise.all([
      Company.find(where)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate('countryId')
        .populate('createdById', 'name'),
      Company.countDocuments(where),
    ]);

    const companyIds = companies.map((c) => c._id);
    const [callsGroup, apptsGroup, contractsGroup] = await Promise.all([
      Call.aggregate([{ $match: { companyId: { $in: companyIds } } }, { $group: { _id: '$companyId', count: { $sum: 1 } } }]),
      Appointment.aggregate([{ $match: { companyId: { $in: companyIds } } }, { $group: { _id: '$companyId', count: { $sum: 1 } } }]),
      Contract.aggregate([{ $match: { companyId: { $in: companyIds } } }, { $group: { _id: '$companyId', count: { $sum: 1 } } }]),
    ]);

    const callsMap = Object.fromEntries(callsGroup.map((g) => [g._id.toString(), g.count]));
    const apptsMap = Object.fromEntries(apptsGroup.map((g) => [g._id.toString(), g.count]));
    const contractsMap = Object.fromEntries(contractsGroup.map((g) => [g._id.toString(), g.count]));

    const data = companies.map((c) => {
      const obj = c.toJSON();
      obj.country = c.countryId;
      obj.createdBy = c.createdById ? { name: c.createdById.name } : null;
      obj._count = {
        calls: callsMap[c._id.toString()] || 0,
        appointments: apptsMap[c._id.toString()] || 0,
        contracts: contractsMap[c._id.toString()] || 0,
      };
      return obj;
    });

    res.json({
      success: true,
      data,
      meta: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (err) {
    next(err);
  }
};

const getCompany = async (req, res, next) => {
  try {
    const company = await Company.findById(req.params.id)
      .populate('countryId')
      .populate('createdById', 'name');

    if (!company) return res.status(404).json({ success: false, message: 'Company not found.' });

    const allowedToAccess = await canAccessRecord(req.currentUser, company, 'COMPANY');
    if (!allowedToAccess) {
      return res.status(403).json({ success: false, message: 'You do not have access to this company record.' });
    }

    const [calls, appointments, contracts] = await Promise.all([
      Call.find({ companyId: company._id }).sort({ callDate: -1 }).limit(10).populate('userId', 'name'),
      Appointment.find({ companyId: company._id })
        .sort({ scheduledAt: -1 })
        .limit(10)
        .populate('reasonId')
        .populate('decidedById', 'name'),
      Contract.find({ companyId: company._id }).sort({ createdAt: -1 }),
    ]);

    const obj = company.toJSON();
    obj.country = company.countryId;
    obj.createdBy = company.createdById ? { id: company.createdById._id.toString(), name: company.createdById.name } : null;
    obj.calls = calls.map((c) => {
      const cObj = c.toJSON();
      cObj.user = c.userId ? { name: c.userId.name } : null;
      return cObj;
    });
    obj.appointments = appointments.map((a) => {
      const aObj = a.toJSON();
      aObj.reason = a.reasonId;
      aObj.decidedBy = a.decidedById ? { name: a.decidedById.name } : null;
      return aObj;
    });
    obj.contracts = contracts.map((c) => c.toJSON());

    res.json({ success: true, data: obj });
  } catch (err) {
    next(err);
  }
};

const createCompany = async (req, res, next) => {
  try {
    const { name, countryId, fleetDetails, contactPerson, email, phone, website, status, notes } = req.body;
    if (!name || !countryId) return res.status(400).json({ success: false, message: 'Company name and country are required.' });

    const company = await Company.create({
      name: name.trim(),
      countryId,
      fleetDetails: fleetDetails?.trim() || null,
      contactPerson: contactPerson?.trim() || null,
      email: email?.toLowerCase().trim() || null,
      phone: phone?.trim() || null,
      website: website?.trim() || null,
      status: status || 'PROSPECT',
      notes: notes?.trim() || null,
      createdById: req.user.id,
    });

    await company.populate('countryId');

    const companyObj = company.toJSON();
    companyObj.country = company.countryId;

    await logActivity({
      userId: req.user.id,
      entityType: 'COMPANY',
      entityId: company._id.toString(),
      action: 'ADDED_VESSEL_OWNER',
      details: { name: company.name, country: company.countryId?.name, status: company.status },
    });

    res.status(201).json({ success: true, data: companyObj });
  } catch (err) {
    next(err);
  }
};

const updateCompany = async (req, res, next) => {
  try {
    const existing = await Company.findById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, message: 'Company not found.' });

    const allowedToAccess = await canAccessRecord(req.currentUser, existing, 'COMPANY');
    if (!allowedToAccess) {
      return res.status(403).json({ success: false, message: 'You do not have access to this company record.' });
    }

    const allowed = ['name', 'countryId', 'fleetDetails', 'contactPerson', 'email', 'phone', 'website', 'status', 'notes'];
    const data = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
    if (data.name) data.name = data.name.trim();
    if (data.email) data.email = data.email.toLowerCase().trim();

    const company = await Company.findByIdAndUpdate(req.params.id, data, { new: true }).populate('countryId');

    if (!company) return res.status(404).json({ success: false, message: 'Company not found.' });

    const companyObj = company.toJSON();
    companyObj.country = company.countryId;

    await logActivity({
      userId: req.user.id,
      entityType: 'COMPANY',
      entityId: company._id.toString(),
      action: 'UPDATED_VESSEL_OWNER',
      details: { name: company.name, status: company.status },
    });

    res.json({ success: true, data: companyObj });
  } catch (err) {
    next(err);
  }
};

const deleteCompany = async (req, res, next) => {
  try {
    const company = await Company.findById(req.params.id);
    if (!company) return res.status(404).json({ success: false, message: 'Company not found.' });

    const allowedToAccess = await canAccessRecord(req.currentUser, company, 'COMPANY');
    if (!allowedToAccess) {
      return res.status(403).json({ success: false, message: 'You do not have access to this company record.' });
    }

    await Company.findByIdAndDelete(req.params.id);
    await Call.deleteMany({ companyId: req.params.id });
    await Appointment.deleteMany({ companyId: req.params.id });
    await Contract.deleteMany({ companyId: req.params.id });

    if (req.user) {
      await logActivity({
        userId: req.user.id,
        entityType: 'COMPANY',
        entityId: req.params.id,
        action: 'DELETED_COMPANY',
        details: { name: company.name },
      });
    }

    res.json({ success: true, message: 'Company deleted.' });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getCountries,
  getCountry,
  createCountry,
  updateCountry,
  deleteCountry,
  getCompanies,
  getCompany,
  createCompany,
  updateCompany,
  deleteCompany,
};