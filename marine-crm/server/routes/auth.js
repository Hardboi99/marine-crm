const express = require('express');
const router = express.Router();
const {
  login, register, logout, getMe, updateMe, uploadAvatar, removeAvatar,
  verifyEmail, resendVerification,
} = require('../controllers/authController');
const { authenticate } = require('../middlewares/auth');
const { upload } = require('../middlewares/upload');

router.post('/login', login);
router.post('/register', register);                                // Always returns 403 (disabled)
router.post('/logout', authenticate, logout);
router.get('/me', authenticate, getMe);
router.patch('/me', authenticate, updateMe);
router.post('/me/avatar', authenticate, upload.single('avatar'), uploadAvatar);
router.delete('/me/avatar', authenticate, removeAvatar);

// ── Email verification (public — no JWT required) ──────────────────────────
router.get('/verify-email', verifyEmail);
router.post('/resend-verification', resendVerification);

module.exports = router;

