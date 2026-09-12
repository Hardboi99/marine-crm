/**
 * JobApplication.model.js
 * ------------------------------------------------------------------
 * Mongoose schema for the "Job Call" recruitment feature.
 * Stores walk-in / online seafarer job applications submitted via
 * job-application.html, so they can be reviewed from the Reception
 * Desk → "Job Call" tab.
 *
 * Drop this file into your existing `models/` folder and require it
 * wherever you need it, e.g.:
 *   const JobApplication = require('../models/JobApplication.model');
 * ------------------------------------------------------------------
 */

const mongoose = require('mongoose');
const { Schema } = mongoose;
const { getNextSequence } = require('./Counter.model');

/** Counter name used for the Job Application ID sequence. */
const APPLICATION_ID_COUNTER = 'jobApplicationId';

/**
 * Generates the next Application ID: a plain, sequential, zero-padded
 * 5-digit number — 00001, 00002, 00003, ... — with no prefix, date,
 * letters, or special characters. The sequence is stored in the
 * `Counter` collection so it survives restarts and stays unique even
 * under concurrent submissions.
 */
async function generateApplicationId() {
    const next = await getNextSequence(APPLICATION_ID_COUNTER);
    return String(next).padStart(5, '0');
}

/** Sub-schema for an uploaded file's metadata (resume, passport copy, etc.) */
const UploadedFileSchema = new Schema(
    {
        originalName: { type: String },
        storedFileName: { type: String },
        // path relative to your uploads root, e.g. "job-applications/2026/08/resume.pdf"
        path: { type: String },
        mimeType: { type: String },
        sizeBytes: { type: Number },
    },
    { _id: false }
);

const JobApplicationSchema = new Schema(
    {
        // ---- system fields ----
        applicationId: {
            type: String,
            unique: true,
            index: true,
            immutable: true, // once assigned, never changes on later updates
            match: /^\d{5}$/, // exactly 5 numeric digits, e.g. 00001 — no prefixes/letters/dates
        },
        status: {
            type: String,
            enum: ['NEW', 'REVIEWED', 'SHORTLISTED', 'INTERVIEW_SCHEDULED', 'REJECTED', 'HIRED'],
            default: 'NEW',
            index: true,
        },
        source: { type: String, default: 'PUBLIC_FORM' }, // PUBLIC_FORM | RECEPTION_KIOSK | MANUAL_ENTRY
        reviewedBy: { type: Schema.Types.ObjectId, ref: 'Employee' },
        reviewedAt: { type: Date },
        internalNotes: { type: String },

        // ---- personal & contact ----
        fullName: { type: String, required: true, trim: true },
        dob: { type: Date, required: true },
        gender: { type: String },
        nationality: { type: String, required: true },
        maritalStatus: { type: String },
        mobileNumber: { type: String, required: true },
        isWhatsapp: { type: Boolean, default: false },
        altNumber: { type: String },
        email: { type: String, required: true, lowercase: true, trim: true },
        currentAddress: { type: String, required: true },
        emergencyContact: {
            name: { type: String },
            relation: { type: String },
            number: { type: String },
        },

        // ---- identity & travel documents ----
        passportNumber: { type: String,  },
        passportIssuePlace: { type: String },
        passportIssueDate: { type: Date },
        passportExpiryDate: { type: Date,  },
        cdcNumber: { type: String },
        cdcIssueDate: { type: Date },
        cdcExpiryDate: { type: Date },
        indosNumber: { type: String },
        usVisaStatus: { type: String },
        usVisaExpiry: { type: Date },

        // ---- rank & sailing experience ----
        department: { type: String, required: true },
        rankAppliedFor: { type: String, required: true },
        currentRank: { type: String },
        engineTypeExperience: { type: String },
        totalSeaExperience: {
            years: { type: Number, default: 0 },
            months: { type: Number, default: 0 },
        },
        rankExperience: {
            years: { type: Number, default: 0 },
            months: { type: Number, default: 0 },
        },
        preferredVesselTypes: [{ type: String }],
        lastVesselName: { type: String },
        lastVesselType: { type: String },
        lastCompany: { type: String },
        lastSignOffDate: { type: Date },
        signOffReason: { type: String },

        // ---- certificates & endorsements ----
        cocNumber: { type: String, required: true, trim: true, uppercase: true, index: true },
        coc: {
            class: { type: String },
            number: { type: String },
            issuingAuthority: { type: String },
            expiryDate: { type: Date },
        },
        coe: {
            number: { type: String },
            expiryDate: { type: Date },
        },
        certificatesHeld: [{ type: String }],
        otherCertificates: { type: String },

        // ---- medical & availability ----
        medicalCertStatus: { type: String, required: true },
        medicalCertExpiry: { type: Date },
        currentStatus: { type: String, required: true },
        availableFromDate: { type: Date },
        preferredJoiningDate: { type: Date },
        expectedSalary: { type: String },
        referralSource: { type: String, required: true },
        referralOther: { type: String },

        // ---- uploaded documents ----
        resume: { type: UploadedFileSchema, required: true },
        photo: { type: UploadedFileSchema },
        passportCopy: { type: UploadedFileSchema },
        cdcCopy: { type: UploadedFileSchema },
        certificatesFile: { type: UploadedFileSchema },

        // ---- consent ----
        declarationConsent: { type: Boolean, required: true },
        declarationAcceptedAt: { type: Date, default: Date.now },
    },
    { timestamps: true }
);

JobApplicationSchema.pre('validate', async function (next) {
    if (this.isNew && !this.applicationId) {
        try {
            this.applicationId = await generateApplicationId();
        } catch (err) {
            return next(err);
        }
    }
    next();
});

JobApplicationSchema.index({ fullName: 'text', rankAppliedFor: 'text', lastCompany: 'text', cocNumber: 'text' });
JobApplicationSchema.index({ createdAt: -1 });

module.exports = mongoose.models.JobApplication || mongoose.model('JobApplication', JobApplicationSchema);