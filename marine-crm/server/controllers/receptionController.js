const { Visitor, ReceptionCall, PpeStock, PpeIssuance, PpeStandard, PpeStockHistory, DocIntake, Employee } = require('../models');
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

// ─── PPE STANDARDS, STOCK & ISSUANCES ────────────────────────────────────────

const DEFAULT_PPE_STANDARDS = [
  // Common
  { ownerType: 'Common', category: 'Common Items', itemName: 'Sea Bag', applicableRank: 'All Ranks', colorSpec: 'Standard', remarks: 'Issued regardless of owner' },
  { ownerType: 'Common', category: 'Common Items', itemName: 'Safety Shoes', applicableRank: 'All Ranks', colorSpec: 'Standard', remarks: 'Standard issue across all owners' },

  // Turkey Owner
  { ownerType: 'Turkey Owner', category: 'Boiler Suit & Bedding Kit (All Ranks)', itemName: 'Boiler Suit', applicableRank: 'All Ranks', colorSpec: 'Blue' },
  { ownerType: 'Turkey Owner', category: 'Boiler Suit & Bedding Kit (All Ranks)', itemName: 'Duvet Cover', applicableRank: 'All Ranks', colorSpec: 'Standard' },
  { ownerType: 'Turkey Owner', category: 'Boiler Suit & Bedding Kit (All Ranks)', itemName: 'Bed Sheet', applicableRank: 'All Ranks', colorSpec: 'Standard' },
  { ownerType: 'Turkey Owner', category: 'Boiler Suit & Bedding Kit (All Ranks)', itemName: 'Pillow Cover', applicableRank: 'All Ranks', colorSpec: 'Standard' },
  { ownerType: 'Turkey Owner', category: 'Boiler Suit & Bedding Kit (All Ranks)', itemName: 'Small Towel', applicableRank: 'All Ranks', colorSpec: 'Standard' },
  { ownerType: 'Turkey Owner', category: 'Boiler Suit & Bedding Kit (All Ranks)', itemName: 'Big Towel', applicableRank: 'All Ranks', colorSpec: 'Standard' },
  { ownerType: 'Turkey Owner', category: 'Cook — Additional Items', itemName: 'Full Cook Set', applicableRank: 'Cook', colorSpec: 'Standard', remarks: 'Complete chef uniform set' },
  { ownerType: 'Turkey Owner', category: 'Cook — Additional Items', itemName: 'T-Shirt', applicableRank: 'Cook', colorSpec: 'Standard', remarks: 'Additional casual wear' },
  { ownerType: 'Turkey Owner', category: 'Cook — Additional Items', itemName: 'Pant', applicableRank: 'Cook', colorSpec: 'Standard', remarks: 'Additional casual wear' },
  { ownerType: 'Turkey Owner', category: 'Cook — Additional Items', itemName: 'Helmet', applicableRank: 'Cook', colorSpec: 'Standard', remarks: 'Safety requirement' },
  { ownerType: 'Turkey Owner', category: 'Cook — Additional Items', itemName: 'Plastic Shoes (Kitchen)', applicableRank: 'Cook', colorSpec: 'Standard', remarks: 'Galley-specific, Turkey owner standard' },
  { ownerType: 'Turkey Owner', category: 'Messman — Additional Items', itemName: 'T-Shirt', applicableRank: 'Messman', colorSpec: 'Standard', remarks: 'Standard issue' },
  { ownerType: 'Turkey Owner', category: 'Messman — Additional Items', itemName: 'Pant', applicableRank: 'Messman', colorSpec: 'Standard', remarks: 'Standard issue' },

  // Other Owners
  { ownerType: 'Other Owners', category: 'Boiler Suit — Rank-Based Color Coding', itemName: 'Boiler Suit', applicableRank: 'GP Rating', colorSpec: 'Orange' },
  { ownerType: 'Other Owners', category: 'Boiler Suit — Rank-Based Color Coding', itemName: 'Boiler Suit', applicableRank: 'Officers & Engineers', colorSpec: 'White' },
  { ownerType: 'Other Owners', category: 'Boiler Suit — Rank-Based Color Coding', itemName: 'Safety Shoes', applicableRank: 'All Ranks', colorSpec: 'Standard' },
  { ownerType: 'Other Owners', category: 'Boiler Suit — Rank-Based Color Coding', itemName: 'Sea Bag', applicableRank: 'All Ranks', colorSpec: 'Standard' }
];

