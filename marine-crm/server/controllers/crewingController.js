const fs = require('fs');
const { Candidate, Requirement, Application, Onboarding, Reason, Company, Vessel, User, Document } = require('../models');
const { logActivity } = require('../utils/activityLogger');
const { getDataScope, canAccessRecord } = require('../utils/accessScope');
const {
  isValidTransition, isRoleAllowedForStatus,
  REQUIRED_CANDIDATE_DOCUMENT_TYPES, computeDocumentationStatus,
} = require('../utils/workflow');
const { ROLES, ORG_WIDE_ROLES, DEPARTMENTS } = require('../utils/roles');
const { normalizeCoc } = require('../utils/normalize');

// ─── REQUIREMENTS CRUD ──────────────────────────────────────────

const getVessels = async (req, res, next) => {
  try {
    const query = req.query.companyId ? { companyId: req.query.companyId } : {};
    const vessels = await Vessel.find(query).sort({ name: 1 });
    res.json({ success: true, data: vessels });
  } catch (err) {
    next(err);
  }
};

const createVessel = async (req, res, next) => {
  try {
    const name = String(req.body.name || '').trim();
    const { companyId } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Vessel name is required.' });

    if (companyId) {
      const company = await Company.findById(companyId).select('_id');
      if (!company) return res.status(404).json({ success: false, message: 'Vessel owner not found.' });
    }

    const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const existing = await Vessel.findOne({ companyId, name: { $regex: `^${escapedName}$`, $options: 'i' } });
    if (existing) return res.status(409).json({ success: false, message: 'A vessel with this name already exists for this owner.' });

    const vessel = await Vessel.create({ name, companyId, createdById: req.user.id });
    res.status(201).json({ success: true, data: vessel });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ success: false, message: 'A vessel with this name already exists for this owner.' });
    next(err);
  }
};

const getRequirements = async (req, res, next) => {
  try {
    const { companyId, vesselType, rank, status } = req.query;
    const query = {};

    if (companyId) query.companyId = companyId;
    if (vesselType) query.vesselType = vesselType;
    if (rank) query.rank = rank;
    if (status) query.status = status;

    // Backend record-level filtering — never load-then-filter in the client.
    const scope = await getDataScope(req.currentUser, 'REQUIREMENT');
    Object.assign(query, scope);

    const requirements = await Requirement.find(query)
      .sort({ createdAt: -1 })
      .populate('companyId', 'name contactPerson phone email')
      .populate('vesselId', 'name');

    res.json({ success: true, data: requirements });
  } catch (err) {
    next(err);
  }
};

const createRequirement = async (req, res, next) => {
  try {
    const { companyId, vesselId, vesselName, vesselType, rank, experienceMonthsRequired, joiningDate, salaryOffered } = req.body;
    if ((!vesselId && !vesselName) || !vesselType || !rank || !joiningDate) {
      return res.status(400).json({ success: false, message: 'Vessel, vesselType, rank, and joiningDate are required.' });
    }

    let vessel;
    if (vesselId) {
      vessel = await Vessel.findOne(companyId ? { _id: vesselId, companyId } : { _id: vesselId });
      if (!vessel) return res.status(400).json({ success: false, message: 'Selected vessel does not belong to the selected owner.' });
    } else {
      const name = String(vesselName).trim();
      const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      vessel = await Vessel.findOne({ ...(companyId ? { companyId } : {}), name: { $regex: `^${escapedName}$`, $options: 'i' } });
      if (!vessel) vessel = await Vessel.create({ name, companyId, createdById: req.user.id });
    }

    const creator = req.currentUser;

    const requirement = await Requirement.create({
      companyId,
      vesselId: vessel._id,
      vesselType,
      rank,
      experienceMonthsRequired: experienceMonthsRequired ? parseInt(experienceMonthsRequired) : 0,
      joiningDate: new Date(joiningDate),
      salaryOffered: salaryOffered ? parseFloat(salaryOffered) : null,
      createdById: req.user.id,
      assignedToId: req.user.id,
      managerId: creator.role === ROLES.SOURCING_OFFICER ? creator.reportingTo : null,
      department: creator.department || DEPARTMENTS.SOURCING,
    });

    await requirement.populate('companyId', 'name');

    if (req.user) {
      await logActivity({
        userId: req.user.id,
        entityType: 'REQUIREMENT',
        entityId: requirement._id.toString(),
        action: 'CREATED_REQUIREMENT',
        details: { company: requirement.companyId?.name, rank, vesselType }
      });
    }

    res.status(201).json({ success: true, data: requirement });
  } catch (err) {
    next(err);
  }
};

