const { Visitor, ReceptionCall, PpeStock, PpeIssuance, DocIntake, Employee } = require('../models');
const { logActivity } = require('../utils/activityLogger');

// ─── VISITOR LOGS ────────────────────────────────────────────────────────────

const listVisitors = async (req, res, next) => {
  try {
    const { checkOutStatus } = req.query; // 'IN' or 'OUT'
    const query = {};
    if (checkOutStatus === 'IN') {
      query.checkOutTime = null;
    } else if (checkOutStatus === 'OUT') {
      query.checkOutTime = { $ne: null };
    }

    const visitors = await Visitor.find(query).sort({ createdAt: -1 });
    res.json({ success: true, data: visitors });
  } catch (err) {
    next(err);
  }
};

const createVisitor = async (req, res, next) => {
  try {
    const { name, phone, company, purpose, contactPerson } = req.body;
    if (!name || !phone) {
      return res.status(400).json({ success: false, message: 'Name and phone are required.' });
    }

    const visitor = await Visitor.create({
      name,
      phone,
      company: company || '',
      purpose: purpose || '',
      contactPerson: contactPerson || '',
      createdById: req.user.id
    });

    await logActivity({
      userId: req.user.id,
      entityType: 'RECEPTION_VISITOR',
      entityId: visitor._id.toString(),
      action: 'VISITOR_CHECK_IN',
      details: { name: visitor.name, purpose: visitor.purpose }
    });

    res.status(201).json({ success: true, data: visitor });
  } catch (err) {
    next(err);
  }
};

const checkOutVisitor = async (req, res, next) => {
  try {
    const visitor = await Visitor.findByIdAndUpdate(
      req.params.id,
      { checkOutTime: new Date() },
      { new: true }
    );

    if (!visitor) {
      return res.status(404).json({ success: false, message: 'Visitor record not found.' });
    }

    await logActivity({
      userId: req.user.id,
      entityType: 'RECEPTION_VISITOR',
      entityId: visitor._id.toString(),
      action: 'VISITOR_CHECK_OUT',
      details: { name: visitor.name }
    });

    res.json({ success: true, data: visitor });
  } catch (err) {
    next(err);
  }
};

// ─── INCOMING CALLS ──────────────────────────────────────────────────────────

const listCalls = async (req, res, next) => {
  try {
    const { status } = req.query;
    const query = {};
    if (status) query.status = status;

    const calls = await ReceptionCall.find(query).sort({ createdAt: -1 });
    res.json({ success: true, data: calls });
  } catch (err) {
    next(err);
  }
};

const createCall = async (req, res, next) => {
  try {
    const { callerName, phone, company, message } = req.body;
    if (!callerName || !phone || !message) {
      return res.status(400).json({ success: false, message: 'Caller name, phone, and message are required.' });
    }

    const call = await ReceptionCall.create({
      callerName,
      phone,
      company: company || '',
      message,
      createdById: req.user.id
    });

    await logActivity({
      userId: req.user.id,
      entityType: 'RECEPTION_CALL',
      entityId: call._id.toString(),
      action: 'CALL_LOGGED',
      details: { callerName: call.callerName, phone: call.phone }
    });

    res.status(201).json({ success: true, data: call });
  } catch (err) {
    next(err);
  }
};

const updateCallStatus = async (req, res, next) => {
  try {
    const { status, forwardedTo } = req.body;
    const allowed = ['PENDING', 'RESOLVED', 'FORWARDED', 'CALLBACK'];
    if (status && !allowed.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid call status value.' });
    }

    const updates = {};
    if (status) updates.status = status;
    if (forwardedTo !== undefined) updates.forwardedTo = forwardedTo;

    const call = await ReceptionCall.findByIdAndUpdate(req.params.id, updates, { new: true });
    if (!call) {
      return res.status(404).json({ success: false, message: 'Call log not found.' });
    }

    await logActivity({
      userId: req.user.id,
      entityType: 'RECEPTION_CALL',
      entityId: call._id.toString(),
      action: 'CALL_STATUS_UPDATED',
      details: { status: call.status, forwardedTo: call.forwardedTo }
    });

    res.json({ success: true, data: call });
  } catch (err) {
    next(err);
  }
};

// ─── PPE STOCK & ISSUANCES ───────────────────────────────────────────────────

const listPpeStock = async (req, res, next) => {
  try {
    let stock = await PpeStock.find().sort({ itemName: 1 });
    
    // Seed default stock values if empty
    if (stock.length === 0) {
      const defaults = [
        { itemName: 'Helmet', totalQuantity: 50, availableQuantity: 50 },
        { itemName: 'Safety Shoes', totalQuantity: 30, availableQuantity: 30 },
        { itemName: 'Coverall', totalQuantity: 40, availableQuantity: 40 },
        { itemName: 'Safety Glasses', totalQuantity: 60, availableQuantity: 60 },
        { itemName: 'Work Gloves', totalQuantity: 100, availableQuantity: 100 }
      ];
      await PpeStock.insertMany(defaults);
      stock = await PpeStock.find().sort({ itemName: 1 });
    }
    
    res.json({ success: true, data: stock });
  } catch (err) {
    next(err);
  }
};

const updatePpeStock = async (req, res, next) => {
  try {
    const { itemName, totalQuantity, availableQuantity } = req.body;
    if (!itemName) {
      return res.status(400).json({ success: false, message: 'Item name is required.' });
    }

    const stock = await PpeStock.findOneAndUpdate(
      { itemName: itemName.trim() },
      { 
        $set: { 
          totalQuantity: totalQuantity !== undefined ? parseInt(totalQuantity) : 0,
          availableQuantity: availableQuantity !== undefined ? parseInt(availableQuantity) : 0 
        } 
      },
      { upsert: true, new: true }
    );

    res.json({ success: true, data: stock });
  } catch (err) {
    next(err);
  }
};