const DEFAULT_PPE_STOCK = [
  { itemName: 'Sea Bag', category: 'Common Items', colorSpec: 'Standard', applicableTo: 'All Ranks', size: 'Standard', totalQuantity: 50, availableQuantity: 50, reorderLevel: 5 },
  { itemName: 'Safety Shoes', category: 'Common Items', colorSpec: 'Standard', applicableTo: 'All Ranks', size: 'Size 9', totalQuantity: 30, availableQuantity: 30, reorderLevel: 5 },
  { itemName: 'Boiler Suit', category: 'Clothing', colorSpec: 'Blue', applicableTo: 'All Ranks', size: 'L', totalQuantity: 50, availableQuantity: 50, reorderLevel: 5 },
  { itemName: 'Boiler Suit', category: 'Clothing', colorSpec: 'Orange', applicableTo: 'GP Rating', size: 'L', totalQuantity: 50, availableQuantity: 50, reorderLevel: 5 },
  { itemName: 'Boiler Suit', category: 'Clothing', colorSpec: 'White', applicableTo: 'Officers & Engineers', size: 'L', totalQuantity: 50, availableQuantity: 50, reorderLevel: 5 },
  { itemName: 'Duvet Cover', category: 'Bedding', colorSpec: 'Standard', applicableTo: 'All Ranks', size: 'Standard', totalQuantity: 50, availableQuantity: 50, reorderLevel: 5 },
  { itemName: 'Bed Sheet', category: 'Bedding', colorSpec: 'Standard', applicableTo: 'All Ranks', size: 'Standard', totalQuantity: 50, availableQuantity: 50, reorderLevel: 5 },
  { itemName: 'Pillow Cover', category: 'Bedding', colorSpec: 'Standard', applicableTo: 'All Ranks', size: 'Standard', totalQuantity: 50, availableQuantity: 50, reorderLevel: 5 },
  { itemName: 'Small Towel', category: 'Bedding', colorSpec: 'Standard', applicableTo: 'All Ranks', size: 'Standard', totalQuantity: 50, availableQuantity: 50, reorderLevel: 5 },
  { itemName: 'Big Towel', category: 'Bedding', colorSpec: 'Standard', applicableTo: 'All Ranks', size: 'Standard', totalQuantity: 50, availableQuantity: 50, reorderLevel: 5 },
  { itemName: 'Full Cook Set', category: 'Galley', colorSpec: 'Standard', applicableTo: 'Cook', size: 'Standard', totalQuantity: 20, availableQuantity: 20, reorderLevel: 5 },
  { itemName: 'T-Shirt', category: 'Clothing', colorSpec: 'Standard', applicableTo: 'Cook/Messman', size: 'L', totalQuantity: 30, availableQuantity: 30, reorderLevel: 5 },
  { itemName: 'Pant', category: 'Clothing', colorSpec: 'Standard', applicableTo: 'Cook/Messman', size: '32', totalQuantity: 30, availableQuantity: 30, reorderLevel: 5 },
  { itemName: 'Helmet', category: 'Safety', colorSpec: 'Standard', applicableTo: 'Cook', size: 'Standard', totalQuantity: 50, availableQuantity: 50, reorderLevel: 5 },
  { itemName: 'Plastic Shoes (Kitchen)', category: 'Footwear', colorSpec: 'Standard', applicableTo: 'Cook', size: 'Size 9', totalQuantity: 20, availableQuantity: 20, reorderLevel: 5 }
];

const listPpeStandards = async (req, res, next) => {
  try {
    let standards = await PpeStandard.find({ active: true }).sort({ ownerType: 1, category: 1 });
    if (standards.length === 0) {
      // Use upsert-style insert to avoid duplicate key errors on re-run
      for (const def of DEFAULT_PPE_STANDARDS) {
        await PpeStandard.updateOne(
          { ownerType: def.ownerType, itemName: def.itemName, applicableRank: def.applicableRank, colorSpec: def.colorSpec },
          { $setOnInsert: def },
          { upsert: true }
        );
      }
      standards = await PpeStandard.find({ active: true }).sort({ ownerType: 1, category: 1 });
    }
    res.json({ success: true, data: standards });
  } catch (err) {
    next(err);
  }
};