const updateRequirement = async (req, res, next) => {
  try {
    const existing = await Requirement.findById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, message: 'Requirement not found.' });

    const allowedToAccess = await canAccessRecord(req.currentUser, existing, 'REQUIREMENT');
    if (!allowedToAccess) {
      return res.status(403).json({ success: false, message: 'You do not have access to this requirement.' });
    }

    const allowed = ['vesselType', 'rank', 'experienceMonthsRequired', 'joiningDate', 'salaryOffered', 'status', 'assignedToId'];
    const updateData = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));

    if (updateData.joiningDate) updateData.joiningDate = new Date(updateData.joiningDate);
    if (updateData.experienceMonthsRequired !== undefined) updateData.experienceMonthsRequired = parseInt(updateData.experienceMonthsRequired);
    if (updateData.salaryOffered !== undefined) updateData.salaryOffered = updateData.salaryOffered ? parseFloat(updateData.salaryOffered) : null;

    const requirement = await Requirement.findByIdAndUpdate(req.params.id, updateData, { new: true })
      .populate('companyId', 'name');

    if (!requirement) return res.status(404).json({ success: false, message: 'Requirement not found.' });

    res.json({ success: true, data: requirement });
  } catch (err) {
    next(err);
  }
};

const deleteRequirement = async (req, res, next) => {
  try {
    const existing = await Requirement.findById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, message: 'Requirement not found.' });

    const allowedToAccess = await canAccessRecord(req.currentUser, existing, 'REQUIREMENT');
    if (!allowedToAccess) {
      return res.status(403).json({ success: false, message: 'You do not have access to this requirement.' });
    }

    await Requirement.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Requirement deleted successfully.' });
  } catch (err) {
    next(err);
  }
};

// ─── CANDIDATES CRUD ─────────────────────────────────────────────

const getCandidateByCoc = async (req, res, next) => {
  try {
    const rawCoc = req.params.cocNumber;
    const normalized = normalizeCoc(rawCoc);
    if (!normalized) {
      return res.status(400).json({ success: false, message: 'Valid COC number is required.' });
    }

    const candidate = await Candidate.findOne({ cocNumber: normalized });
    if (!candidate) {
      return res.status(404).json({ success: false, message: 'Candidate with this COC number not found.' });
    }

    res.json({ success: true, data: candidate });
  } catch (err) {
    next(err);
  }
};

const getCandidates = async (req, res, next) => {
  try {
    const { rank, status, search, expectedSalaryMax } = req.query;
    const query = {};

    if (rank) query.rank = rank;
    if (status) query.status = status;
    if (expectedSalaryMax) query.expectedSalary = { $lte: parseFloat(expectedSalaryMax) };

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { cocNumber: { $regex: search, $options: 'i' } },
        { nationality: { $regex: search, $options: 'i' } },
        { currentVessel: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }

    // Backend record-level filtering (Role → Department → Hierarchy →
    // Ownership). This is the fix for §18: getCandidates() must NOT simply
    // return all candidates for every authenticated user.
    const scope = await getDataScope(req.currentUser, 'CANDIDATE');
    if (scope.$or && query.$or) {
      // Both the search filter and the scope filter use $or — combine with $and.
      const { $or: scopeOr, ...scopeRest } = scope;
      query.$and = [{ $or: query.$or }, { $or: scopeOr }];
      delete query.$or;
      Object.assign(query, scopeRest);
    } else {
      Object.assign(query, scope);
    }

    const candidates = await Candidate.find(query)
      .populate('createdById', 'name email role')
      .sort({ createdAt: -1 });

    // TEMP DEBUG — remove once "Added By" is confirmed working end-to-end.
    if (candidates[0]) {
      console.log('GET CANDIDATES — first record createdById:', candidates[0].createdById);
    }

    // Express auto-generates an ETag for every JSON response by default;
    // a browser can legitimately cache this list and only re-validate on
    // navigation. Explicitly disabling caching here rules that out as a
    // cause of a stale "Added By" — scoped to this one route only.
    res.set('Cache-Control', 'no-store');
    res.json({ success: true, data: candidates });
  } catch (err) {
    next(err);
  }
};

