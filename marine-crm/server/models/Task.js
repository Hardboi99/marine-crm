const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: '' },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    assignedByName: { type: String, trim: true },
    priority: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'], default: 'MEDIUM' },
    status: { type: String, enum: ['PENDING', 'IN_PROGRESS', 'COMPLETED'], default: 'PENDING' },
    dueDate: { type: Date, default: null },
    completedAt: { type: Date, default: null }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Task', taskSchema);