const listPpeStock = async (req, res, next) => {
  try {
    // Migrate legacy unique index on itemName if present
    try {
      const collection = PpeStock.collection;
      const indexes = await collection.indexes();
      const legacyIdx = indexes.find(idx => idx.name === 'itemName_1' || (idx.key && idx.key.itemName === 1 && Object.keys(idx.key).length === 1 && idx.unique));
      if (legacyIdx) {
        await collection.dropIndex(legacyIdx.name);
      }
    } catch (idxErr) {
      // index might not exist or already dropped
    }

    // Ensure all default items exist in inventory without overwriting existing stock levels
    for (const def of DEFAULT_PPE_STOCK) {
      await PpeStock.updateOne(
        { itemName: def.itemName, colorSpec: def.colorSpec, size: def.size },
        { $setOnInsert: def },
        { upsert: true }
      );
    }

    const stock = await PpeStock.find().sort({ itemName: 1, colorSpec: 1, size: 1 });
    res.json({ success: true, data: stock });
  } catch (err) {
    next(err);
  }
};

const updatePpeStock = async (req, res, next) => {
  try {
    const { id, itemName, category, colorSpec, applicableTo, size, totalQuantity, availableQuantity, adjustmentQty, reason, reorderLevel } = req.body;
    if (!itemName) {
      return res.status(400).json({ success: false, message: 'Item name is required.' });
    }

    const total = totalQuantity !== undefined ? parseInt(totalQuantity) : 0;
    const avail = availableQuantity !== undefined ? parseInt(availableQuantity) : 0;
    const reorder = reorderLevel !== undefined ? parseInt(reorderLevel) : 5;

    if (isNaN(total) || isNaN(avail) || total < 0 || avail < 0) {
      return res.status(400).json({ success: false, message: 'Stock quantities cannot be negative.' });
    }
    if (avail > total) {
      return res.status(400).json({ success: false, message: 'Available quantity cannot exceed total stock quantity.' });
    }
    if (isNaN(reorder) || reorder < 0) {
      return res.status(400).json({ success: false, message: 'Reorder level must be a non-negative number.' });
    }

    const validReasons = ['New Stock', 'Correction', 'Damaged', 'Lost', 'Other'];
    if (!reason || !validReasons.includes(reason)) {
      return res.status(400).json({ success: false, message: `Adjustment reason is required. Valid reasons: ${validReasons.join(', ')}.` });
    }

    const itemColor = colorSpec || 'Standard';
    const itemSize = size || 'Standard';

    let existingStock;
    if (id) {
      existingStock = await PpeStock.findById(id);
    } else {
      existingStock = await PpeStock.findOne({ itemName: itemName.trim(), colorSpec: itemColor, size: itemSize });
    }

    const beforeAvail = existingStock ? existingStock.availableQuantity : 0;
    const qtyChange = adjustmentQty !== undefined ? parseInt(adjustmentQty) : (avail - beforeAvail);

    let stock;
    if (existingStock) {
      existingStock.totalQuantity = total;
      existingStock.availableQuantity = avail;
      if (category) existingStock.category = category;
      if (applicableTo) existingStock.applicableTo = applicableTo;
      if (reorderLevel !== undefined) existingStock.reorderLevel = reorder;
      stock = await existingStock.save();
    } else {
      stock = await PpeStock.create({
        itemName: itemName.trim(),
        category: category || 'General',
        colorSpec: itemColor,
        applicableTo: applicableTo || 'All Ranks',
        size: itemSize,
        totalQuantity: total,
        availableQuantity: avail,
        reorderLevel: reorder
      });
    }

    // Record movement history
    await PpeStockHistory.create({
      stockId: stock._id,
      itemName: stock.itemName,
      colorSpec: stock.colorSpec,
      size: stock.size,
      quantityChanged: qtyChange,
      beforeQuantity: beforeAvail,
      afterQuantity: stock.availableQuantity,
      reason,
      createdById: req.user.id
    });

    await logActivity({
      userId: req.user.id,
      entityType: 'PPE_STOCK',
      entityId: stock._id.toString(),
      action: 'STOCK_ADJUSTED',
      details: { itemName: stock.itemName, size: stock.size, before: beforeAvail, after: stock.availableQuantity, reason }
    });

    res.json({ success: true, data: stock });
  } catch (err) {
    next(err);
  }
};