const createCandidate = async (req, res, next) => {
  try {
    const {
      name, rank, nationality, phone, email, cocNumber, passportNumber, passportExpiryDate, cdcNumber, cdcExpiryDate,
      currentVessel, experienceYears, availableFrom, expectedSalary, currency, notes
    } = req.body;

    if (!name || !rank) {
      return res.status(400).json({ success: false, message: 'Name and rank are required.' });
    }

    const normalizedCoc = normalizeCoc(cocNumber);
    if (normalizedCoc) {
      const existingCoc = await Candidate.findOne({ cocNumber: normalizedCoc });
      if (existingCoc) {
        return res.status(400).json({
          success: false,
          message: 'COC number already exists. This seafarer is already registered.',
        });
      }
    }

    const creator = req.currentUser;
    const isSourcingOfficer = creator.role === ROLES.SOURCING_OFFICER;

    // TEMP DEBUG — remove once "Added By" is confirmed working end-to-end.
    console.log('CREATE CANDIDATE USER:', {
      id: req.user?.id,
      currentUserId: req.currentUser?.id,
      role: req.currentUser?.role,
    });

    const candidate = await Candidate.create({
      name, rank,
      cocNumber: normalizedCoc || null,
      nationality: nationality || null,
      phone: phone || null,
      email: email || null,
      passportNumber: passportNumber || null,
      passportExpiryDate: passportExpiryDate ? new Date(passportExpiryDate) : null,
      cdcNumber: cdcNumber || null,
      cdcExpiryDate: cdcExpiryDate ? new Date(cdcExpiryDate) : null,
      currentVessel: currentVessel || null,
      experienceYears: experienceYears ? parseInt(experienceYears, 10) : 0,
      availableFrom: availableFrom ? new Date(availableFrom) : null,
      expectedSalary: expectedSalary ? parseFloat(expectedSalary) : null,
      currency: currency || 'USD',
      notes: notes || null,
      createdById: req.user.id,
      assignedToId: req.user.id,
      teamManagerId: isSourcingOfficer ? creator.reportingTo : null,
      department: DEPARTMENTS.SOURCING,
      currentDepartment: DEPARTMENTS.SOURCING,
      currentOwnerId: req.user.id,
      workflowStage: 'CV_SCREENING',
    });

    if (req.user) {
      await logActivity({
        userId: req.user.id,
        entityType: 'CANDIDATE',
        entityId: candidate._id.toString(),
        action: 'REGISTERED_CANDIDATE',
        details: { name: candidate.name, rank: candidate.rank, cocNumber: candidate.cocNumber }
      });
    }

    res.status(201).json({ success: true, data: candidate });
  } catch (err) {
    if (err.code === 11000 && err.keyPattern && err.keyPattern.cocNumber) {
      return res.status(400).json({
        success: false,
        message: 'COC number already exists. This seafarer is already registered.',
      });
    }
    next(err);
  }
};

