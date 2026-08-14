/**
 * jobApplications.routes.js
 * ------------------------------------------------------------------
 * Express routes for the "Job Call" recruitment feature.
 *
 * Mount this in your main server file, e.g.:
 *   const jobApplicationsRoutes = require('./routes/jobApplications.routes');
 *   app.use('/api/recruitment/job-applications', jobApplicationsRoutes);
 *
 * The public form (job-application.html) posts to:
 *   POST /api/recruitment/job-applications
 * — this route does NOT require authentication, since walk-in
 * visitors and the public form submit to it directly. All other
 * routes (list / view / update status) are meant to sit behind
 * your existing auth middleware — see the commented-out line below.
 *
 * Requires: npm install multer
 * ------------------------------------------------------------------
 */

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');

const JobApplication = require('../models/JobApplication.model');

/** Helper to find job application by MongoDB _id OR applicationId string */
async function findApplication(idParam) {
    if (mongoose.Types.ObjectId.isValid(idParam)) {
        const doc = await JobApplication.findById(idParam);
        if (doc) return doc;
    }
    return await JobApplication.findOne({ applicationId: idParam });
}
// const { requireAuth } = require('../middleware/auth'); // <- your existing auth middleware

const router = express.Router();

/* ============================================================
   FILE STORAGE
   Files are saved to disk under UPLOAD_ROOT, organized by
   year/month. Only the relative path is stored in MongoDB —
   this keeps documents small and lets you swap in S3 / GCS
   later without changing the schema (just change how files are
   written and how `path` is resolved to a URL).
============================================================ */
const UPLOAD_ROOT = path.join(__dirname, '..', 'uploads', 'job-applications');

function ensureDir(dir) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const now = new Date();
        const subDir = path.join(UPLOAD_ROOT, String(now.getFullYear()), String(now.getMonth() + 1).padStart(2, '0'));
        ensureDir(subDir);
        cb(null, subDir);
    },
    filename: function (req, file, cb) {
        const safeOriginal = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_');
        const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, `${unique}-${safeOriginal}`);
    },
});

const DOC_TYPES = ['.pdf', '.doc', '.docx'];
const IMG_TYPES = ['.jpg', '.jpeg', '.png'];

function fileFilter(req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    if (file.fieldname === 'photo') {
        if (!IMG_TYPES.includes(ext)) return cb(new Error('Photo must be a JPG or PNG file.'));
    } else {
        // resume, passportCopy, cdcCopy, certificatesFile
        if (![...DOC_TYPES, ...IMG_TYPES].includes(ext)) {
            return cb(new Error('Files must be PDF, DOC, DOCX, JPG or PNG.'));
        }
    }
    cb(null, true);
}

const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: 5 * 1024 * 1024, files: 5 }, // 5MB per file
});

const uploadFields = upload.fields([
    { name: 'resume', maxCount: 1 },
    { name: 'photo', maxCount: 1 },
    { name: 'passportCopy', maxCount: 1 },
    { name: 'cdcCopy', maxCount: 1 },
    { name: 'certificatesFile', maxCount: 1 },
]);

/** Turns a multer file object into the shape stored on the document. */
function toStoredFile(file) {
    if (!file) return undefined;
    return {
        originalName: file.originalname,
        storedFileName: file.filename,
        path: path.relative(path.join(__dirname, '..', 'uploads'), file.path).split(path.sep).join('/'),
        mimeType: file.mimetype,
        sizeBytes: file.size,
    };
}

/** Reads a field that may arrive as a single string or an array (repeated form fields). */
function toArray(value) {
    if (value === undefined || value === null || value === '') return [];
    return Array.isArray(value) ? value : [value];
}

