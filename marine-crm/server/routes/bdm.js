const express = require('express');
const router = express.Router();
const { requireRole } = require('../middlewares/roleCheck');
const {
  getCountries, getCountry, createCountry, updateCountry, deleteCountry,
  getCompanies, getCompany, createCompany, updateCompany, deleteCompany,
} = require('../controllers/bdmController');

// Country routes (ADMIN + DIRECTOR + COO + BDM can manage; countries are shared,
// non-ownable reference data so they are not record-scoped)
router.get('/countries', getCountries);
router.get('/countries/:id', getCountry);
router.post('/countries', requireRole('ADMIN', 'DIRECTOR', 'COO', 'BDM'), createCountry);
router.put('/countries/:id', requireRole('ADMIN', 'DIRECTOR', 'COO', 'BDM'), updateCountry);
router.delete('/countries/:id', requireRole('ADMIN', 'DIRECTOR', 'COO'), deleteCountry);

// Company routes
router.get('/companies', getCompanies);
router.get('/companies/:id', getCompany);
router.post('/companies', requireRole('ADMIN', 'DIRECTOR', 'COO', 'BDM'), createCompany);
router.put('/companies/:id', requireRole('ADMIN', 'DIRECTOR', 'COO', 'BDM'), updateCompany);
router.delete('/companies/:id', requireRole('ADMIN', 'DIRECTOR', 'COO'), deleteCompany);

module.exports = router;