const updateCandidate = async (req, res, next) => {
  try {
    const existing = await Candidate.findById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, message: 'Candidate not found.' });

    const allowedToAccess = await canAccessRecord(req.currentUser, existing, 'CANDIDATE');
    if (!allowedToAccess) {
      return res.status(403).json({ success: false, message: 'You do not have access to this candidate record.' });
    }

    const allowedFields = [
      'name', 'rank', 'nationality', 'phone', 'email', 'cocNumber', 'passportNumber', 'passportExpiryDate',
      'cdcNumber', 'cdcExpiryDate',
      'currentVessel', 'experienceYears', 'availableFrom', 'expectedSalary', 'currency', 'status', 'notes'
    ];
    const updateData = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    }

    if (updateData.cocNumber !== undefined) {
      const normalizedCoc = normalizeCoc(updateData.cocNumber);
      if (normalizedCoc && normalizedCoc !== existing.cocNumber) {
        const existingCoc = await Candidate.findOne({ cocNumber: normalizedCoc });
        if (existingCoc && existingCoc._id.toString() !== existing._id.toString()) {
          return res.status(400).json({
            success: false,
            message: 'COC number already exists. This seafarer is already registered.',
          });
        }
        updateData.cocNumber = normalizedCoc;
      } else if (!normalizedCoc) {
        updateData.cocNumber = null;
      }
    }
    if (updateData.passportExpiryDate === '') updateData.passportExpiryDate = null;
    else if (updateData.passportExpiryDate) updateData.passportExpiryDate = new Date(updateData.passportExpiryDate);
    if (updateData.cdcExpiryDate === '') updateData.cdcExpiryDate = null;
    else if (updateData.cdcExpiryDate) updateData.cdcExpiryDate = new Date(updateData.cdcExpiryDate);

    // §22 — workflow transition control: no arbitrary jumping between
    // stages, and sensitive downstream statuses are role-gated.
    if (updateData.status && updateData.status !== existing.status) {
      if (!isValidTransition(existing.status, updateData.status)) {
        return res.status(400).json({
          success: false,
          message: `Invalid status transition: ${existing.status} → ${updateData.status}.`,
        });
      }
      if (!isRoleAllowedForStatus(req.currentUser.role, updateData.status)) {
        return res.status(403).json({
          success: false,
          message: `Your role is not permitted to set candidate status to ${updateData.status}.`,
        });
      }

      // Setting status to APPROVED strictly requires an accepted Application
      if (updateData.status === 'APPROVED') {
        const acceptedApp = await Application.findOne({ candidateId: existing._id, status: 'CLIENT_ACCEPTED' });
        if (!acceptedApp) {
          return res.status(400).json({
            success: false,
            message: 'Candidate cannot be marked APPROVED without a client-accepted application.',
          });
        }
      }

      // Keep department/workflowStage/ownership in sync as the SAME
      // candidate record moves through the pipeline (never duplicated).
      if (updateData.status === 'DOCUMENTATION') {
        updateData.currentDepartment = DEPARTMENTS.DOCUMENTATION;
        updateData.department = DEPARTMENTS.DOCUMENTATION;
        updateData.workflowStage = 'DOCUMENTATION';
        updateData.currentOwnerId = null; // enters the documentation team's shared queue
      } else if (updateData.status === 'ACCOUNTS') {
        updateData.currentDepartment = DEPARTMENTS.ACCOUNTS;
        updateData.department = DEPARTMENTS.ACCOUNTS;
        updateData.workflowStage = 'ACCOUNTS';
        updateData.currentOwnerId = null;
      } else if (updateData.status === 'ONBOARDING') {
        updateData.currentDepartment = DEPARTMENTS.ONBOARDING;
        updateData.department = DEPARTMENTS.ONBOARDING;
        updateData.workflowStage = 'ONBOARDING';
      } else if (updateData.status === 'ONBOARDED') {
        updateData.workflowStage = 'ONBOARDED';
      }

      await logActivity({
        userId: req.user.id,
        entityType: 'CANDIDATE',
        entityId: existing._id.toString(),
        action: 'CANDIDATE_STATUS_CHANGED',
        details: { name: existing.name, from: existing.status, to: updateData.status },
      });
    }

    if (updateData.availableFrom) updateData.availableFrom = new Date(updateData.availableFrom);
    if (updateData.experienceYears !== undefined) updateData.experienceYears = parseInt(updateData.experienceYears, 10);
    if (updateData.expectedSalary !== undefined) updateData.expectedSalary = updateData.expectedSalary ? parseFloat(updateData.expectedSalary) : null;

    const candidate = await Candidate.findByIdAndUpdate(req.params.id, updateData, { new: true });
    if (!candidate) return res.status(404).json({ success: false, message: 'Candidate not found.' });

    // Auto-create the Onboarding checklist record the moment a candidate
    // actually lands on ONBOARDING (not at CLIENT_ACCEPTED/APPROVED — see
    // setApplicationDecision's comment on why that would be premature).
    // Without this, the Operations → Onboarding tab has no record to ever
    // show, no matter how many candidates reach this stage.
    if (updateData.status === 'ONBOARDING') {
      const acceptedApp = await Application.findOne({ candidateId: candidate._id, status: 'CLIENT_ACCEPTED' })
        .sort({ createdAt: -1 })
        .populate('requirementId');
      if (acceptedApp && acceptedApp.requirementId) {
        try {
          await Onboarding.create({
            candidateId: candidate._id,
            requirementId: acceptedApp.requirementId._id,
            companyId: acceptedApp.requirementId.companyId,
            updatedById: req.user.id,
          });
        } catch (createErr) {
          // E11000 = duplicate key on the candidateId+requirementId unique
          // index — an Onboarding record already exists for this pair
          // (e.g. the transition fired twice). Not an error; leave the
          // existing record as-is rather than failing the whole request.
          if (createErr.code !== 11000) throw createErr;
        }
      }
      // No CLIENT_ACCEPTED application found is an inconsistent-data edge
      // case (shouldn't happen given the state machine requires APPROVED,
      // which itself requires an accepted application, before ONBOARDING
      // is reachable) — the candidate status change still succeeds; it
      // just won't have an onboarding checklist to show until that's
      // resolved, same as any other missing-relationship case elsewhere
      // in this codebase (logged nowhere further since it's not fatal).
    }

    res.json({ success: true, data: candidate });
  } catch (err) {
    next(err);
  }
};