/* ============================================================
   POST /  — submit a new job application (public, no auth)
============================================================ */
router.post('/', uploadFields, async (req, res) => {
    try {
        const b = req.body;

        // Honeypot check (belt-and-braces — the frontend already strips this field,
        // but a direct API call could still fill it in).
        if (b.companyWebsite && String(b.companyWebsite).trim() !== '') {
            return res.status(400).json({ message: 'Submission rejected.' });
        }

        const files = req.files || {};
        if (!files.resume || !files.resume[0]) {
            return res.status(400).json({ message: 'A resume/CV file is required.' });
        }

        const doc = new JobApplication({
            fullName: b.fullName,
            dob: b.dob,
            gender: b.gender,
            nationality: b.nationality,
            maritalStatus: b.maritalStatus,
            mobileNumber: b.mobileNumber,
            isWhatsapp: b.isWhatsapp === 'on' || b.isWhatsapp === 'true',
            altNumber: b.altNumber,
            email: b.email,
            currentAddress: b.currentAddress,
            emergencyContact: {
                name: b.emergencyContactName,
                relation: b.emergencyContactRelation,
                number: b.emergencyContactNumber,
            },

            passportNumber: b.passportNumber,
            passportIssuePlace: b.passportIssuePlace,
            passportIssueDate: b.passportIssueDate || undefined,
            passportExpiryDate: b.passportExpiryDate,
            cdcNumber: b.cdcNumber,
            cdcIssueDate: b.cdcIssueDate || undefined,
            cdcExpiryDate: b.cdcExpiryDate || undefined,
            indosNumber: b.indosNumber,
            usVisaStatus: b.usVisaStatus,
            usVisaExpiry: b.usVisaExpiry || undefined,

            department: b.department,
            rankAppliedFor: b.rankAppliedFor,
            currentRank: b.currentRank,
            engineTypeExperience: b.engineTypeExperience,
            totalSeaExperience: { years: Number(b.totalSeaExpYears) || 0, months: Number(b.totalSeaExpMonths) || 0 },
            rankExperience: { years: Number(b.rankExpYears) || 0, months: Number(b.rankExpMonths) || 0 },
            preferredVesselTypes: toArray(b.preferredVesselTypes),
            lastVesselName: b.lastVesselName,
            lastVesselType: b.lastVesselType,
            lastCompany: b.lastCompany,
            lastSignOffDate: b.lastSignOffDate || undefined,
            signOffReason: b.signOffReason,

            coc: {
                class: b.cocClass,
                number: b.cocNumber,
                issuingAuthority: b.cocIssuingAuthority,
                expiryDate: b.cocExpiryDate || undefined,
            },
            coe: { number: b.coeNumber, expiryDate: b.coeExpiryDate || undefined },
            certificatesHeld: toArray(b.certificatesHeld),
            otherCertificates: b.otherCertificates,

            medicalCertStatus: b.medicalCertStatus,
            medicalCertExpiry: b.medicalCertExpiry || undefined,
            currentStatus: b.currentStatus,
            availableFromDate: b.availableFromDate || undefined,
            preferredJoiningDate: b.preferredJoiningDate || undefined,
            expectedSalary: b.expectedSalary,
            referralSource: b.referralSource,
            referralOther: b.referralOther,

            resume: toStoredFile(files.resume && files.resume[0]),
            photo: toStoredFile(files.photo && files.photo[0]),
            passportCopy: toStoredFile(files.passportCopy && files.passportCopy[0]),
            cdcCopy: toStoredFile(files.cdcCopy && files.cdcCopy[0]),
            certificatesFile: toStoredFile(files.certificatesFile && files.certificatesFile[0]),

            declarationConsent: b.declarationConsent === 'on' || b.declarationConsent === 'true',
        });

        await doc.save();

        return res.status(201).json({
            message: 'Application submitted successfully.',
            applicationId: doc.applicationId,
            id: doc._id,
        });
    } catch (err) {
        console.error('Error creating job application:', err);
        if (err.name === 'ValidationError') {
            return res.status(400).json({ message: err.message });
        }
        return res.status(500).json({ message: 'Something went wrong while submitting your application.' });
    }
});

/* ============================================================
   The routes below are for your Reception / CRM staff and should
   sit behind your existing auth middleware, e.g.:
     router.use(requireAuth);
   placed just above this comment block.
============================================================ */

