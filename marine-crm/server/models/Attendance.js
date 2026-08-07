const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  employeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee'
  },
  date: {
    type: String
  },
  checkIn: Date,
  checkOut: Date
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