const deleteCandidate = async (req, res, next) => {
  try {
    const existing = await Candidate.findById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, message: 'Candidate not found.' });

    const allowedToAccess = await canAccessRecord(req.currentUser, existing, 'CANDIDATE');
    if (!allowedToAccess) {
      return res.status(403).json({ success: false, message: 'You do not have access to this candidate record.' });
    }

    await Candidate.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Candidate profile deleted.' });
  } catch (err) {
    next(err);
  }
};

// ─── AUTOMATED MATCHING ENGINE ──────────────────────────────────────

const matchCandidates = async (req, res, next) => {
  try {
    const requirement = await Requirement.findById(req.params.id);
    if (!requirement) return res.status(404).json({ success: false, message: 'Requirement not found.' });

    const allowedToAccess = await canAccessRecord(req.currentUser, requirement, 'REQUIREMENT');
    if (!allowedToAccess) {
      return res.status(403).json({ success: false, message: 'You do not have access to this requirement.' });
    }

    // Matching criteria:
    // 1. Rank matches
    // 2. Status is AVAILABLE or SHORTLISTED (not proposed/onboarded)
    // 3. experienceYears meets the requirement's minimum (converted from months)
    // NOTE: the Candidate schema does not track experience per-vessel-type
    // (there is no vesselExperience list), only a single currentVessel and
    // an overall experienceYears count, so vessel-type-specific matching
    // isn't possible without extending the schema — this matches on the
    // closest real data available instead of crashing.
    const minExperienceYears = requirement.experienceMonthsRequired
      ? requirement.experienceMonthsRequired / 12
      : 0;

    const query = {
      rank: requirement.rank,
      status: { $in: ['AVAILABLE', 'SHORTLISTED'] },
      experienceYears: { $gte: minExperienceYears },
    };

    // Only match against candidates this user is actually allowed to see.
    const scope = await getDataScope(req.currentUser, 'CANDIDATE');
    Object.assign(query, scope);

    const matched = await Candidate.find(query);

    res.json({ success: true, data: matched });
  } catch (err) {
    next(err);
  }
};

// ─── SUBMISSIONS & APPLICATIONS ─────────────────────────────────────

const getApplications = async (req, res, next) => {
  try {
    const { requirementId, candidateId, status } = req.query;
    const query = {};
    if (requirementId) query.requirementId = requirementId;
    if (candidateId) query.candidateId = candidateId;
    if (status) query.status = status;

    const scope = await getDataScope(req.currentUser, 'APPLICATION');
    Object.assign(query, scope);

    const applications = await Application.find(query)
      .sort({ createdAt: -1 })
      .populate('candidateId')
      .populate({
        path: 'requirementId',
        populate: { path: 'companyId', select: 'name contactPerson phone email' }
      })
      .populate('rejectionReasonId', 'label category')
      .populate('createdById', 'name email');

    res.json({ success: true, data: applications });
  } catch (err) {
    next(err);
  }
};