/** GET / — list applications (filters: status, department, rank, search, page, limit) */
router.get('/', async (req, res) => {
    try {
        const { status, department, rank, search, page = 1, limit = 20 } = req.query;
        const query = {};
        if (status) query.status = status;
        if (department) query.department = department;
        if (rank) query.rankAppliedFor = rank;
        if (search) query.$text = { $search: search };

        const skip = (Number(page) - 1) * Number(limit);
        const [items, total] = await Promise.all([
            JobApplication.find(query).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
            JobApplication.countDocuments(query),
        ]);

        return res.json({ data: items, total, page: Number(page), limit: Number(limit) });
    } catch (err) {
        console.error('Error listing job applications:', err);
        return res.status(500).json({ message: 'Failed to load applications.' });
    }
});

/** GET /stats/summary — quick counts for the Reception "Job Call" tab stat cards */
router.get('/stats/summary', async (req, res) => {
    try {
        const [total, byStatus] = await Promise.all([
            JobApplication.countDocuments({}),
            JobApplication.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
        ]);
        const statusMap = {};
        byStatus.forEach((s) => { statusMap[s._id] = s.count; });
        return res.json({ total, byStatus: statusMap });
    } catch (err) {
        console.error('Error loading job application stats:', err);
        return res.status(500).json({ message: 'Failed to load stats.' });
    }
});

/** GET /:id — single application detail */
router.get('/:id', async (req, res) => {
    try {
        const doc = await findApplication(req.params.id);
        if (!doc) return res.status(404).json({ message: 'Application not found.' });
        return res.json({ data: doc });
    } catch (err) {
        console.error('Error fetching job application:', err);
        return res.status(500).json({ message: 'Failed to load application.' });
    }
});

/** PATCH /:id/status — update review status */
router.patch('/:id/status', async (req, res) => {
    try {
        const { status, internalNotes } = req.body;
        const allowed = ['NEW', 'REVIEWED', 'SHORTLISTED', 'INTERVIEW_SCHEDULED', 'REJECTED', 'HIRED'];
        if (!allowed.includes(status)) {
            return res.status(400).json({ message: 'Invalid status value.' });
        }
        const doc = await findApplication(req.params.id);
        if (!doc) return res.status(404).json({ message: 'Application not found.' });

        doc.status = status;
        doc.reviewedAt = new Date();
        if (internalNotes !== undefined) doc.internalNotes = internalNotes;
        if (req.user && req.user._id) doc.reviewedBy = req.user._id;

        await doc.save();
        return res.json({ data: doc });
    } catch (err) {
        console.error('Error updating job application status:', err);
        return res.status(500).json({ message: 'Failed to update status.' });
    }
});

/** GET /:id/files/:field — securely stream an uploaded file (resume, photo, etc.) */
router.get('/:id/files/:field', async (req, res) => {
    try {
        const allowedFields = ['resume', 'photo', 'passportCopy', 'cdcCopy', 'certificatesFile'];
        if (!allowedFields.includes(req.params.field)) {
            return res.status(400).json({ message: 'Invalid file field.' });
        }
        const doc = await findApplication(req.params.id);
        if (!doc || !doc[req.params.field] || !doc[req.params.field].path) {
            return res.status(404).json({ message: 'File not found.' });
        }
        const absPath = path.join(__dirname, '..', 'uploads', doc[req.params.field].path);
        if (!fs.existsSync(absPath)) return res.status(404).json({ message: 'File not found on disk.' });
        return res.download(absPath, doc[req.params.field].originalName);
    } catch (err) {
        console.error('Error streaming job application file:', err);
        return res.status(500).json({ message: 'Failed to load file.' });
    }
});

/* ============================================================
   Multer error handler — catches file-too-large / bad file type
   errors and returns a clean JSON response instead of a stack trace.
============================================================ */
router.use((err, req, res, next) => {
    if (err instanceof multer.MulterError || err) {
        return res.status(400).json({ message: err.message || 'File upload error.' });
    }
    next();
});

module.exports = router;