const listPpeStockHistory = async (req, res, next) => {
  try {
    const history = await PpeStockHistory.find()
      .sort({ createdAt: -1 })
      .populate('createdById', 'name email')
      .limit(100);
    res.json({ success: true, data: history });
  } catch (err) {
    next(err);
  }
};

const listPpeIssuances = async (req, res, next) => {
  try {
    const issuances = await PpeIssuance.find()
      .sort({ createdAt: -1 })
      .populate('employeeId', 'name position rank vessel ownerType employeeId');
    res.json({ success: true, data: issuances });
  } catch (err) {
    next(err);
  }
};

const getEmployeePpeSummary = async (req, res, next) => {
  try {
    const { employeeId } = req.params;
    const employee = await Employee.findById(employeeId);
    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found.' });
    }

    const rank = employee.rank || employee.position || 'General';
    const vessel = employee.vessel || 'Vessel A';
    const rankLower = rank.toLowerCase();

    let ownerType = employee.ownerType;
    if (!ownerType) {
      if (rankLower.includes('cook') || rankLower.includes('messman')) {
        ownerType = 'Turkey Owner';
      } else {
        ownerType = 'Turkey Owner';
      }
    }

    const boilerSuitSize = employee.boilerSuitSize || 'L';
    const shoeSize = employee.shoeSize || '9';

    // Fetch standards matching ownerType + Common
    let standards = await PpeStandard.find({
      active: true,
      $or: [{ ownerType: ownerType }, { ownerType: 'Common' }]
    }).sort({ category: 1 });

    if (standards.length === 0) {
      standards = await PpeStandard.find({ active: true });
    }

    // Filter standards based on rank applicability
    const applicableStandards = standards.filter(std => {
      const stdRank = std.applicableRank;
      if (stdRank === 'All Ranks') return true;
      if (stdRank === 'Cook' && rankLower.includes('cook')) return true;
      if (stdRank === 'Messman' && rankLower.includes('messman')) return true;
      if (stdRank === 'GP Rating' && (rankLower.includes('gp') || rankLower.includes('rating') || rankLower.includes('seaman'))) return true;
      if (stdRank === 'Officers & Engineers' && (rankLower.includes('officer') || rankLower.includes('engineer') || rankLower.includes('captain') || rankLower.includes('mate'))) return true;
      return false;
    });

    // Get active issuances for this employee
    const activeIssuances = await PpeIssuance.find({ employeeId, status: 'ISSUED' });
    const issuedMap = {};
    activeIssuances.forEach(iss => {
      issuedMap[iss.itemName] = (issuedMap[iss.itemName] || 0) + (iss.quantity || 1);
    });

    const allStocks = await PpeStock.find();

    const defaultRequired = {
      'Boiler Suit': 2,
      'Safety Shoes': 1,
      'Sea Bag': 1,
      'Duvet Cover': 1,
      'Bed Sheet': 1,
      'Pillow Cover': 1,
      'Small Towel': 1,
      'Big Towel': 1,
      'Full Cook Set': 1,
      'T-Shirt': 2,
      'Pant': 2,
      'Helmet': 1,
      'Plastic Shoes (Kitchen)': 1
    };

    let totalRequired = 0;
    let totalIssued = 0;
    let totalRemaining = 0;

    const summaryItems = applicableStandards.map(std => {
      const requiredQty = defaultRequired[std.itemName] || 1;
      const alreadyIssuedQty = issuedMap[std.itemName] || 0;
      const remainingQty = Math.max(0, requiredQty - alreadyIssuedQty);

      totalRequired += requiredQty;
      totalIssued += alreadyIssuedQty;
      totalRemaining += remainingQty;

      const matchingVariants = allStocks.filter(s =>
        s.itemName === std.itemName &&
        (s.colorSpec || 'Standard') === (std.colorSpec || 'Standard')
      );

      const availableVariants = matchingVariants.map(v => ({
        id: v._id.toString(),
        size: v.size || 'Standard',
        availableQuantity: v.availableQuantity,
        totalQuantity: v.totalQuantity
      }));

      const totalAvailStock = availableVariants.reduce((sum, v) => sum + v.availableQuantity, 0);

      const defaultSize = (std.itemName.includes('Shoes'))
        ? shoeSize
        : (std.itemName.includes('Suit') || std.itemName.includes('Shirt') || std.itemName.includes('Pant') ? boilerSuitSize : 'Standard');

      return {
        itemName: std.itemName,
        category: std.category,
        colorSpec: std.colorSpec || 'Standard',
        applicableRank: std.applicableRank,
        remarks: std.remarks || '',
        requiredQty,
        issuedQty: alreadyIssuedQty,
        remainingQty,
        defaultSize,
        totalAvailableStock: totalAvailStock,
        availableVariants
      };
    });

    const overallStatus = totalRemaining === 0 ? 'Complete' : 'Partial';

    res.json({
      success: true,
      data: {
        employee: {
          id: employee._id.toString(),
          name: employee.name,
          rank,
          vessel,
          ownerType,
          boilerSuitSize,
          shoeSize
        },
        overallStatus,
        totalRequired,
        totalIssued,
        totalRemaining,
        summary: summaryItems
      }
    });
  } catch (err) {
    next(err);
  }
};