const listPpeIssuances = async (req, res, next) => {
  try {
    const issuances = await PpeIssuance.find()
      .sort({ createdAt: -1 })
      .populate('employeeId', 'name position employeeId');
    res.json({ success: true, data: issuances });
  } catch (err) {
    next(err);
  }
};

const issuePpe = async (req, res, next) => {
  try {
    const { employeeId, itemName, quantity } = req.body;
    if (!employeeId || !itemName || !quantity) {
      return res.status(400).json({ success: false, message: 'employeeId, itemName, and quantity are required.' });
    }

    const qty = parseInt(quantity);
    if (qty <= 0) {
      return res.status(400).json({ success: false, message: 'Quantity must be greater than zero.' });
    }

    // Verify stock availability
    const stock = await PpeStock.findOne({ itemName });
    if (!stock || stock.availableQuantity < qty) {
      return res.status(400).json({ success: false, message: `Insufficient stock for ${itemName}. Available: ${stock ? stock.availableQuantity : 0}` });
    }

    // Deduct stock
    stock.availableQuantity -= qty;
    await stock.save();

    const issuance = await PpeIssuance.create({
      employeeId,
      itemName,
      quantity: qty,
      createdById: req.user.id
    });

    await issuance.populate('employeeId', 'name position');

    await logActivity({
      userId: req.user.id,
      entityType: 'PPE_ISSUANCE',
      entityId: issuance._id.toString(),
      action: 'PPE_ISSUED',
      details: { itemName, quantity: qty, employee: issuance.employeeId?.name }
    });

    res.status(201).json({ success: true, data: issuance });
  } catch (err) {
    next(err);
  }
};

const returnPpe = async (req, res, next) => {
  try {
    const issuance = await PpeIssuance.findById(req.params.id);
    if (!issuance) {
      return res.status(404).json({ success: false, message: 'Issuance record not found.' });
    }

    if (issuance.status === 'RETURNED') {
      return res.status(400).json({ success: false, message: 'PPE is already returned.' });
    }

    // Return stock
    const stock = await PpeStock.findOne({ itemName: issuance.itemName });
    if (stock) {
      stock.availableQuantity += issuance.quantity;
      await stock.save();
    }

    issuance.status = 'RETURNED';
    issuance.returnDate = new Date();
    await issuance.save();

    await issuance.populate('employeeId', 'name');

    await logActivity({
      userId: req.user.id,
      entityType: 'PPE_ISSUANCE',
      entityId: issuance._id.toString(),
      action: 'PPE_RETURNED',
      details: { itemName: issuance.itemName, quantity: issuance.quantity, employee: issuance.employeeId?.name }
    });

    res.json({ success: true, data: issuance });
  } catch (err) {
    next(err);
  }
};

// ─── CDC & PASSPORT COLLECTION INTAKE ─────────────────────────────────────────

const listDocIntakes = async (req, res, next) => {
  try {
    const docs = await DocIntake.find()
      .sort({ createdAt: -1 })
      .populate('candidateId', 'name rank contactNumber email')
      .populate('employeeId', 'name position phone email');
    res.json({ success: true, data: docs });
  } catch (err) {
    next(err);
  }
};

const createDocIntake = async (req, res, next) => {
  try {
    const { candidateId, employeeId, seafarerName, documentType, documentNumber, custodyLocation, remarks } = req.body;
    if (!seafarerName || !documentType) {
      return res.status(400).json({ success: false, message: 'Seafarer name and document type are required.' });
    }

    const doc = await DocIntake.create({
      candidateId: candidateId || null,
      employeeId: employeeId || null,
      seafarerName,
      documentType,
      documentNumber: documentNumber || '',
      custodyLocation: custodyLocation || '',
      remarks: remarks || '',
      createdById: req.user.id
    });

    await logActivity({
      userId: req.user.id,
      entityType: 'DOCUMENT_INTAKE',
      entityId: doc._id.toString(),
      action: 'DOC_COLLECTED',
      details: { seafarerName: doc.seafarerName, documentType: doc.documentType, number: doc.documentNumber }
    });

    res.status(201).json({ success: true, data: doc });
  } catch (err) {
    next(err);
  }
};

const updateDocIntakeStatus = async (req, res, next) => {
  try {
    const { status, custodyLocation, remarks } = req.body;
    const allowed = ['WITH_AGENCY', 'RETURNED_TO_SEAFARER', 'SENT_TO_VESSEL_OWNER'];
    if (status && !allowed.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid document intake status.' });
    }

    const updates = {};
    if (status) updates.status = status;
    if (custodyLocation !== undefined) updates.custodyLocation = custodyLocation;
    if (remarks !== undefined) updates.remarks = remarks;

    const doc = await DocIntake.findByIdAndUpdate(req.params.id, updates, { new: true })
      .populate('candidateId', 'name')
      .populate('employeeId', 'name');

    if (!doc) {
      return res.status(404).json({ success: false, message: 'Document intake record not found.' });
    }

    await logActivity({
      userId: req.user.id,
      entityType: 'DOCUMENT_INTAKE',
      entityId: doc._id.toString(),
      action: 'DOC_STATUS_UPDATED',
      details: { status: doc.status, location: doc.custodyLocation }
    });

    res.json({ success: true, data: doc });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  listVisitors,
  createVisitor,
  checkOutVisitor,
  listCalls,
  createCall,
  updateCallStatus,
  listPpeStock,
  updatePpeStock,
  listPpeIssuances,
  issuePpe,
  returnPpe,
  listDocIntakes,
  createDocIntake,
  updateDocIntakeStatus
};
