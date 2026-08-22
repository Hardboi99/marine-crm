const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const { User } = require('../models');
const { signToken } = require('../config/jwt');
const { logActivity } = require('../utils/activityLogger');
const { generateVerificationToken, hashToken, sendVerificationEmail } = require('../services/emailService');

// ─── Helpers ────────────────────────────────────────────────────────────────
const getBaseUrl = (req) => `${req.protocol}://${req.get('host')}`;

/**
 * Login: validate credentials, enforce email-verification gate, return JWT.
 * Migration guard: users with emailVerified === undefined are legacy accounts
 * that pre-date this feature and are treated as verified (never blocked).
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

    // ── Email-verification gate ──────────────────────────────────────────────
    // Only block when emailVerified is explicitly false (newly-created accounts).
    // undefined = legacy/seeded user → let them through unchanged.
    if (user.emailVerified === false) {
      return res.status(403).json({
        success: false,
        message: 'Please verify your email before logging in.',
        requiresVerification: true,
      });
    }

    user.lastLoginAt = new Date();
    await user.save();

    const token = signToken({ id: user._id.toString(), email: user.email, role: user.role, name: user.name });

    await logActivity({
      userId: user._id,
      entityType: 'USER',
      entityId: user._id.toString(),
      action: 'LOGGED_IN',
      details: { email: user.email, role: user.role, loginTime: user.lastLoginAt },
    });

    res.json({
      success: true,
      message: 'Login successful.',
      data: {
        token,
        user: {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          role: user.role,
          phone: user.phone,
          department: user.department,
          avatarUrl: user.avatarUrl,
          lastLoginAt: user.lastLoginAt,
          createdAt: user.createdAt,
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Logout: stateless JWT — client discards token.
 * POST /api/auth/logout
 */
const logout = (req, res) => {
  res.json({ success: true, message: 'Logged out successfully.' });
};

/**
 * Get current logged-in user profile from MongoDB.
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
 * Update the logged-in user's own account fields (name, phone, department).
 * Deliberately does NOT accept role/email/isActive — those stay admin-only.
 * PATCH /api/auth/me
 */
const updateMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    const { name, phone, department } = req.body;
    if (name !== undefined && name !== null && String(name).trim()) user.name = String(name).trim();
    if (phone !== undefined) user.phone = phone ? String(phone).trim() : null;
    if (department !== undefined) user.department = department ? String(department).trim() : null;

    await user.save();
    await logActivity({
      userId: user.id,
      userName: user.name,
      action: 'PROFILE_UPDATED',
      details: 'Updated own profile details.',
    }).catch(() => {});

    res.json({ success: true, data: user, message: 'Profile updated successfully.' });
  } catch (err) {
    next(err);
  }
};

/**
 * Upload/replace the logged-in user's profile photo.
 * Stores the file via the existing multer uploads pipeline, saves the
 * public URL on User.avatarUrl, and removes the previous photo (if it
 * was a locally-stored file) so uploads/ doesn't accumulate orphans.
 * POST /api/auth/me/avatar  (multipart/form-data, field name: "avatar")
 */
const uploadAvatar = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No image file was uploaded.' });
    }
    if (!req.file.mimetype.startsWith('image/')) {
      fs.unlink(req.file.path, () => {});
      return res.status(400).json({ success: false, message: 'Profile photo must be an image (JPEG, PNG, or WEBP).' });
    }
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    const previousUrl = user.avatarUrl;
    user.avatarUrl = `/uploads/${req.file.filename}`;
    await user.save();

    // Best-effort cleanup of the old locally-stored avatar file.
    if (previousUrl && previousUrl.startsWith('/uploads/')) {
      const oldPath = path.join(__dirname, '..', 'uploads', path.basename(previousUrl));
      fs.unlink(oldPath, () => {});
    }

    res.json({ success: true, data: user, message: 'Profile photo updated.' });
  } catch (err) {
    next(err);
  }
};

/**
 * Remove the logged-in user's profile photo, reverting to initials avatar.
 * DELETE /api/auth/me/avatar
 */
const removeAvatar = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    const previousUrl = user.avatarUrl;
    user.avatarUrl = null;
    await user.save();

    if (previousUrl && previousUrl.startsWith('/uploads/')) {
      const oldPath = path.join(__dirname, '..', 'uploads', path.basename(previousUrl));
      fs.unlink(oldPath, () => {});
    }

    res.json({ success: true, data: user, message: 'Profile photo removed.' });
  } catch (err) {
    next(err);
  }
};

/**
 * Register: DISABLED — accounts are created only by Admin/HR via the employee portal.
 * POST /api/auth/register
 */
const register = async (req, res) => {
  return res.status(403).json({
    success: false,
    message: 'Public account creation is disabled. Please contact your Admin or HR team to get access.',
  });
};

/**
 * Verify email address via signed token link.
 * GET /api/auth/verify-email?token=<RAW_TOKEN>
 */
const verifyEmail = async (req, res, next) => {
  try {
    const { token: rawToken } = req.query;

    if (!rawToken) {
      return res.status(400).json({ success: false, message: 'Verification token is required.' });
    }

    const hashed = hashToken(rawToken);

    // Check for expired token first (better error message)
    const anyMatch = await User.findOne({ verificationToken: hashed });
    if (anyMatch) {
      if (anyMatch.emailVerified === true) {
        return res.json({ success: true, message: 'Email is already verified. You can log in.', alreadyVerified: true });
      }
      if (anyMatch.verificationTokenExpires < new Date()) {
        return res.status(400).json({
          success: false,
          message: 'Verification link has expired. Please request a new one.',
          expired: true,
        });
      }
    }

    const user = await User.findOne({
      verificationToken: hashed,
      verificationTokenExpires: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).json({ success: false, message: 'Invalid verification link.' });
    }

    user.emailVerified = true;
    user.verificationToken = null;
    user.verificationTokenExpires = null;
    user.verificationSentAt = null;
    await user.save();

    await logActivity({
      userId: user._id,
      entityType: 'USER',
      entityId: user._id.toString(),
      action: 'EMAIL_VERIFIED',
      details: { email: user.email },
    });

    res.json({ success: true, message: 'Email verified successfully! You can now log in.' });
  } catch (err) {
    next(err);
  }
};

/**
 * Resend verification email.
 * POST /api/auth/resend-verification  body: { email }
 * Rate-limited to 1 send per 60 seconds. Always returns 200 to prevent user enumeration.
 */
const resendVerification = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required.' });
    }

    // Generic OK prevents user enumeration
    const genericOk = () =>
      res.json({ success: true, message: 'If this email exists and is unverified, a new link has been sent.' });

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user || user.emailVerified !== false) return genericOk();

    // 60-second resend rate limit
    if (user.verificationSentAt) {
      const elapsedSec = (Date.now() - new Date(user.verificationSentAt).getTime()) / 1000;
      if (elapsedSec < 60) {
        return res.status(429).json({
          success: false,
          message: `Please wait ${Math.ceil(60 - elapsedSec)} seconds before requesting another link.`,
        });
      }
    }

    const { rawToken, hashedToken } = generateVerificationToken();
    user.verificationToken = hashedToken;
    user.verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    user.verificationSentAt = new Date();
    await user.save();

    await sendVerificationEmail(user, rawToken, getBaseUrl(req));

    return genericOk();
  } catch (err) {
    next(err);
  }
};

module.exports = { login, register, logout, getMe, updateMe, uploadAvatar, removeAvatar, verifyEmail, resendVerification };