const issuePpeKit = async (req, res, next) => {
  try {
    const { employeeId, items } = req.body;
    if (!employeeId || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Employee and PPE items are required.' });
    }

    const employee = await Employee.findById(employeeId);
    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found.' });
    }
    if (employee.status === 'EXITED') {
      return res.status(400).json({ success: false, message: `${employee.name} is no longer an active employee and cannot receive PPE.` });
    }

    // --- Pre-validate all items before touching any stock (fail-fast) ---
    const validatedItems = [];
    for (const item of items) {
      const { itemName, colorSpec, size, quantity } = item;
      const qty = parseInt(quantity);
      if (!itemName || isNaN(qty) || qty <= 0) {
        return res.status(400).json({ success: false, message: `Invalid quantity for item: ${itemName || 'unknown'}.` });
      }

      const itemColor = colorSpec || 'Standard';
      const itemSize = size || 'Standard';

      // Check exact variant first, then any variant with enough stock
      let stock = await PpeStock.findOne({ itemName: itemName.trim(), colorSpec: itemColor, size: itemSize });
      if (!stock) {
        stock = await PpeStock.findOne({ itemName: itemName.trim(), colorSpec: itemColor });
      }
      if (!stock) {
        stock = await PpeStock.findOne({ itemName: itemName.trim() });
      }

      if (!stock) {
        return res.status(400).json({ success: false, message: `${itemName} is not set up in inventory. Please contact the store manager.` });
      }
      if (stock.availableQuantity < qty) {
        return res.status(400).json({
          success: false,
          message: `Only ${stock.availableQuantity} ${stock.itemName}${stock.size !== 'Standard' ? ' (size ' + stock.size + ')' : ''} available in stock — cannot issue ${qty}.`
        });
      }

      validatedItems.push({ stock, qty });
    }

    // --- Atomically deduct stock and create issuances ---
    const createdIssuances = [];
    for (const { stock, qty } of validatedItems) {
      const beforeAvail = stock.availableQuantity;

      // Atomic conditional decrement — prevents race condition over-issue
      const updatedStock = await PpeStock.findOneAndUpdate(
        { _id: stock._id, availableQuantity: { $gte: qty } },
        { $inc: { availableQuantity: -qty } },
        { new: true }
      );

      if (!updatedStock) {
        return res.status(409).json({
          success: false,
          message: `Stock for ${stock.itemName} was just updated by another user. Only ${stock.availableQuantity} available. Please refresh and try again.`
        });
      }

      const issuance = await PpeIssuance.create({
        employeeId: employee._id,
        itemName: stock.itemName,
        quantity: qty,
        createdById: req.user.id
      });

      await PpeStockHistory.create({
        stockId: stock._id,
        itemName: stock.itemName,
        colorSpec: stock.colorSpec || 'Standard',
        size: stock.size || 'Standard',
        quantityChanged: -qty,
        beforeQuantity: beforeAvail,
        afterQuantity: updatedStock.availableQuantity,
        reason: 'Issuance',
        createdById: req.user.id
      });

      await logActivity({
        userId: req.user.id,
        entityType: 'PPE_ISSUANCE',
        entityId: issuance._id.toString(),
        action: 'PPE_ISSUED',
        details: { itemName: stock.itemName, quantity: qty, employee: employee.name }
      });

      createdIssuances.push(issuance);
    }

    res.status(201).json({
      success: true,
      message: `Successfully issued ${createdIssuances.length} PPE item(s) to ${employee.name}.`,
      data: createdIssuances
    });
  } catch (err) {
    next(err);
  }
};

