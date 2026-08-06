const bcrypt = require('bcryptjs');
const { User } = require('../models');
const { signToken } = require('../config/jwt');
const { logActivity } = require('../utils/activityLogger');

/**
 * Login: validate credentials, update lastLoginAt in MongoDB, return JWT & user profile
 * POST /api/auth/login
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    const cleanEmail = email.toLowerCase().trim();

    // Fetch user from MongoDB
    const user = await User.findOne({ email: cleanEmail });

    if (!user || !user.isActive) {
      return res.status(401).json({ success: false, message: 'Invalid credentials or inactive account.' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    // Update lastLoginAt in MongoDB
    const now = new Date();
    user.lastLoginAt = now;
    await user.save();

    const token = signToken({ id: user._id.toString(), email: user.email, role: user.role, name: user.name });

    await logActivity({
      userId: user._id,
      entityType: 'USER',
      entityId: user._id.toString(),
      action: 'LOGGED_IN',
      details: { email: user.email, role: user.role, loginTime: now },
    });

    const userProfile = {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone,
      department: user.department,
      avatarUrl: user.avatarUrl,
      lastLoginAt: now,
      createdAt: user.createdAt,
    };

    res.json({
      success: true,
      message: 'Login successful.',
      data: {
        token,
        user: userProfile,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Logout: stateless JWT — client discards token
 * POST /api/auth/logout
 */
const logout = (req, res) => {
  res.json({ success: true, message: 'Logged out successfully.' });
};

/**
 * Get current logged-in user profile from MongoDB
 * GET /api/auth/me
 */
const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select('-passwordHash');
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
};

/**
 * Register (Sign Up): Save full user profile in MongoDB and return JWT
 * POST /api/auth/register
 */
const register = async (req, res, next) => {
  try {
    const { name, email, password, role, phone, department } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, email, and password are required.' });
    }

    const cleanEmail = email.toLowerCase().trim();

    // Check if user already exists in MongoDB
    const existing = await User.findOne({ email: cleanEmail });

    if (existing) {
      return res.status(400).json({ success: false, message: 'An account with this email already exists.' });
    }

    // Hash password securely with bcrypt
    const passwordHash = await bcrypt.hash(password, 12);
    const now = new Date();

    // Save user record to MongoDB
    const user = await User.create({
      name: name.trim(),
      email: cleanEmail,
      passwordHash,
      role: role && ['ADMIN', 'BDM', 'MANAGER', 'HR'].includes(role) ? role : 'BDM',
      phone: phone ? phone.trim() : null,
      department: department ? department.trim() : null,
      isActive: true,
      lastLoginAt: now,
    });

    const token = signToken({ id: user._id.toString(), email: user.email, role: user.role, name: user.name });

    await logActivity({
      userId: user._id,
      entityType: 'USER',
      entityId: user._id.toString(),
      action: 'REGISTERED_USER',
      details: { name: user.name, email: user.email, role: user.role },
    });

    const userObj = user.toJSON();

    res.status(201).json({
      success: true,
      message: 'Account created successfully!',
      data: {
        token,
        user: userObj,
      },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { login, register, logout, getMe };
