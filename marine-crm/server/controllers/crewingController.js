const { Candidate, Requirement, Application, Onboarding, Reason, Company } = require('../models');
const { logActivity } = require('../utils/activityLogger');

// ─── REQUIREMENTS CRUD ──────────────────────────────────────────

const getRequirements = async (req, res, next) => {
  try {
    const { companyId, vesselType, rank, status } = req.query;
    const query = {};

    if (companyId) query.companyId = companyId;
    if (vesselType) query.vesselType = vesselType;
    if (rank) query.rank = rank;
    if (status) query.status = status;

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

    const requirement = await Requirement.create({
      companyId,
      vesselType,
      rank,
      experienceMonthsRequired: experienceMonthsRequired ? parseInt(experienceMonthsRequired) : 0,
      joiningDate: new Date(joiningDate),
      salaryOffered: salaryOffered ? parseFloat(salaryOffered) : null,
      createdById: req.user.id
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
    const allowed = ['vesselType', 'rank', 'experienceMonthsRequired', 'joiningDate', 'salaryOffered', 'status'];
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
    const requirement = await Requirement.findByIdAndDelete(req.params.id);
    if (!requirement) return res.status(404).json({ success: false, message: 'Requirement not found.' });
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
      createdById: req.user.id
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
    const candidate = await Candidate.findByIdAndDelete(req.params.id);
    if (!candidate) return res.status(404).json({ success: false, message: 'Candidate not found.' });
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

    // Matching criteria:
    // 1. Rank matches
    // 2. Status is AVAILABLE or SHORTLISTED (not proposed/onboarded)
    // 3. Vessel Type matching experience exists in candidate's vesselExperience list
    const query = {
      rank: requirement.rank,
      status: { $in: ['AVAILABLE', 'SHORTLISTED'] }
    };

    const candidates = await Candidate.find(query);

    // Filter by vessel type experience and experience duration if needed
    const matched = candidates.filter(candidate => {
      // Find matches in vesselExperience array
      const experienceEntry = candidate.vesselExperience.find(
        exp => exp.vesselType.toLowerCase() === requirement.vesselType.toLowerCase()
      );
      if (!experienceEntry) return false;

      // Ensure total months of experience on this vessel matches requirement (if specified)
      // requirement.experienceMonthsRequired is compared to experienceEntry.months
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

    // Check if candidate is available
    const candidate = await Candidate.findById(candidateId);
    if (!candidate) return res.status(404).json({ success: false, message: 'Candidate not found.' });

    const requirement = await Requirement.findById(requirementId);
    if (!requirement) return res.status(404).json({ success: false, message: 'Requirement not found.' });

    // Check if proposal already exists
    let application = await Application.findOne({ requirementId, candidateId });
    if (application) {
      application.status = 'PROPOSED';
      await application.save();
    } else {
      application = await Application.create({
        requirementId,
        candidateId,
        status: 'PROPOSED',
        createdById: req.user.id
      });
    }

    // Update candidate status to PROPOSED
    candidate.status = 'PROPOSED';
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

    application.status = status;
    const candidate = await Candidate.findById(application.candidateId._id);

    if (status === 'CLIENT_ACCEPTED') {
      application.rejectionReasonId = null;
      application.rejectionNotes = null;

      // Update candidate status to APPROVED
      if (candidate) {
        candidate.status = 'APPROVED';
        await candidate.save();
      }

      // Automatically initialize Onboarding checklist record
      const onboardingExists = await Onboarding.findOne({
        candidateId: application.candidateId._id,
        requirementId: application.requirementId._id
      });

      if (!onboardingExists) {
        await Onboarding.create({
          candidateId: application.candidateId._id,
          requirementId: application.requirementId._id,
          status: 'PENDING',
          updatedById: req.user.id
        });
      }
    } else {
      // CLIENT_REJECTED
      if (!rejectionReasonId) {
        return res.status(400).json({ success: false, message: 'rejectionReasonId is required for rejections.' });
      }
      application.rejectionReasonId = rejectionReasonId;
      application.rejectionNotes = rejectionNotes || null;

      // Candidate is returned to the Talent Pool (AVAILABLE status)
      if (candidate) {
        candidate.status = 'REJECTED_TALENT_POOL';
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

module.exports = {
  getRequirements,
  createRequirement,
  updateRequirement,
  deleteRequirement,
  getCandidates,
  createCandidate,
  updateCandidate,
  deleteCandidate,
  matchCandidates,
  getApplications,
  proposeCandidate,
  setApplicationDecision
};
