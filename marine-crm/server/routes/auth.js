const express = require('express');
const router = express.Router();
const { login, register, logout, getMe, verifyEmail, resendVerification } = require('../controllers/authController');
const { authenticate } = require('../middlewares/auth');

router.post('/login', login);
router.post('/register', register);                                // Always returns 403 (disabled)
router.post('/logout', authenticate, logout);
router.get('/me', authenticate, getMe);

// ── Email verification (public — no JWT required) ──────────────────────────
router.get('/verify-email', verifyEmail);
router.post('/resend-verification', resendVerification);

module.exports = router;

