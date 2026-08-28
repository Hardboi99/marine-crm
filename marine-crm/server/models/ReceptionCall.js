const mongoose = require('mongoose');

const docIntakeSchema = new mongoose.Schema(
    {
        candidateId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Candidate',
            default: null
        },

        employeeId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Employee',
            default: null
        },

        seafarerName: {
            type: String,
            required: true,
            trim: true
        },

        documentType: {
            type: [String],
            required: true,
            validate: {
                validator: function (value) {
                    return Array.isArray(value) && value.length > 0;
                },
                message: 'At least one document type is required.'
            }
        },

        documentNumber: {
            type: String,
            trim: true,
            default: ''
        },

        custodyLocation: {
            type: String,
            trim: true,
            default: ''
        },

        remarks: {
            type: String,
            trim: true,
            default: ''
        },

        status: {
            type: String,
            enum: [
                'WITH_AGENCY',
                'RETURNED_TO_SEAFARER',
                'SENT_TO_VESSEL_OWNER'
            ],
            default: 'WITH_AGENCY'
        },

        createdById: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        }
    },
    { timestamps: true }
);

docIntakeSchema.set('toJSON', {
    virtuals: true,
    transform: (doc, ret) => {
        ret.id = ret._id.toString();
        delete ret.__v;
        return ret;
    }
});

docIntakeSchema.set('toObject', {
    virtuals: true,
    transform: (doc, ret) => {
        ret.id = ret._id.toString();
        delete ret.__v;
        return ret;
    }
});

module.exports = mongoose.model('ReceptionCall', docIntakeSchema);