const issuePpe = async (req, res, next) => {
  try {
    const { employeeId, itemName, colorSpec, size, quantity } = req.body;
    if (!employeeId || !itemName || !quantity) {
      return res.status(400).json({ success: false, message: 'Employee, item name, and quantity are required.' });
    }

    const qty = parseInt(quantity);
    if (isNaN(qty) || qty <= 0) {
      return res.status(400).json({ success: false, message: 'Quantity must be greater than zero.' });
    }

    const employee = await Employee.findById(employeeId);
    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found.' });
    }
    if (employee.status === 'EXITED') {
      return res.status(400).json({ success: false, message: `${employee.name} is no longer an active employee.` });
    }

    const filter = { itemName: itemName.trim() };
    if (colorSpec) filter.colorSpec = colorSpec;
    if (size) filter.size = size;

    let stock = await PpeStock.findOne(filter);
    if (!stock) {
      stock = await PpeStock.findOne({ itemName: itemName.trim() });
    }

    if (!stock) {
      return res.status(400).json({ success: false, message: `${itemName} is not found in inventory.` });
    }
    if (stock.availableQuantity < qty) {
      return res.status(400).json({
        success: false,
        message: `Only ${stock.availableQuantity} ${stock.itemName}${stock.size !== 'Standard' ? ' (size ' + stock.size + ')' : ''} currently available in stock.`
      });
    }

    const beforeAvail = stock.availableQuantity;
    // Atomic conditional update prevents race condition
    const updatedStock = await PpeStock.findOneAndUpdate(
      { _id: stock._id, availableQuantity: { $gte: qty } },
      { $inc: { availableQuantity: -qty } },
      { new: true }
    );

    if (!updatedStock) {
      return res.status(409).json({ success: false, message: `Stock for ${itemName} was just updated by another user. Please refresh and try again.` });
    }

    const issuance = await PpeIssuance.create({
      employeeId,
      itemName: stock.itemName,
      quantity: qty,
      createdById: req.user.id
    });

    await PpeStockHistory.create({
      stockId: stock._id,
      itemName: stock.itemName,
      colorSpec: stock.colorSpec || 'Standard',
      size: stock.size || 'Standard',
      quantityChanged: -qty,
      beforeQuantity: beforeAvail,
      afterQuantity: updatedStock.availableQuantity,
      reason: 'Issuance',
      createdById: req.user.id
    });

    await issuance.populate('employeeId', 'name position');

    await logActivity({
      userId: req.user.id,
      entityType: 'PPE_ISSUANCE',
      entityId: issuance._id.toString(),
      action: 'PPE_ISSUED',
      details: { itemName: stock.itemName, quantity: qty, employee: issuance.employeeId?.name }
    });

    res.status(201).json({ success: true, data: issuance });
  } catch (err) {
    next(err);
  }
};

