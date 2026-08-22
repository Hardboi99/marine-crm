const path = require('path');
const fs = require('fs');
const { Contract, Company } = require('../models');
const { logActivity } = require('../utils/activityLogger');
const { getDataScope, canAccessRecord } = require('../utils/accessScope');

// ─── CONTRACTS ────────────────────────────────────────────────

const getContracts = async (req, res, next) => {
  try {
    const { companyId, status, search, page = 1, limit = 50 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {};
    if (companyId) where.companyId = companyId;
    if (status) where.status = status;

    if (search) {
      const matchingCompanies = await Company.find({ name: { $regex: search, $options: 'i' } }).select('_id');
      const matchingCompanyIds = matchingCompanies.map((c) => c._id);

      where.$or = [
        { title: { $regex: search, $options: 'i' } },
        { notes: { $regex: search, $options: 'i' } },
        { companyId: { $in: matchingCompanyIds } },
      ];
    }

    const scope = await getDataScope(req.currentUser, 'CONTRACT');
    if (scope.$or && where.$or) {
      const { $or: scopeOr } = scope;
      where.$and = [{ $or: where.$or }, { $or: scopeOr }];
      delete where.$or;
    } else {
      Object.assign(where, scope);
    }

    const [contracts, total] = await Promise.all([
      Contract.find(where)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate('companyId', 'name')
        .populate('createdById', 'name')
        .populate('appointmentId', 'scheduledAt'),
      Contract.countDocuments(where),
    ]);

    const data = contracts.map((c) => {
      const obj = c.toJSON();
      const companyIdStr = c.companyId?._id ? c.companyId._id.toString() : (c.companyId ? c.companyId.toString() : null);
      const apptIdStr = c.appointmentId?._id ? c.appointmentId._id.toString() : (c.appointmentId ? c.appointmentId.toString() : null);
      
      obj.company = c.companyId ? { id: companyIdStr, name: c.companyId.name } : null;
      obj.companyId = companyIdStr;
      obj.createdBy = c.createdById ? { name: c.createdById.name } : null;
      obj.appointment = c.appointmentId ? { scheduledAt: c.appointmentId.scheduledAt } : null;
      obj.appointmentId = apptIdStr;
      return obj;
    });

    res.json({ success: true, data, meta: { total, page: parseInt(page), limit: parseInt(limit) } });
  } catch (err) {
    next(err);
  }
};

const getContract = async (req, res, next) => {
  try {
    const contract = await Contract.findById(req.params.id)
      .populate('companyId')
      .populate('createdById', 'name')
      .populate('appointmentId');

    if (!contract) return res.status(404).json({ success: false, message: 'Contract not found.' });

    const allowedToAccess = await canAccessRecord(req.currentUser, contract, 'CONTRACT');
    if (!allowedToAccess) {
      return res.status(403).json({ success: false, message: 'You do not have access to this contract.' });
    }

    const obj = contract.toJSON();
    obj.company = contract.companyId;
    obj.companyId = contract.companyId?._id ? contract.companyId._id.toString() : contract.companyId;
    obj.createdBy = contract.createdById ? { name: contract.createdById.name } : null;
    obj.appointment = contract.appointmentId;
    obj.appointmentId = contract.appointmentId?._id ? contract.appointmentId._id.toString() : contract.appointmentId;

    res.json({ success: true, data: obj });
  } catch (err) {
    next(err);
  }
};

const createContract = async (req, res, next) => {
  try {
    const { companyId, appointmentId, title, status, signedDate, expiryDate, notes } = req.body;
    if (!companyId || !title) return res.status(400).json({ success: false, message: 'companyId and title are required.' });

    const fileUrl = req.file ? `/uploads/${req.file.filename}` : null;
    const contract = await Contract.create({
      companyId,
      appointmentId: appointmentId && appointmentId !== 'null' && appointmentId !== '' ? appointmentId : null,
      title: title.trim(),
      fileUrl,
      status: status || 'DRAFT',
      signedDate: signedDate && signedDate !== 'null' && signedDate !== 'undefined' && signedDate !== '' ? new Date(signedDate) : null,
      expiryDate: expiryDate && expiryDate !== 'null' && expiryDate !== 'undefined' && expiryDate !== '' ? new Date(expiryDate) : null,
      notes: notes?.trim() || null,
      createdById: req.user.id,
    });

    await contract.populate('companyId', 'name');
    const obj = contract.toJSON();
    obj.company = contract.companyId ? { id: contract.companyId._id.toString(), name: contract.companyId.name } : null;
    obj.companyId = contract.companyId?._id ? contract.companyId._id.toString() : contract.companyId;

    await logActivity({
      userId: req.user.id,
      entityType: 'CONTRACT',
      entityId: contract._id.toString(),
      action: 'CREATED_CONTRACT',
      details: { title: contract.title, company: contract.companyId?.name, status: contract.status },
    });

    res.status(201).json({ success: true, data: obj });
  } catch (err) {
    next(err);
  }
};

const updateContract = async (req, res, next) => {
  try {
    const existingContract = await Contract.findById(req.params.id);
    if (!existingContract) return res.status(404).json({ success: false, message: 'Contract not found.' });

    const allowedToAccess = await canAccessRecord(req.currentUser, existingContract, 'CONTRACT');
    if (!allowedToAccess) {
      return res.status(403).json({ success: false, message: 'You do not have access to this contract.' });
    }

    const allowed = ['companyId', 'appointmentId', 'title', 'status', 'signedDate', 'expiryDate', 'notes'];
    const data = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));

    if (data.companyId === '') delete data.companyId;
    if (data.title) data.title = data.title.trim();
    
    data.appointmentId = data.appointmentId && data.appointmentId !== 'null' && data.appointmentId !== 'undefined' && data.appointmentId !== '' ? data.appointmentId : null;
    data.signedDate = data.signedDate && data.signedDate !== 'null' && data.signedDate !== 'undefined' && data.signedDate !== '' ? new Date(data.signedDate) : null;
    data.expiryDate = data.expiryDate && data.expiryDate !== 'null' && data.expiryDate !== 'undefined' && data.expiryDate !== '' ? new Date(data.expiryDate) : null;

    if (req.file) data.fileUrl = `/uploads/${req.file.filename}`;

    const contract = await Contract.findByIdAndUpdate(req.params.id, data, { new: true }).populate('companyId', 'name');

    if (!contract) return res.status(404).json({ success: false, message: 'Contract not found.' });

    const obj = contract.toJSON();
    obj.company = contract.companyId ? { id: contract.companyId._id.toString(), name: contract.companyId.name } : null;
    obj.companyId = contract.companyId?._id ? contract.companyId._id.toString() : contract.companyId;

    await logActivity({
      userId: req.user.id,
      entityType: 'CONTRACT',
      entityId: contract._id.toString(),
      action: 'UPDATED_CONTRACT',
      details: { title: contract.title, company: contract.companyId?.name, status: contract.status },
    });

    res.json({ success: true, data: obj });
  } catch (err) {
    next(err);
  }
};

