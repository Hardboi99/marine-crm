const { Candidate, Requirement, Application, Onboarding, Reason, Company, User } = require('../models');
const { logActivity } = require('../utils/activityLogger');
const { getDataScope, canAccessRecord } = require('../utils/accessScope');
const { isValidTransition, isRoleAllowedForStatus } = require('../utils/workflow');
const { ROLES, ORG_WIDE_ROLES, DEPARTMENTS } = require('../utils/roles');

// ─── REQUIREMENTS CRUD ──────────────────────────────────────────

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
      .populate('companyId', 'name contactPerson phone email');

    res.json({ success: true, data: requirements });
  } catch (err) {
    next(err);
  }
};

const createRequirement = async (req, res, next) => {
  try {
    const { companyId, vesselType, rank, experienceMonthsRequired, joiningDate, salaryOffered } = req.body;
    if (!companyId || !vesselType || !rank || !joiningDate) {
      return res.status(400).json({ success: false, message: 'companyId, vesselType, rank, and joiningDate are required.' });
    }

    const creator = req.currentUser;

    const requirement = await Requirement.create({
      companyId,
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

const getCandidates = async (req, res, next) => {
  try {
    const { rank, status, search, expectedWagesMax } = req.query;
    const query = {};

    if (rank) query.rank = rank;
    if (status) query.status = status;
    if (expectedWagesMax) query.expectedWages = { $lte: parseFloat(expectedWagesMax) };

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { location: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { contactNumber: { $regex: search, $options: 'i' } }
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

    const candidates = await Candidate.find(query).sort({ createdAt: -1 });
    res.json({ success: true, data: candidates });
  } catch (err) {
    next(err);
  }
};

const createCandidate = async (req, res, next) => {
  try {
    const {
      name, rank, dob, location, cocDetails, passportDetails, cdcDetails,
      lastWages, expectedWages, contactNumber, email, availabilityDate, vesselExperience, remarks
    } = req.body;

    if (!name || !rank || !dob || !location || !cocDetails?.number || !passportDetails?.number || !cdcDetails?.number || !expectedWages || !contactNumber || !email || !availabilityDate) {
      return res.status(400).json({ success: false, message: 'Missing required seafarer fields.' });
    }

    const creator = req.currentUser;
    const isSourcingOfficer = creator.role === ROLES.SOURCING_OFFICER;

    const candidate = await Candidate.create({
      name, rank, dob: new Date(dob), location,
      cocDetails: {
        number: cocDetails.number,
        expiryDate: new Date(cocDetails.expiryDate),
        grade: cocDetails.grade || null,
        country: cocDetails.country || null
      },
      passportDetails: {
        number: passportDetails.number,
        expiryDate: new Date(passportDetails.expiryDate)
      },
      cdcDetails: {
        number: cdcDetails.number,
        expiryDate: new Date(cdcDetails.expiryDate),
        country: cdcDetails.country || null
      },
      lastWages: lastWages ? parseFloat(lastWages) : null,
      expectedWages: parseFloat(expectedWages),
      contactNumber, email,
      availabilityDate: new Date(availabilityDate),
      vesselExperience: vesselExperience || [],
      remarks,
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
        details: { name: candidate.name, rank: candidate.rank }
      });
    }

    res.status(201).json({ success: true, data: candidate });
  } catch (err) {
    next(err);
  }
};

const updateCandidate = async (req, res, next) => {
  try {
    const existing = await Candidate.findById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, message: 'Candidate not found.' });

    // §20 — record-level authorization: a role check alone is not enough.
    // Verify this specific user actually has access to this specific record.
    const allowedToAccess = await canAccessRecord(req.currentUser, existing, 'CANDIDATE');
    if (!allowedToAccess) {
      return res.status(403).json({ success: false, message: 'You do not have access to this candidate record.' });
    }

    const allowedFields = [
      'name', 'rank', 'dob', 'location', 'cocDetails', 'passportDetails', 'cdcDetails',
      'lastWages', 'expectedWages', 'contactNumber', 'email', 'availabilityDate', 'vesselExperience', 'status', 'remarks'
    ];
    const updateData = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    }

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

    if (updateData.dob) updateData.dob = new Date(updateData.dob);
    if (updateData.availabilityDate) updateData.availabilityDate = new Date(updateData.availabilityDate);

    if (updateData.cocDetails) {
      if (updateData.cocDetails.expiryDate) updateData.cocDetails.expiryDate = new Date(updateData.cocDetails.expiryDate);
    }
    if (updateData.passportDetails) {
      if (updateData.passportDetails.expiryDate) updateData.passportDetails.expiryDate = new Date(updateData.passportDetails.expiryDate);
    }
    if (updateData.cdcDetails) {
      if (updateData.cdcDetails.expiryDate) updateData.cdcDetails.expiryDate = new Date(updateData.cdcDetails.expiryDate);
    }

    const candidate = await Candidate.findByIdAndUpdate(req.params.id, updateData, { new: true });
    if (!candidate) return res.status(404).json({ success: false, message: 'Candidate not found.' });

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
    // 3. Vessel Type matching experience exists in candidate's vesselExperience list
    const query = {
      rank: requirement.rank,
      status: { $in: ['AVAILABLE', 'SHORTLISTED'] }
    };

    // Only match against candidates this user is actually allowed to see.
    const scope = await getDataScope(req.currentUser, 'CANDIDATE');
    Object.assign(query, scope);

    const candidates = await Candidate.find(query);

    // Filter by vessel type experience and experience duration if needed
    const matched = candidates.filter(candidate => {
      const experienceEntry = candidate.vesselExperience.find(
        exp => exp.vesselType.toLowerCase() === requirement.vesselType.toLowerCase()
      );
      if (!experienceEntry) return false;
      return experienceEntry.months >= requirement.experienceMonthsRequired;
    });

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
        populate: { path: 'companyId', select: 'name' }
      })
      .populate('rejectionReasonId', 'name');

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

    if (!isValidTransition(candidate.status, 'PROPOSED')) {
      return res.status(400).json({ success: false, message: `Cannot propose a candidate in status ${candidate.status}.` });
    }

    let application = await Application.findOne({ requirementId, candidateId });
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

    res.status(201).json({ success: true, data: application });
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
  getRequirements,
  createRequirement,
  updateRequirement,
  deleteRequirement,
  getCandidates,
  createCandidate,
  updateCandidate,
  reassignCandidate,
  deleteCandidate,
  matchCandidates,
  getApplications,
  proposeCandidate,
  setApplicationDecision
};