const returnPpe = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { returnQty, condition, remarks } = req.body;

    const issuance = await PpeIssuance.findById(id).populate('employeeId', 'name');
    if (!issuance) {
      return res.status(404).json({ success: false, message: 'Issuance record not found.' });
    }

    if (issuance.status === 'RETURNED') {
      return res.status(400).json({ success: false, message: 'This PPE item has already been fully returned.' });
    }

    const currentReturned = issuance.returnedQuantity || 0;
    const remainingReturnable = Math.max(0, issuance.quantity - currentReturned);

    const qtyToReturn = returnQty !== undefined ? parseInt(returnQty) : remainingReturnable;

    if (isNaN(qtyToReturn) || qtyToReturn <= 0) {
      return res.status(400).json({ success: false, message: 'Return quantity must be greater than zero.' });
    }

    if (qtyToReturn > remainingReturnable) {
      return res.status(400).json({
        success: false,
        message: `Return quantity (${qtyToReturn}) cannot exceed remaining returnable quantity (${remainingReturnable}).`
      });
    }

    const returnCond = condition && ['Good', 'Damaged', 'Lost'].includes(condition) ? condition : 'Good';
    const newReturnedQuantity = currentReturned + qtyToReturn;
    const isFullyReturned = newReturnedQuantity >= issuance.quantity;
    const newStatus = isFullyReturned ? 'RETURNED' : 'PARTIALLY_RETURNED';

    // Stock & History Update
    const stock = await PpeStock.findOne({ itemName: issuance.itemName });
    let beforeAvail = 0;
    let afterAvail = 0;

    if (stock) {
      beforeAvail = stock.availableQuantity;
      if (returnCond === 'Good') {
        const updatedStock = await PpeStock.findByIdAndUpdate(
          stock._id,
          { $inc: { availableQuantity: qtyToReturn } },
          { new: true }
        );
        afterAvail = updatedStock.availableQuantity;
      } else {
        afterAvail = beforeAvail; // Not restocked if Damaged or Lost
      }

      await PpeStockHistory.create({
        stockId: stock._id,
        itemName: stock.itemName,
        colorSpec: stock.colorSpec || 'Standard',
        size: stock.size || 'Standard',
        quantityChanged: returnCond === 'Good' ? qtyToReturn : 0,
        beforeQuantity: beforeAvail,
        afterQuantity: afterAvail,
        reason: returnCond === 'Good' ? 'Return' : returnCond,
        createdById: req.user.id
      });
    }

    issuance.returnedQuantity = newReturnedQuantity;
    issuance.status = newStatus;
    issuance.returnCondition = returnCond;
    if (remarks) issuance.returnRemarks = remarks;
    issuance.returnDate = new Date();
    await issuance.save();

    await logActivity({
      userId: req.user.id,
      entityType: 'PPE_ISSUANCE',
      entityId: issuance._id.toString(),
      action: 'PPE_RETURNED',
      details: { itemName: issuance.itemName, quantity: qtyToReturn, condition: returnCond, employee: issuance.employeeId?.name }
    });

    let message = 'PPE returned successfully.';
    if (returnCond === 'Damaged') {
      message = `${issuance.itemName} returned as damaged and was not added to available stock.`;
    } else if (returnCond === 'Lost') {
      message = `${issuance.itemName} marked as lost and was not added to available stock.`;
    } else if (!isFullyReturned) {
      const remaining = issuance.quantity - newReturnedQuantity;
      message = `${qtyToReturn} item(s) returned. ${remaining} item(s) still outstanding.`;
    }

    res.json({ success: true, message, data: issuance });
  } catch (err) {
    next(err);
  }
};

const getEmployeePpeHistory = async (req, res, next) => {
  try {
    const { employeeId } = req.params;
    const employee = await Employee.findById(employeeId);
    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found.' });
    }

    const allIssuances = await PpeIssuance.find({ employeeId }).sort({ issueDate: -1 });

    const currentIssued = allIssuances.filter(i => i.status === 'ISSUED' || i.status === 'PARTIALLY_RETURNED');
    const returnedHistory = allIssuances.filter(i => (i.returnedQuantity || 0) > 0 || i.status === 'RETURNED');

    // Determine status badge
    let overallStatusBadge = 'PPE Complete';
    if (allIssuances.length === 0) {
      overallStatusBadge = 'PPE Not Issued';
    } else if (currentIssued.length > 0) {
      const isPartial = currentIssued.some(i => i.status === 'PARTIALLY_RETURNED');
      overallStatusBadge = isPartial ? 'PPE Partially Issued' : 'Pending Return';
    }

    res.json({
      success: true,
      data: {
        employee: {
          id: employee._id.toString(),
          name: employee.name,
          rank: employee.rank || employee.position || 'General',
          vessel: employee.vessel || 'Vessel A'
        },
        overallStatusBadge,
        currentIssued,
        returnedHistory
      }
    });
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
  listPpeStandards,
  listPpeStock,
  updatePpeStock,
  listPpeStockHistory,
  getEmployeePpeSummary,
  getEmployeePpeHistory,
  listPpeIssuances,
  issuePpe,
  issuePpeKit,
  returnPpe,
  listDocIntakes,
  createDocIntake,
  updateDocIntakeStatus
};
