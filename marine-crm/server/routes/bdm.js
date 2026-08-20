const express = require('express');
const router = express.Router();
const { authenticate, loadCurrentUser } = require('../middlewares/auth');
const { requireRole } = require('../middlewares/roleCheck');
const {
  getCountries, getCountry, createCountry, updateCountry, deleteCountry,
  getCompanies, getCompany, createCompany, updateCompany, deleteCompany,
} = require('../controllers/bdmController');

router.use(authenticate, loadCurrentUser);

// Country routes (ADMIN + BDM + Managers can manage; countries are shared,
// non-ownable reference data so they are not record-scoped)
router.get('/countries', getCountries);
router.get('/countries/:id', getCountry);
router.post('/countries', requireRole('ADMIN', 'BDM', 'MANAGER'), createCountry);
router.put('/countries/:id', requireRole('ADMIN', 'BDM', 'MANAGER'), updateCountry);
router.delete('/countries/:id', requireRole('ADMIN'), deleteCountry);

// Company routes
router.get('/companies', getCompanies);
router.get('/companies/:id', getCompany);
router.post('/companies', requireRole('ADMIN', 'BDM', 'MANAGER'), createCompany);
router.put('/companies/:id', requireRole('ADMIN', 'BDM', 'MANAGER'), updateCompany);
router.delete('/companies/:id', requireRole('ADMIN'), deleteCompany);

module.exports = router;