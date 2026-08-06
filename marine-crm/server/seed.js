/**
 * Comprehensive Database Seed — BDM Sales Pipeline (MongoDB / Mongoose)
 * Populates realistic data for Vessel Owner acquisition workflow
 */

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const connectDB = require('./config/db');
const {
  User,
  Country,
  Reason,
  Company,
  Call,
  Appointment,
  Contract,
  FollowUp,
  Activity,
  Notification,
} = require('./models');

async function main() {
  console.log('🌱 Starting comprehensive BDM Sales Pipeline seeding...');

  await connectDB();

  // Clear existing collections for a clean, rich seed
  await Promise.all([
    User.deleteMany({}),
    Country.deleteMany({}),
    Reason.deleteMany({}),
    Company.deleteMany({}),
    Call.deleteMany({}),
    Appointment.deleteMany({}),
    Contract.deleteMany({}),
    FollowUp.deleteMany({}),
    Activity.deleteMany({}),
    Notification.deleteMany({}),
  ]);
  console.log('🧹 Cleaned existing database collections');

  // ─── 1. USERS ──────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash('admin123', 12);

  const users = await User.create([
    {
      name: 'System Admin',
      email: 'admin@marinecrm.com',
      passwordHash,
      role: 'ADMIN',
      department: 'Management',
      phone: '+1-555-0190',
    },
    {
      name: 'Rajesh BDM',
      email: 'bdm@marinecrm.com',
      passwordHash,
      role: 'BDM',
      department: 'Sales & Business Development',
      phone: '+971-50-123-4567',
    },
    {
      name: 'Suresh Manager',
      email: 'manager@marinecrm.com',
      passwordHash,
      role: 'MANAGER',
      department: 'Operations',
      phone: '+91-98765-43210',
    },
    {
      name: 'Ananya Sharma',
      email: 'ananya@marinecrm.com',
      passwordHash,
      role: 'BDM',
      department: 'Sales & Business Development',
      phone: '+65-9123-4567',
    },
    {
      name: 'Vikram Singh',
      email: 'vikram@marinecrm.com',
      passwordHash,
      role: 'BDM',
      department: 'Sales & Business Development',
      phone: '+44-20-7946-0912',
    },
  ]);
  console.log(`✅ Created ${users.length} realistic BDM & Admin users`);

  const admin = users[0];
  const bdm = users[1];
  const manager = users[2];
  const seniorBdm = users[3];

  // ─── 2. COUNTRIES ──────────────────────────────────────────────
  const countries = await Country.create([
    { name: 'Dubai', code: 'AE' },
    { name: 'Singapore', code: 'SG' },
    { name: 'Greece', code: 'GR' },
    { name: 'Turkey', code: 'TR' },
    { name: 'Hong Kong', code: 'HK' },
    { name: 'India', code: 'IN' },
    { name: 'Japan', code: 'JP' },
    { name: 'Norway', code: 'NO' },
    { name: 'United Kingdom', code: 'GB' },
    { name: 'Netherlands', code: 'NL' },
    { name: 'Cyprus', code: 'CY' },
    { name: 'Germany', code: 'DE' },
  ]);
  console.log(`✅ Created ${countries.length} maritime hub countries`);

  const countryMap = Object.fromEntries(countries.map((c) => [c.name, c._id]));

  // ─── 3. REASONS (TAXONOMY) ─────────────────────────────────────
  const reasons = await Reason.create([
    { category: 'APPOINTMENT', label: 'Budget constraints / High crew rates', sortOrder: 1 },
    { category: 'APPOINTMENT', label: 'Not interested currently', sortOrder: 2 },
    { category: 'APPOINTMENT', label: 'Already has exclusive crew provider', sortOrder: 3 },
    { category: 'APPOINTMENT', label: 'Requires more time for executive review', sortOrder: 4 },
    { category: 'APPOINTMENT', label: 'Vessel laid up / Not operational', sortOrder: 5 },
    { category: 'APPOINTMENT', label: 'Key decision maker unavailable', sortOrder: 6 },
    { category: 'APPOINTMENT', label: 'Incompatible crew nationality requirements', sortOrder: 7 },
    { category: 'APPOINTMENT', label: 'Other', sortOrder: 99 },
    { category: 'FOLLOWUP', label: 'Client requested call back next month', sortOrder: 1 },
    { category: 'FOLLOWUP', label: 'Awaiting contract review by legal team', sortOrder: 2 },
    { category: 'FOLLOWUP', label: 'Pending board approval for new supplier', sortOrder: 3 },
    { category: 'FOLLOWUP', label: 'Waiting for upcoming dry-docking completion', sortOrder: 4 },
  ]);
  console.log(`✅ Created ${reasons.length} decision & follow-up reason entries`);

  const reasonMap = Object.fromEntries(reasons.map((r) => [r.label, r._id]));

  // ─── 4. COMPANIES (VESSEL OWNERS) ──────────────────────────────
  const companies = await Company.create([
    {
      name: 'Gulf Shipping LLC',
      countryId: countryMap['Dubai'],
      fleetDetails: '8 bulk carriers, 3 crude oil tankers (Suezmax)',
      contactPerson: 'Ahmed Al Rashid (Fleet Director)',
      email: 'ahmed@gulfshipping.ae',
      phone: '+971-4-234-5678',
      website: 'https://gulfshipping.ae',
      status: 'CLIENT',
      notes: 'Key account. Looking for qualified Officers and Chief Engineers.',
      createdById: bdm._id,
    },
    {
      name: 'Pacific Line Maritime',
      countryId: countryMap['Singapore'],
      fleetDetails: '22 container ships, 6 Capesize bulkers',
      contactPerson: 'Tan Wei Ming (General Manager)',
      email: 'wmtan@pacificline.sg',
      phone: '+65-6789-0123',
      website: 'https://pacificline.sg',
      status: 'CLIENT',
      notes: 'Contract active for 12 vessels. Expanding crew supply for feeder ships.',
      createdById: seniorBdm._id,
    },
    {
      name: 'Aegean Maritime SA',
      countryId: countryMap['Greece'],
      fleetDetails: '14 container vessels, 4 feeder ships',
      contactPerson: 'Nikos Papadopoulos (Crewing Manager)',
      email: 'nikos@aegeanmaritime.gr',
      phone: '+30-210-987-6543',
      website: 'https://aegeanmaritime.gr',
      status: 'NEGOTIATING',
      notes: 'Draft agreement sent. Discussing officer wage rates.',
      createdById: bdm._id,
    },
    {
      name: 'Bosphorus Marine Lines',
      countryId: countryMap['Turkey'],
      fleetDetails: '6 chemical tankers, 2 LPG carriers',
      contactPerson: 'Emre Yilmaz (VP Operations)',
      email: 'emre@bosphorusmarine.tr',
      phone: '+90-212-345-6789',
      website: 'https://bosphorusmarine.tr',
      status: 'PROSPECT',
      notes: 'Initial outreach made. Interested in Ratings and AB Seamen.',
      createdById: bdm._id,
    },
    {
      name: 'Pearl River Shipping Co.',
      countryId: countryMap['Hong Kong'],
      fleetDetails: '15 Handymax cargo vessels',
      contactPerson: 'David Chen (Managing Director)',
      email: 'dchen@pearlrivershipping.hk',
      phone: '+852-2123-4567',
      website: 'https://pearlrivershipping.hk',
      status: 'PROSPECT',
      notes: 'Requires Mandarin & English speaking officers.',
      createdById: seniorBdm._id,
    },
    {
      name: 'Nordik Tankers AS',
      countryId: countryMap['Norway'],
      fleetDetails: '10 LNG carriers, 5 product tankers',
      contactPerson: 'Astrid Lindqvist (Head of HR & Crewing)',
      email: 'astrid@nordiktankers.no',
      phone: '+47-22-334455',
      website: 'https://nordiktankers.no',
      status: 'NEGOTIATING',
      notes: 'High compliance requirements. STCW advanced tanker certs required.',
      createdById: bdm._id,
    },
    {
      name: 'Royal Anchor Line',
      countryId: countryMap['India'],
      fleetDetails: '7 Aframax crude oil carriers',
      contactPerson: 'Capt. Vikramaditya Rao (Director Manning)',
      email: 'vrao@royalan-chor.in',
      phone: '+91-22-6789-9900',
      website: 'https://royalanchor.in',
      status: 'CLIENT',
      notes: 'Long-term client since 2024. Excellent payment track record.',
      createdById: bdm._id,
    },
    {
      name: 'Batavia Bulk Carriers',
      countryId: countryMap['Netherlands'],
      fleetDetails: '12 Panamax dry bulk carriers',
      contactPerson: 'Jan van den Berg (Fleet Manager)',
      email: 'j.vandenberg@bataviabulk.nl',
      phone: '+31-10-412-3456',
      website: 'https://bataviabulk.nl',
      status: 'PROSPECT',
      notes: 'Re-evaluating current manning agencies. Proposal submitted.',
      createdById: seniorBdm._id,
    },
    {
      name: 'Sakura Maritime Inc.',
      countryId: countryMap['Japan'],
      fleetDetails: '18 PCTC car carriers, 10 bulkers',
      contactPerson: 'Kenji Takahashi (Global Logistics VP)',
      email: 'k.takahashi@sakuramaritime.jp',
      phone: '+81-3-5555-0143',
      website: 'https://sakuramaritime.jp',
      status: 'CLIENT',
      notes: 'Contract renewed for 2 years. High safety standards.',
      createdById: bdm._id,
    },
    {
      name: 'Neptune Oceanic Services',
      countryId: countryMap['United Kingdom'],
      fleetDetails: '9 offshore supply vessels (OSV/PSV)',
      contactPerson: 'Gavin MacLeod (Crew Procurement)',
      email: 'gmacleod@neptuneoceanic.co.uk',
      phone: '+44-1224-556677',
      website: 'https://neptuneoceanic.co.uk',
      status: 'REJECTED',
      notes: 'Client rejected proposal due to existing multi-year vendor contract.',
      createdById: seniorBdm._id,
    },
    {
      name: 'MedSea Shipping Ltd',
      countryId: countryMap['Cyprus'],
      fleetDetails: '8 refrigerated cargo vessels (Reefers)',
      contactPerson: 'Costas Demetriou (Marine Director)',
      email: 'cdemetriou@medseashipping.com.cy',
      phone: '+357-25-889900',
      website: 'https://medseashipping.com.cy',
      status: 'NEGOTIATING',
      notes: 'Awaiting commercial terms approval from board.',
      createdById: bdm._id,
    },
    {
      name: 'Hansa Freight Lines',
      countryId: countryMap['Germany'],
      fleetDetails: '16 feeder container vessels',
      contactPerson: 'Karl-Heinz Mueller (Senior Port Captain)',
      email: 'k.mueller@hansa-freight.de',
      phone: '+49-40-3344-5566',
      website: 'https://hansa-freight.de',
      status: 'PROSPECT',
      notes: 'Interested in European & Filipino mix officer complement.',
      createdById: seniorBdm._id,
    },
  ]);
  console.log(`✅ Created ${companies.length} realistic vessel owner company profiles`);

  const compMap = Object.fromEntries(companies.map((c) => [c.name, c._id]));

  // ─── 5. CALL LOGS (DAILY CALLING REPORT) ───────────────────────
  const now = new Date();
  const daysAgo = (d) => new Date(now.getTime() - d * 24 * 60 * 60 * 1000);

  const calls = await Call.create([
    {
      companyId: compMap['Gulf Shipping LLC'],
      userId: bdm._id,
      callDate: daysAgo(1),
      durationMinutes: 18,
      statusColor: 'GREEN',
      notes: 'Discussed Master and Chief Engineer replacement for M/T Gulf Trader. Client confirmed satisfaction.',
      nextFollowupDate: daysAgo(-7),
    },
    {
      companyId: compMap['Pacific Line Maritime'],
      userId: seniorBdm._id,
      callDate: daysAgo(2),
      durationMinutes: 25,
      statusColor: 'GREEN',
      notes: 'Reviewed Q3 crew deployment schedule. Client requested 6 additional AB seamen for Singapore joiners.',
      nextFollowupDate: daysAgo(-5),
    },
    {
      companyId: compMap['Aegean Maritime SA'],
      userId: bdm._id,
      callDate: daysAgo(2),
      durationMinutes: 14,
      statusColor: 'YELLOW',
      notes: 'Followed up on agreement terms. Nikos mentioned legal team needs 3 more days.',
      nextFollowupDate: daysAgo(-3),
    },
    {
      companyId: compMap['Bosphorus Marine Lines'],
      userId: bdm._id,
      callDate: daysAgo(3),
      durationMinutes: 10,
      statusColor: 'YELLOW',
      notes: 'Introductory call with Emre. Sent company presentation and rate card.',
      nextFollowupDate: daysAgo(-4),
    },
    {
      companyId: compMap['Nordik Tankers AS'],
      userId: bdm._id,
      callDate: daysAgo(4),
      durationMinutes: 30,
      statusColor: 'GREEN',
      notes: 'In-depth discussion with Astrid regarding STCW Advanced Oil Tanker training requirements.',
      nextFollowupDate: daysAgo(-2),
    },
    {
      companyId: compMap['Pearl River Shipping Co.'],
      userId: seniorBdm._id,
      callDate: daysAgo(5),
      durationMinutes: 8,
      statusColor: 'RED',
      notes: 'Spoke with secretary. David Chen in business meeting. Requested callback.',
      nextFollowupDate: daysAgo(-1),
    },
    {
      companyId: compMap['Royal Anchor Line'],
      userId: bdm._id,
      callDate: daysAgo(6),
      durationMinutes: 15,
      statusColor: 'GREEN',
      notes: 'Routine account management call. All 7 vessels currently fully manned.',
      nextFollowupDate: daysAgo(-10),
    },
    {
      companyId: compMap['Batavia Bulk Carriers'],
      userId: seniorBdm._id,
      callDate: daysAgo(7),
      durationMinutes: 12,
      statusColor: 'YELLOW',
      notes: 'Discussed fleet expansion plans. Jan requested quotation for 4 bulkers.',
      nextFollowupDate: daysAgo(-3),
    },
    {
      companyId: compMap['Neptune Oceanic Services'],
      userId: seniorBdm._id,
      callDate: daysAgo(8),
      durationMinutes: 6,
      statusColor: 'RED',
      notes: 'Gavin informed they renewed contract with existing agency for another 2 years.',
      nextFollowupDate: null,
    },
    {
      companyId: compMap['MedSea Shipping Ltd'],
      userId: bdm._id,
      callDate: daysAgo(9),
      durationMinutes: 20,
      statusColor: 'YELLOW',
      notes: 'Reviewed proposed crew salary matrix. Costas requested 5% discount on management fee.',
      nextFollowupDate: daysAgo(-4),
    },
    {
      companyId: compMap['Hansa Freight Lines'],
      userId: seniorBdm._id,
      callDate: daysAgo(10),
      durationMinutes: 16,
      statusColor: 'YELLOW',
      notes: 'Cold call converted to warm prospect. Karl-Heinz requested agency portfolio.',
      nextFollowupDate: daysAgo(-6),
    },
    {
      companyId: compMap['Sakura Maritime Inc.'],
      userId: bdm._id,
      callDate: daysAgo(12),
      durationMinutes: 22,
      statusColor: 'GREEN',
      notes: 'Quarterly review call. Takahashi-san praised performance of Indian Officers.',
      nextFollowupDate: daysAgo(-14),
    },
  ]);
  console.log(`✅ Created ${calls.length} daily call logs with Red/Yellow/Green status tracking`);

  // ─── 6. APPOINTMENTS ───────────────────────────────────────────
  const appointments = await Appointment.create([
    {
      companyId: compMap['Gulf Shipping LLC'],
      createdById: bdm._id,
      scheduledAt: daysAgo(-2), // Upcoming
      meetingNotes: 'Executive presentation on Senior Officer retention program and wage benchmarks.',
      reminderAt: daysAgo(-1),
    },
    {
      companyId: compMap['Aegean Maritime SA'],
      createdById: bdm._id,
      scheduledAt: daysAgo(-4), // Upcoming
      meetingNotes: 'Final contract negotiation meeting with Nikos and Finance Director.',
      reminderAt: daysAgo(-3),
    },
    {
      companyId: compMap['Batavia Bulk Carriers'],
      createdById: seniorBdm._id,
      scheduledAt: daysAgo(-5), // Upcoming
      meetingNotes: 'Commercial proposal review meeting with Jan van den Berg in Rotterdam office/Zoom.',
      reminderAt: daysAgo(-4),
    },
    {
      companyId: compMap['Pacific Line Maritime'],
      createdById: seniorBdm._id,
      scheduledAt: daysAgo(5), // Past YES
      meetingNotes: 'Annual crewing agreement renewal meeting.',
      outcome: 'YES',
      bookedAt: daysAgo(5),
      decidedById: manager._id,
      decidedAt: daysAgo(5),
      reminderAt: daysAgo(4),
    },
    {
      companyId: compMap['Royal Anchor Line'],
      createdById: bdm._id,
      scheduledAt: daysAgo(15), // Past YES
      meetingNotes: 'Expansion of manning services for 3 newly acquired crude tankers.',
      outcome: 'YES',
      bookedAt: daysAgo(15),
      decidedById: manager._id,
      decidedAt: daysAgo(15),
    },
    {
      companyId: compMap['Sakura Maritime Inc.'],
      createdById: bdm._id,
      scheduledAt: daysAgo(20), // Past YES
      meetingNotes: 'Biannual service level agreement (SLA) review.',
      outcome: 'YES',
      bookedAt: daysAgo(20),
      decidedById: manager._id,
      decidedAt: daysAgo(20),
    },
    {
      companyId: compMap['Neptune Oceanic Services'],
      createdById: seniorBdm._id,
      scheduledAt: daysAgo(8), // Past NO
      meetingNotes: 'Pitching offshore vessel crew manning services.',
      outcome: 'NO',
      reasonId: reasonMap['Already has exclusive crew provider'],
      decidedById: bdm._id,
      decidedAt: daysAgo(8),
    },
    {
      companyId: compMap['Pearl River Shipping Co.'],
      createdById: seniorBdm._id,
      scheduledAt: daysAgo(12), // Past PENDING
      meetingNotes: 'Initial exploratory meeting regarding Mandarin-speaking officers.',
      outcome: 'PENDING',
      reasonId: reasonMap['Requires more time for executive review'],
      decidedById: bdm._id,
      decidedAt: daysAgo(12),
    },
  ]);
  console.log(`✅ Created ${appointments.length} appointment records with decision outcomes`);

  const apptMap = Object.fromEntries(appointments.map((a) => [a.companyId.toString(), a._id]));

  // ─── 7. CONTRACTS ──────────────────────────────────────────────
  const contracts = await Contract.create([
    {
      companyId: compMap['Gulf Shipping LLC'],
      appointmentId: apptMap[compMap['Gulf Shipping LLC'].toString()],
      createdById: bdm._id,
      title: 'Crew Management Master Agreement 2026 — Gulf Shipping',
      fileUrl: '/uploads/sample_gulf_shipping_contract.pdf',
      status: 'ACTIVE',
      signedDate: daysAgo(60),
      expiryDate: daysAgo(-305),
      reminderSent: false,
      notes: 'Covers 11 vessels. Standard 10% agency management fee.',
    },
    {
      companyId: compMap['Pacific Line Maritime'],
      appointmentId: apptMap[compMap['Pacific Line Maritime'].toString()],
      createdById: seniorBdm._id,
      title: 'Manpower Supply Framework Agreement — Pacific Line',
      fileUrl: '/uploads/pacific_line_sla_2026.pdf',
      status: 'ACTIVE',
      signedDate: daysAgo(40),
      expiryDate: daysAgo(-325),
      reminderSent: false,
      notes: 'Exclusive crewing provider for feeder container fleet.',
    },
    {
      companyId: compMap['Royal Anchor Line'],
      appointmentId: apptMap[compMap['Royal Anchor Line'].toString()],
      createdById: bdm._id,
      title: 'Maritime Crewing SLA — Royal Anchor Line',
      fileUrl: '/uploads/royal_anchor_contract.pdf',
      status: 'ACTIVE',
      signedDate: daysAgo(120),
      expiryDate: daysAgo(-245),
      reminderSent: false,
      notes: 'Covers Tanker Officers and ratings.',
    },
    {
      companyId: compMap['Sakura Maritime Inc.'],
      appointmentId: apptMap[compMap['Sakura Maritime Inc.'].toString()],
      createdById: bdm._id,
      title: 'Global Crew Placement Contract — Sakura Maritime',
      fileUrl: '/uploads/sakura_maritime_contract.pdf',
      status: 'ACTIVE',
      signedDate: daysAgo(90),
      expiryDate: daysAgo(-275),
      reminderSent: false,
      notes: 'Multi-year agreement. 28 car carrier vessels.',
    },
    {
      companyId: compMap['Aegean Maritime SA'],
      createdById: bdm._id,
      title: 'Draft Crew Supply Agreement — Aegean Maritime',
      fileUrl: '/uploads/draft_aegean_contract.pdf',
      status: 'DRAFT',
      signedDate: null,
      expiryDate: null,
      reminderSent: false,
      notes: 'Under review by Greek legal counsel.',
    },
    {
      companyId: compMap['Nordik Tankers AS'],
      createdById: bdm._id,
      title: 'Draft Tanker Manning SLA — Nordik Tankers',
      fileUrl: null,
      status: 'DRAFT',
      signedDate: null,
      expiryDate: null,
      reminderSent: false,
      notes: 'Commercial terms being finalized by Astrid.',
    },
  ]);
  console.log(`✅ Created ${contracts.length} vessel owner contracts & SLA documents`);

  // ─── 8. FOLLOW-UPS ─────────────────────────────────────────────
  const followUps = await FollowUp.create([
    {
      sourceType: 'APPOINTMENT',
      sourceId: appointments[7]._id, // Pearl River
      appointmentId: appointments[7]._id,
      reasonId: reasonMap['Requires more time for executive review'],
      status: 'PENDING',
      nextFollowupDate: daysAgo(-3),
      notes: 'Follow up with David Chen regarding Mandarin officer requirements.',
    },
    {
      sourceType: 'APPOINTMENT',
      sourceId: appointments[6]._id, // Neptune Oceanic
      appointmentId: appointments[6]._id,
      reasonId: reasonMap['Already has exclusive crew provider'],
      status: 'REJECTED',
      nextFollowupDate: daysAgo(-180),
      notes: 'Client renewed with existing agency. Re-engage in Q4 2026.',
    },
    {
      sourceType: 'APPOINTMENT',
      appointmentId: appointments[1]._id, // Aegean Maritime
      reasonId: reasonMap['Awaiting contract review by legal team'],
      status: 'PENDING',
      nextFollowupDate: daysAgo(-2),
      notes: 'Check with Nikos if Greek legal team completed contract review.',
    },
  ]);
  console.log(`✅ Created ${followUps.length} follow-up queue records`);

  // ─── 9. ACTIVITIES (AUDIT LOG) ──────────────────────────────────
  await Activity.create([
    {
      userId: bdm._id,
      entityType: 'COMPANY',
      entityId: compMap['Gulf Shipping LLC'].toString(),
      action: 'ADDED_VESSEL_OWNER',
      details: { name: 'Gulf Shipping LLC', country: 'Dubai', status: 'CLIENT' },
      createdAt: daysAgo(60),
    },
    {
      userId: bdm._id,
      entityType: 'CONTRACT',
      entityId: contracts[0]._id.toString(),
      action: 'CREATED_CONTRACT',
      details: { title: contracts[0].title, company: 'Gulf Shipping LLC', status: 'ACTIVE' },
      createdAt: daysAgo(60),
    },
    {
      userId: seniorBdm._id,
      entityType: 'COMPANY',
      entityId: compMap['Pacific Line Maritime'].toString(),
      action: 'ADDED_VESSEL_OWNER',
      details: { name: 'Pacific Line Maritime', country: 'Singapore', status: 'CLIENT' },
      createdAt: daysAgo(40),
    },
    {
      userId: bdm._id,
      entityType: 'CALL',
      entityId: calls[0]._id.toString(),
      action: 'LOGGED_CALL',
      details: { company: 'Gulf Shipping LLC', statusColor: 'GREEN' },
      createdAt: daysAgo(1),
    },
    {
      userId: bdm._id,
      entityType: 'APPOINTMENT',
      entityId: appointments[0]._id.toString(),
      action: 'BOOKED_APPOINTMENT',
      details: { company: 'Gulf Shipping LLC', scheduledAt: appointments[0].scheduledAt },
      createdAt: daysAgo(2),
    },
    {
      userId: seniorBdm._id,
      entityType: 'CALL',
      entityId: calls[1]._id.toString(),
      action: 'LOGGED_CALL',
      details: { company: 'Pacific Line Maritime', statusColor: 'GREEN' },
      createdAt: daysAgo(2),
    },
  ]);
  console.log('✅ Created audit trail activities for dashboard feed');

  // ─── 10. NOTIFICATIONS ─────────────────────────────────────────
  await Notification.create([
    {
      userId: bdm._id,
      type: 'APPOINTMENT_REMINDER',
      message: 'Reminder: Upcoming presentation with Gulf Shipping LLC scheduled for tomorrow.',
      isRead: false,
      link: '/pages/appointments.html',
    },
    {
      userId: bdm._id,
      type: 'FOLLOWUP_ALERT',
      message: 'Follow-up pending: Check Aegean Maritime SA contract status with Nikos.',
      isRead: false,
      link: '/pages/followups.html',
    },
    {
      userId: manager._id,
      type: 'NEW_CLIENT',
      message: 'New client acquired: Pacific Line Maritime (22 container vessels).',
      isRead: true,
      link: '/pages/companies.html',
    },
  ]);
  console.log('✅ Created in-app notifications');

  console.log('\n🎉 Comprehensive BDM Sales Pipeline Database seeded successfully!');
  console.log('\n📋 Demo Credentials:');
  console.log('   Admin:        admin@marinecrm.com   / admin123');
  console.log('   BDM (Rajesh): bdm@marinecrm.com     / admin123');
  console.log('   Manager:      manager@marinecrm.com  / admin123');
  console.log('   Senior BDM:   ananya@marinecrm.com   / admin123');
  console.log('\n📊 Data Summary:');
  console.log(`   - Users:        ${users.length}`);
  console.log(`   - Countries:    ${countries.length}`);
  console.log(`   - Companies:    ${companies.length}`);
  console.log(`   - Call Logs:    ${calls.length}`);
  console.log(`   - Appointments: ${appointments.length}`);
  console.log(`   - Contracts:    ${contracts.length}`);
  console.log(`   - FollowUps:    ${followUps.length}`);

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((e) => {
  console.error('❌ Seed failed:', e);
  process.exit(1);
});
