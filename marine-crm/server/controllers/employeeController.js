const { Employee } = require('../models');
const { logActivity } = require('../utils/activityLogger');

const listEmployees = async (req, res, next) => {
  try {
    const employees = await Employee.find().sort({ createdAt: -1 });
    res.json({ success: true, data: employees });
  } catch (err) {
    next(err);
  }
};

const createEmployee = async (req, res, next) => {
  try {
    const { name, employeeId, phone, email, location, position, joinDate } = req.body;

    if (!name || !phone) {
      return res.status(400).json({ success: false, message: 'Name and phone are required.' });
    }

    const employee = await Employee.create({
      name: name.trim(),
      employeeId: employeeId ? employeeId.trim() : null,
      phone: phone.trim(),
      email: email ? email.toLowerCase().trim() : null,
      location: location ? location.trim() : null,
      position: position ? position.trim() : null,
      joinDate: joinDate ? new Date(joinDate) : null,
      createdById: req.user.id,
      createdByName: req.user.name,
    });

    await logActivity({
      userId: req.user.id,
      entityType: 'EMPLOYEE',
      entityId: employee._id.toString(),
      action: 'CREATED',
      details: { name: employee.name, createdByRole: req.user.role },
    });

    res.status(201).json({ success: true, data: employee, message: 'Employee created successfully.' });
  } catch (err) {
    next(err);
  }
};

const updateEmployee = async (req, res, next) => {
  try {
    const employee = await Employee.findById(req.params.id);
    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found.' });
    }

    const { name, employeeId, phone, email, location, position, joinDate } = req.body;
    if (name)                   employee.name       = name.trim();
    if (phone)                  employee.phone      = phone.trim();
    if (employeeId !== undefined) employee.employeeId = employeeId ? employeeId.trim() : null;
    if (email      !== undefined) employee.email      = email ? email.toLowerCase().trim() : null;
    if (location   !== undefined) employee.location   = location ? location.trim() : null;
    if (position   !== undefined) employee.position   = position ? position.trim() : null;
    if (joinDate   !== undefined) employee.joinDate   = joinDate ? new Date(joinDate) : null;

    await employee.save();

    await logActivity({
      userId:     req.user.id,
      entityType: 'EMPLOYEE',
      entityId:   employee._id.toString(),
      action:     'UPDATED',
      details:    { name: employee.name, updatedByRole: req.user.role },
    });

    res.json({ success: true, data: employee, message: 'Employee updated successfully.' });
  } catch (err) {
    next(err);
  }
};

const deleteEmployee = async (req, res, next) => {
  try {
    const employee = await Employee.findById(req.params.id);
    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found.' });
    }

    await employee.deleteOne();

    await logActivity({
      userId: req.user.id,
      entityType: 'EMPLOYEE',
      entityId: req.params.id,
      action: 'DELETED',
      details: { deletedByRole: req.user.role },
    });

    res.json({ success: true, message: 'Employee deleted successfully.' });
  } catch (err) {
    next(err);
  }
};

module.exports = { listEmployees, createEmployee, updateEmployee, deleteEmployee };