const deleteContract = async (req, res, next) => {
  try {
    const contract = await Contract.findById(req.params.id).populate('companyId', 'name');
    if (!contract) return res.status(404).json({ success: false, message: 'Contract not found.' });

    const allowedToAccess = await canAccessRecord(req.currentUser, contract, 'CONTRACT');
    if (!allowedToAccess) {
      return res.status(403).json({ success: false, message: 'You do not have access to this contract.' });
    }

    await Contract.findByIdAndDelete(req.params.id);

    if (req.user) {
      await logActivity({
        userId: req.user.id,
        entityType: 'CONTRACT',
        entityId: req.params.id,
        action: 'DELETED_CONTRACT',
        details: { title: contract.title, company: contract.companyId?.name },
      });
    }

    res.json({ success: true, message: 'Contract deleted.' });
  } catch (err) {
    next(err);
  }
};

const downloadContractFile = async (req, res, next) => {
  try {
    const contract = await Contract.findById(req.params.id);
    if (!contract) return res.status(404).json({ success: false, message: 'Contract not found.' });

    const allowedToAccess = await canAccessRecord(req.currentUser, contract, 'CONTRACT');
    if (!allowedToAccess) {
      return res.status(403).json({ success: false, message: 'You do not have access to this contract.' });
    }

    if (!contract.fileUrl) {
      return res.status(404).json({ success: false, message: 'No file attached to this contract.' });
    }

    const filename = path.basename(contract.fileUrl);
    const absPath = path.join(__dirname, '..', 'uploads', filename);
    if (!fs.existsSync(absPath)) {
      return res.status(404).json({ success: false, message: 'File not found on disk.' });
    }

    const safeTitle = (contract.title || 'contract').replace(/[^a-zA-Z0-9.\-_]/g, '_');
    return res.download(absPath, `${safeTitle}${path.extname(filename)}`);
  } catch (err) {
    next(err);
  }
};

module.exports = { getContracts, getContract, createContract, updateContract, deleteContract, downloadContractFile };