const express = require('express');
const router = express.Router();
const { authenticate } = require('../middlewares/auth');
const { requireRole } = require('../middlewares/roleCheck');
const { listEmployees, createEmployee, updateEmployee, deleteEmployee } = require('../controllers/employeeController');

router.get('/',    authenticate, listEmployees);
router.post('/',   authenticate, requireRole('ADMIN', 'HR'), createEmployee);
router.put('/:id', authenticate, requireRole('ADMIN', 'HR'), updateEmployee);
router.delete('/:id', authenticate, requireRole('ADMIN', 'HR'), deleteEmployee);

module.exports = router;