const proposeCandidate = async (req, res, next) => {
  try {
    const { requirementId, candidateId } = req.body;
    if (!requirementId || !candidateId) {
      return res.status(400).json({ success: false, message: 'requirementId and candidateId are required.' });
    }

    const candidate = await Candidate.findById(candidateId);
    if (!candidate) return res.status(404).json({ success: false, message: 'Candidate not found.' });

    const canAccessCandidate = await canAccessRecord(req.currentUser, candidate, 'CANDIDATE');
    if (!canAccessCandidate) {
      return res.status(403).json({ success: false, message: 'You do not have access to this candidate.' });
    }

    const requirement = await Requirement.findById(requirementId);
    if (!requirement) return res.status(404).json({ success: false, message: 'Requirement not found.' });

    // §5 — the same candidate must not be proposed twice for the same
    // requirement. Check this BEFORE the status-transition check below,
    // since by the time an Application already exists with status
    // PROPOSED, the candidate's own status is also already PROPOSED
    // (see the bottom of this function) — which would otherwise surface
    // as a confusing generic "Cannot propose a candidate in status
    // PROPOSED" instead of a clear duplicate message.
    let application = await Application.findOne({ requirementId, candidateId });
    if (application && application.status === 'PROPOSED') {
      return res.status(400).json({
        success: false,
        message: 'Candidate has already been proposed for this requirement.'
      });
    }

    if (!isValidTransition(candidate.status, 'PROPOSED')) {
      return res.status(400).json({ success: false, message: `Cannot propose a candidate in status ${candidate.status}.` });
    }

    if (application) {
      application.status = 'PROPOSED';
      await application.save();
    } else {
      try {
        application = await Application.create({
          requirementId,
          candidateId,
          status: 'PROPOSED',
          createdById: req.user.id
        });
      } catch (createErr) {
        if (createErr.code === 11000) {
          application = await Application.findOne({ requirementId, candidateId });
          if (application) {
            application.status = 'PROPOSED';
            await application.save();
          }
        } else {
          throw createErr;
        }
      }
    }

    candidate.status = 'PROPOSED';
    candidate.workflowStage = 'PROPOSED';
    await candidate.save();

    await logActivity({
      userId: req.user.id,
      entityType: 'APPLICATION',
      entityId: application._id.toString(),
      action: 'PROPOSED_CANDIDATE',
      details: { candidate: candidate.name, requirement: requirement.rank + ' - ' + requirement.vesselType }
    });

    res.status(201).json({ success: true, data: application, message: 'Candidate successfully proposed.' });
  } catch (err) {
    next(err);
  }
};

