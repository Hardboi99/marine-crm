require('dotenv').config();
const mongoose = require('mongoose');
const { PpeStandard, PpeStock, PpeStockHistory, PpeIssuance, User, Employee } = require('../models');
const {
  listPpeStock,
  listPpeStandards,
  updatePpeStock,
  getEmployeePpeSummary,
  getEmployeePpeHistory,
  issuePpeKit,
  issuePpe,
  returnPpe
} = require('../controllers/receptionController');

async function run() {
  console.log('\n========================================');
  console.log('  PPE FINAL PHASE — End-to-End Test');
  console.log('========================================\n');

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ Connected to DB\n');

  let passed = 0;
  let failed = 0;

  function ok(label) { console.log(`  ✅ ${label}`); passed++; }
  function fail(label, reason) { console.error(`  ❌ ${label}: ${reason}`); failed++; }

  function makeRes() {
    const r = { statusCode: 200, data: null };
    r.status = (c) => { r.statusCode = c; return r; };
    r.json = (d) => { r.data = d; return r; };
    return r;
  }

  let user = await User.findOne();
  const mockUser = { id: user._id.toString(), role: 'ADMIN' };

  // Pre-cleanup
  await Employee.deleteMany({ employeeId: { $regex: /^EMP-FINAL/ } });

  // ── STOCK SEEDING ────────────────────────────────────────────
  console.log('[A] Stock Seeding & Standards Load');
  let res = makeRes();
  await listPpeStock({ user: mockUser }, res, (e) => { throw e; });
  if (res.data.success && res.data.data.length > 0) ok('Stock seeded via listPpeStock');
  else fail('Stock seeded', 'No stock items returned');

  res = makeRes();
  await listPpeStandards({}, res, (e) => { throw e; });
  if (res.data.success && res.data.data.length > 0) ok('Standards loaded correctly');
  else fail('Standards loaded', 'No standards returned');

  // Verify client standard: Common items
  const stds = res.data.data;
  const hasSeaBag = stds.some(s => s.itemName === 'Sea Bag' && s.ownerType === 'Common');
  const hasSafetyShoes = stds.some(s => s.itemName === 'Safety Shoes' && s.ownerType === 'Common');
  if (hasSeaBag && hasSafetyShoes) ok('Common standards: Sea Bag + Safety Shoes present');
  else fail('Common standards', 'Missing Sea Bag or Safety Shoes in Common');

  // Turkey Owner — Blue Boiler Suit
  const turkeyBlue = stds.some(s => s.ownerType === 'Turkey Owner' && s.itemName === 'Boiler Suit' && s.colorSpec === 'Blue' && s.applicableRank === 'All Ranks');
  if (turkeyBlue) ok('Turkey Owner: Blue Boiler Suit (All Ranks)');
  else fail('Turkey Owner', 'Missing Blue Boiler Suit for All Ranks');

  // Cook additional items
  const cookItems = ['Full Cook Set', 'T-Shirt', 'Pant', 'Helmet', 'Plastic Shoes (Kitchen)'];
  const allCookPresent = cookItems.every(ci => stds.some(s => s.ownerType === 'Turkey Owner' && s.itemName === ci && s.applicableRank === 'Cook'));
  if (allCookPresent) ok(`Turkey Owner Cook items: ${cookItems.join(', ')}`);
  else fail('Turkey Owner Cook', 'Missing one or more Cook-specific items');

  // Messman items
  const messmanItems = ['T-Shirt', 'Pant'];
  const allMessmanPresent = messmanItems.every(mi => stds.some(s => s.ownerType === 'Turkey Owner' && s.itemName === mi && s.applicableRank === 'Messman'));
  if (allMessmanPresent) ok('Turkey Owner Messman items: T-Shirt, Pant');
  else fail('Turkey Owner Messman', 'Missing T-Shirt or Pant for Messman');

  // Other Owners
  const gpOrange = stds.some(s => s.ownerType === 'Other Owners' && s.itemName === 'Boiler Suit' && s.colorSpec === 'Orange' && s.applicableRank === 'GP Rating');
  const officerWhite = stds.some(s => s.ownerType === 'Other Owners' && s.itemName === 'Boiler Suit' && s.colorSpec === 'White' && s.applicableRank === 'Officers & Engineers');
  if (gpOrange) ok('Other Owners: Orange Boiler Suit for GP Rating');
  else fail('Other Owners GP', 'Missing Orange Boiler Suit for GP Rating');
  if (officerWhite) ok('Other Owners: White Boiler Suit for Officers & Engineers');
  else fail('Other Owners Officer', 'Missing White Boiler Suit for Officers & Engineers');

  // ── STOCK ADJUSTMENT ─────────────────────────────────────────
  console.log('\n[B] Stock Adjustment Safety');
  await PpeStock.updateMany({ itemName: 'Boiler Suit' }, { availableQuantity: 50, totalQuantity: 50 });
  await PpeStock.updateMany({ itemName: 'Sea Bag' }, { availableQuantity: 50, totalQuantity: 50 });

  // Test: reason mandatory
  res = makeRes();
  await updatePpeStock({ user: mockUser, body: { itemName: 'Boiler Suit', colorSpec: 'Blue', size: 'L', totalQuantity: 50, availableQuantity: 45, reason: 'INVALID_REASON' } }, res, (e) => { throw e; });
  if (res.statusCode === 400) ok('Stock adjustment: invalid reason rejected');
  else fail('Stock adjustment reason', 'Invalid reason was accepted');

  // Test: avail > total blocked
  res = makeRes();
  await updatePpeStock({ user: mockUser, body: { itemName: 'Boiler Suit', colorSpec: 'Blue', size: 'L', totalQuantity: 10, availableQuantity: 20, reason: 'Correction' } }, res, (e) => { throw e; });
  if (res.statusCode === 400) ok('Stock adjustment: available > total blocked');
  else fail('Stock adjustment avail>total', 'Was not blocked');

  // Test: negative stock blocked
  res = makeRes();
  await updatePpeStock({ user: mockUser, body: { itemName: 'Boiler Suit', colorSpec: 'Blue', size: 'L', totalQuantity: -5, availableQuantity: -2, reason: 'Correction' } }, res, (e) => { throw e; });
  if (res.statusCode === 400) ok('Stock adjustment: negative stock blocked');
  else fail('Stock adjustment negative', 'Was not blocked');

  // ── EMPLOYEE SETUP ────────────────────────────────────────────
  console.log('\n[C] Employee PPE Workflow');

  const cookEmp = await Employee.create({
    name: 'Final Test Cook',
    employeeId: 'EMP-FINAL-COOK-01',
    phone: '9998881111',
    position: 'Cook',
    rank: 'Cook',
    vessel: 'MT Final Star',
    ownerType: 'Turkey Owner',
    boilerSuitSize: 'L',
    shoeSize: '9',
    status: 'ACTIVE',
    createdById: user._id,
    createdByName: user.name
  });

  // Exited employee guard
  const exitedEmp = await Employee.create({
    name: 'Exited Sailor',
    employeeId: 'EMP-FINAL-EXIT-01',
    phone: '9998882222',
    position: 'GP Rating',
    rank: 'GP Rating',
    status: 'EXITED',
    createdById: user._id,
    createdByName: user.name
  });

  res = makeRes();
  await issuePpeKit({ user: mockUser, body: { employeeId: exitedEmp._id.toString(), items: [{ itemName: 'Sea Bag', colorSpec: 'Standard', size: 'Standard', quantity: 1 }] } }, res, (e) => { throw e; });
  if (res.statusCode === 400 && res.data.message.includes('no longer an active employee')) ok('Exited employee blocked from receiving PPE');
  else fail('Exited employee guard', res.data?.message);

  // Correct standard auto-detection
  res = makeRes();
  await getEmployeePpeSummary({ params: { employeeId: cookEmp._id.toString() } }, res, (e) => { throw e; });
  if (res.data.success) {
    const summary = res.data.data;
    const cookNames = summary.summary.map(s => s.itemName);
    const hasCookSet = cookNames.includes('Full Cook Set');
    const hasBoilerBlue = summary.summary.some(s => s.itemName === 'Boiler Suit' && s.colorSpec === 'Blue');
    if (hasCookSet && hasBoilerBlue) ok('Cook: correct automatic standard (Blue Boiler Suit + Full Cook Set)');
    else fail('Cook auto standard', `Missing items. Got: ${cookNames.join(', ')}`);
  }

  // ── ISSUE & STOCK VERIFICATION ───────────────────────────────
  console.log('\n[D] Issue, Stock Deduction & History');
  const boilerBefore = await PpeStock.findOne({ itemName: 'Boiler Suit', colorSpec: 'Blue' });

  res = makeRes();
  await issuePpeKit({ user: mockUser, body: { employeeId: cookEmp._id.toString(), items: [{ itemName: 'Boiler Suit', colorSpec: 'Blue', size: 'L', quantity: 3 }] } }, res, (e) => { throw e; });
  if (res.statusCode === 201) ok('Issued 3 Boiler Suits successfully');
  else fail('Issue Boiler Suits', res.data?.message);
  const issuanceId = res.data.data[0]._id.toString();

  const boilerAfter = await PpeStock.findOne({ itemName: 'Boiler Suit', colorSpec: 'Blue' });
  if (boilerAfter.availableQuantity === boilerBefore.availableQuantity - 3) ok('Stock decreased by exactly 3 after issuance');
  else fail('Stock deduction', `Expected ${boilerBefore.availableQuantity - 3}, got ${boilerAfter.availableQuantity}`);

  const histEntry = await PpeStockHistory.findOne({ itemName: 'Boiler Suit', quantityChanged: -3, reason: 'Issuance' });
  if (histEntry) ok('Stock history entry created for issuance');
  else fail('Stock history', 'No history entry found for issuance');

  // ── DUPLICATE PREVENTION ──────────────────────────────────────
  console.log('\n[E] Duplicate Prevention & Out-of-Stock Guard');
  // Force stock to 0 for a specific item
  await PpeStock.updateOne({ itemName: 'Plastic Shoes (Kitchen)' }, { availableQuantity: 0 });
  res = makeRes();
  await issuePpeKit({ user: mockUser, body: { employeeId: cookEmp._id.toString(), items: [{ itemName: 'Plastic Shoes (Kitchen)', colorSpec: 'Standard', size: 'Size 9', quantity: 1 }] } }, res, (e) => { throw e; });
  if (res.statusCode === 400) ok('Out-of-stock item blocked with friendly message');
  else fail('Out-of-stock guard', 'Was not blocked');

  // ── PARTIAL RETURN (GOOD) ─────────────────────────────────────
  console.log('\n[F] Returns — Partial, Good, Damaged, Lost');
  const boilerAfterIssue = await PpeStock.findOne({ itemName: 'Boiler Suit', colorSpec: 'Blue' });

  res = makeRes();
  await returnPpe({ user: mockUser, params: { id: issuanceId }, body: { returnQty: 2, condition: 'Good', remarks: 'Good state' } }, res, (e) => { throw e; });
  if (res.data?.success && res.data.data.status === 'PARTIALLY_RETURNED') ok('Partial return: status = PARTIALLY_RETURNED');
  else fail('Partial return status', res.data?.message);

  const boilerAfterPartial = await PpeStock.findOne({ itemName: 'Boiler Suit', colorSpec: 'Blue' });
  if (boilerAfterPartial.availableQuantity === boilerAfterIssue.availableQuantity + 2) ok('Partial Good return: stock +2 correctly');
  else fail('Stock after partial return', `Expected ${boilerAfterIssue.availableQuantity + 2}, got ${boilerAfterPartial.availableQuantity}`);

  // Return validation — over-return guard
  res = makeRes();
  await returnPpe({ user: mockUser, params: { id: issuanceId }, body: { returnQty: 5, condition: 'Good' } }, res, (e) => { throw e; });
  if (res.statusCode === 400) ok('Over-return (returnQty > remaining) blocked');
  else fail('Over-return guard', 'Was not blocked');

  // Damaged return
  const boilerBeforeDamaged = await PpeStock.findOne({ itemName: 'Boiler Suit', colorSpec: 'Blue' });
  res = makeRes();
  await returnPpe({ user: mockUser, params: { id: issuanceId }, body: { returnQty: 1, condition: 'Damaged', remarks: 'Torn' } }, res, (e) => { throw e; });
  if (res.data?.success && res.data.data.status === 'RETURNED') ok('Damaged return: status = RETURNED');
  else fail('Damaged return status', res.data?.message);

  const boilerAfterDamaged = await PpeStock.findOne({ itemName: 'Boiler Suit', colorSpec: 'Blue' });
  if (boilerAfterDamaged.availableQuantity === boilerBeforeDamaged.availableQuantity) ok('Damaged return: stock NOT incremented');
  else fail('Damaged return stock', 'Stock was incorrectly incremented');

  // Fully returned guard
  res = makeRes();
  await returnPpe({ user: mockUser, params: { id: issuanceId }, body: { returnQty: 1, condition: 'Good' } }, res, (e) => { throw e; });
  if (res.statusCode === 400) ok('Already-fully-returned issuance correctly blocked');
  else fail('Fully-returned guard', 'Was not blocked');

  // ── EMPLOYEE PPE HISTORY ──────────────────────────────────────
  console.log('\n[G] Employee PPE History');
  res = makeRes();
  await getEmployeePpeHistory({ params: { employeeId: cookEmp._id.toString() } }, res, (e) => { throw e; });
  if (res.data.success && res.data.data.overallStatusBadge) ok(`Employee history API: badge = "${res.data.data.overallStatusBadge}", returned = ${res.data.data.returnedHistory.length}`);
  else fail('Employee history', 'Missing history or badge');

  // Cleanup
  await Employee.deleteMany({ employeeId: { $regex: /^EMP-FINAL/ } });

  // ── FINAL SUMMARY ─────────────────────────────────────────────
  console.log('\n========================================');
  console.log(`  FINAL RESULT: ${passed} passed, ${failed} failed`);
  console.log('========================================\n');
  if (failed > 0) process.exit(1);
}

run().catch(e => { console.error(e); process.exit(1); }).finally(() => mongoose.disconnect());
