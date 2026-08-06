const express = require('express');
const router = express.Router();
const { login, register, logout, getMe } = require('../controllers/authController');
const { authenticate } = require('../middlewares/auth');

router.post('/login', login);
router.post('/register', register);
router.post('/logout', authenticate, logout);
router.get('/me', authenticate, getMe);


module.exports = router;