const setApplicationDecision = async (req, res, next) => {
  try {
    const { status, rejectionReasonId, rejectionNotes } = req.body;
    if (!['CLIENT_ACCEPTED', 'CLIENT_REJECTED'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Status must be CLIENT_ACCEPTED or CLIENT_REJECTED.' });
    }

    const application = await Application.findById(req.params.id)
      .populate('candidateId')
      .populate('requirementId');

    if (!application) return res.status(404).json({ success: false, message: 'Application record not found.' });

    const canAccessApp = await canAccessRecord(req.currentUser, application, 'APPLICATION');
    if (!canAccessApp) {
      return res.status(403).json({ success: false, message: 'You do not have access to this application.' });
    }

    application.status = status;
    const candidate = await Candidate.findById(application.candidateId._id);

    if (status === 'CLIENT_ACCEPTED') {
      application.rejectionReasonId = null;
      application.rejectionNotes = null;

      if (candidate) {
        candidate.status = 'APPROVED';
        candidate.workflowStage = 'CLIENT_ACCEPTED';
        await candidate.save();

        // Part 3 §2: once a proposal is accepted, the candidate must
        // immediately move on into the Documentation stage so the
        // Documentation section on the Review Proposal screen has
        // somewhere real to attach uploads to — this is a system-driven
        // transition (not a client-supplied status write), but it still
        // goes through the same workflow.js state machine as every other
        // transition rather than setting workflowStage directly, so the
        // rules stay in one place. APPROVED -> DOCUMENTATION is always a
        // valid transition (see CANDIDATE_STATUS_TRANSITIONS), so this
        // only defensively no-ops if that ever changes.
        if (isValidTransition(candidate.status, 'DOCUMENTATION')) {
          candidate.status = 'DOCUMENTATION';
          candidate.currentDepartment = DEPARTMENTS.DOCUMENTATION;
          candidate.department = DEPARTMENTS.DOCUMENTATION;
          candidate.workflowStage = 'DOCUMENTATION';
          candidate.currentOwnerId = null; // enters the documentation team's shared queue
          await candidate.save();

          await logActivity({
            userId: req.user.id,
            entityType: 'CANDIDATE',
            entityId: candidate._id.toString(),
            action: 'CANDIDATE_MOVED_TO_DOCUMENTATION',
            details: { name: candidate.name, from: 'APPROVED', to: 'DOCUMENTATION' },
          });
        }
      }
      // M7: Do not create premature Onboarding record here upon client acceptance.
      // Onboarding record is created when the candidate reaches the Onboarding stage.
    } else {
      if (!rejectionReasonId) {
        return res.status(400).json({ success: false, message: 'rejectionReasonId is required for rejections.' });
      }
      application.rejectionReasonId = rejectionReasonId;
      application.rejectionNotes = rejectionNotes || null;

      if (candidate) {
        candidate.status = 'REJECTED_TALENT_POOL';
        candidate.workflowStage = 'CLIENT_REJECTED';
        await candidate.save();
      }
    }

    await application.save();

    await logActivity({
      userId: req.user.id,
      entityType: 'APPLICATION',
      entityId: application._id.toString(),
      action: 'APPLICATION_DECISION',
      details: { candidate: candidate?.name, status }
    });

    res.json({ success: true, data: application });
  } catch (err) {
    next(err);
  }
};

// ─── CANDIDATE DOCUMENTATION (Part 3) ───────────────────────────────
// These live in crewingController (not documents.controller.js) and are
// mounted under /api/crewing, deliberately separate from the general
// /api/documents module — that module's router-level requireRole()
// gates the WHOLE Documents page to Documentation staff + org-wide
// roles only (§6/§24 of the Part 3 spec: sourcing/crewing officers must
// get candidate-specific upload access, never full Documents module
// access). Reusing the existing Document model (§4) and the existing
// documentUpload multer middleware (§9) — no second document system.

// GET /api/crewing/candidates/:candidateId/documents
// Returns the candidate's documents plus a computed documentation
// completeness summary (§12/§13). Available to anyone who can already
// access this candidate record (canAccessRecord), which naturally
// covers: the sourcing officer/manager who owns the candidate, the
// documentation team once the candidate is in their queue, and
// org-wide/HR roles.
const getCandidateDocuments = async (req, res, next) => {
  try {
    const candidate = await Candidate.findById(req.params.candidateId);
    if (!candidate) return res.status(404).json({ success: false, message: 'Candidate not found.' });

    const allowedToAccess = await canAccessRecord(req.currentUser, candidate, 'CANDIDATE');
    if (!allowedToAccess) {
      return res.status(403).json({ success: false, message: 'You do not have access to this candidate record.' });
    }

    const documents = await Document.find({ candidateId: candidate._id })
      .populate('uploadedBy', 'name email')
      .sort({ createdAt: -1 });

    // Self-heal fileUrl the same way getAllDocuments() does in
    // documents.controller.js, so a stale/placeholder URL never leaks
    // out of this endpoint either.
    const withFreshUrls = documents.map((d) => {
      const obj = d.toObject ? d.toObject() : d;
      obj.fileUrl = `/api/documents/${obj._id}/file`;
      return obj;
    });

    const documentationStatus = computeDocumentationStatus(withFreshUrls);

    res.json({
      success: true,
      data: {
        documents: withFreshUrls,
        documentationStatus: documentationStatus.overallStatus,
        requiredDocumentTypes: documentationStatus.requiredTypes,
        byType: documentationStatus.byType,
      },
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/crewing/candidates/:candidateId/documents (multipart/form-data: file, documentType, notes)
// Expects `documentUpload.single('file')` to already have run (wired in
// routes/crewing.js) so req.file / req.body are populated.
const uploadCandidateDocument = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file was uploaded. Attach a file and try again.' });
    }

    const cleanupUploadedFile = () => {
      if (req.file?.path) fs.unlink(req.file.path, () => {});
    };

    const userId = req.user?.id || req.user?._id;
    if (!userId) {
      cleanupUploadedFile();
      return res.status(401).json({ success: false, message: 'Authentication required. No valid user session found.' });
    }

    const candidate = await Candidate.findById(req.params.candidateId);
    if (!candidate) {
      cleanupUploadedFile();
      return res.status(404).json({ success: false, message: 'Candidate not found.' });
    }

    // §7.4 — candidate must be within this user's allowed access scope
    // (this is what keeps the three restricted sourcing accounts scoped
    // to only their own candidates, never the whole seafarer database).
    const allowedToAccess = await canAccessRecord(req.currentUser, candidate, 'CANDIDATE');
    if (!allowedToAccess) {
      cleanupUploadedFile();
      return res.status(403).json({ success: false, message: 'You do not have access to this candidate record.' });
    }

    // §7.5 — candidate must actually be in the Documentation stage.
    if (candidate.status !== 'DOCUMENTATION') {
      cleanupUploadedFile();
      return res.status(400).json({
        success: false,
        message: `Documents can only be uploaded once a candidate reaches the Documentation stage (current status: ${candidate.status}).`,
      });
    }

    const { documentType, notes } = req.body;
    if (!documentType || !REQUIRED_CANDIDATE_DOCUMENT_TYPES.includes(documentType)) {
      cleanupUploadedFile();
      return res.status(400).json({
        success: false,
        message: `documentType must be one of: ${REQUIRED_CANDIDATE_DOCUMENT_TYPES.join(', ')}.`,
      });
    }

    // §8 — never trust a client-supplied uploadedBy; always the
    // authenticated user. §19 — old rejected documents are never
    // deleted here; a fresh upload simply creates a new PENDING record
    // of the same category, and computeDocumentationStatus() already
    // reads the most recent one per type.
    const doc = await Document.create({
      name: req.file.originalname,
      filePath: req.file.path,
      fileUrl: `/uploads/documents/${req.file.filename}`, // placeholder; corrected below, same pattern as documents.controller.js
      mimeType: req.file.mimetype,
      size: req.file.size,
      category: documentType,
      candidateId: candidate._id,
      employeeId: null,
      notes: notes ? notes.trim() : '',
      status: 'PENDING',
      uploadedBy: userId,
    });

    doc.fileUrl = `/api/documents/${doc._id}/file`;
    await doc.save();

    const populated = await doc.populate('uploadedBy', 'name email');

    await logActivity({
      userId: req.user.id,
      entityType: 'DOCUMENT',
      entityId: doc._id.toString(),
      action: 'CANDIDATE_DOCUMENT_UPLOADED',
      details: { candidate: candidate.name, documentType, fileName: doc.name },
    });

    res.status(201).json({ success: true, data: populated });
  } catch (err) {
    console.error('uploadCandidateDocument error:', err);
    if (req.file?.path) fs.unlink(req.file.path, () => {});
    if (err.name === 'ValidationError') {
      return res.status(400).json({ success: false, message: err.message });
    }
    next(err);
  }
};

// ─── CANDIDATE REASSIGNMENT ─────────────────────────────────────────
const reassignCandidate = async (req, res, next) => {
  try {
    const { assignedToId } = req.body;
    if (!assignedToId) {
      return res.status(400).json({ success: false, message: 'assignedToId is required.' });
    }

    const candidate = await Candidate.findById(req.params.id);
    if (!candidate) return res.status(404).json({ success: false, message: 'Candidate not found.' });

    const allowedToAccess = await canAccessRecord(req.currentUser, candidate, 'CANDIDATE');
    if (!allowedToAccess) {
      return res.status(403).json({ success: false, message: 'You do not have access to this candidate record.' });
    }

    const isManagerOrOrg = ORG_WIDE_ROLES.has(req.currentUser.role) ||
      [ROLES.SOURCING_MANAGER, ROLES.DOCUMENTATION_MANAGER, ROLES.ADMIN, ROLES.HR, ROLES.DIRECTOR, ROLES.COO].includes(req.currentUser.role);
    if (!isManagerOrOrg) {
      return res.status(403).json({ success: false, message: 'Only managers or administrators can reassign candidates.' });
    }

    const targetUser = await User.findById(assignedToId);
    if (!targetUser || !targetUser.isActive) {
      return res.status(400).json({ success: false, message: 'Target user does not exist or is inactive.' });
    }

    candidate.assignedToId = targetUser._id;
    candidate.currentOwnerId = targetUser._id;
    await candidate.save();

    await logActivity({
      userId: req.user.id,
      entityType: 'CANDIDATE',
      entityId: candidate._id.toString(),
      action: 'REASSIGNED_CANDIDATE',
      details: { candidate: candidate.name, assignedTo: targetUser.name, role: targetUser.role },
    });

    res.json({ success: true, data: candidate, message: `Candidate reassigned to ${targetUser.name}.` });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getVessels,
  createVessel,
  getRequirements,
  createRequirement,
  updateRequirement,
  deleteRequirement,
  getCandidates,
  getCandidateByCoc,
  createCandidate,
  updateCandidate,
  reassignCandidate,
  deleteCandidate,
  matchCandidates,
  getApplications,
  proposeCandidate,
  setApplicationDecision,
  getCandidateDocuments,
  uploadCandidateDocument
};