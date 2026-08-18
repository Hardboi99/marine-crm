const mongoose = require('mongoose');

// A single captured GPS point — used for both checkInLocation and
// checkOutLocation below. Captured once at the moment of the action only
// (no continuous/background tracking anywhere in this app).
const locationPointSchema = new mongoose.Schema(
  {
    latitude: { type: Number, required: true, min: -90, max: 90 },
    longitude: { type: Number, required: true, min: -180, max: 180 },
    address: { type: String, trim: true, default: null }, // reverse-geocoded, best-effort
    capturedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const attendanceSchema = new mongoose.Schema({
  employeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee'
  },
  date: {
    type: String
  },
  checkIn: Date,
  checkOut: Date,
  checkInLocation: { type: locationPointSchema, default: null },
  checkOutLocation: { type: locationPointSchema, default: null }
}, { timestamps: true });

// Ensure employeeId is always serialized as a plain string
attendanceSchema.set('toJSON', {
  transform: (doc, ret) => {
    ret.id = ret._id ? ret._id.toString() : undefined;
    if (ret.employeeId) ret.employeeId = ret.employeeId.toString();
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('Attendance', attendanceSchema);
    