const express = require('express');
const router = express.Router();
const { authenticate } = require('../middlewares/auth');
const { requireRole } = require('../middlewares/roleCheck');
const {
  getCountries, getCountry, createCountry, updateCountry, deleteCountry,
  getCompanies, getCompany, createCompany, updateCompany, deleteCompany,
} = require('../controllers/bdmController');

// Country routes (ADMIN + BDM + MANAGER can manage)
router.get('/countries', authenticate, getCountries);
router.get('/countries/:id', authenticate, getCountry);
router.post('/countries', authenticate, requireRole('ADMIN', 'BDM', 'MANAGER'), createCountry);
router.put('/countries/:id', authenticate, requireRole('ADMIN', 'BDM', 'MANAGER'), updateCountry);
router.delete('/countries/:id', authenticate, requireRole('ADMIN'), deleteCountry);

// Company routes
router.get('/companies', authenticate, getCompanies);
router.get('/companies/:id', authenticate, getCompany);
router.post('/companies', authenticate, requireRole('ADMIN', 'BDM', 'MANAGER'), createCompany);
router.put('/companies/:id', authenticate, requireRole('ADMIN', 'BDM', 'MANAGER'), updateCompany);
router.delete('/companies/:id', authenticate, requireRole('ADMIN'), deleteCompany);

module.exports = router;
