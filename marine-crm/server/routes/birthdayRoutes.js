const express = require('express');
const router = express.Router();

const { Employee } = require('../models');

router.get('/today', async (req, res) => {
  try {
    const now = new Date();
    const month = now.getMonth() + 1;
    const day = now.getDate();

    const employees = await Employee.find({
      dateOfBirth: { $ne: null }
    }).select('_id name email dateOfBirth');

    const birthdays = employees.filter((emp) => {
      const dob = new Date(emp.dateOfBirth);

      return (
        dob.getMonth() + 1 === month &&
        dob.getDate() === day
      );
    });

    res.json({
      success: true,
      data: birthdays
    });
  } catch (error) {
    console.error('Birthday API error:', error);

    res.status(500).json({
      success: false,
      message: 'Failed to fetch birthdays'
    });
  }
});


router.get('/check-my-birthday', async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    const employee = await Employee.findById(userId)
      .select('_id name dateOfBirth');

    if (!employee || !employee.dateOfBirth) {
      return res.json({
        success: true,
        isBirthdayToday: false
      });
    }

    const today = new Date();
    const dob = new Date(employee.dateOfBirth);

    const isBirthdayToday =
      today.getMonth() === dob.getMonth() &&
      today.getDate() === dob.getDate();

    const firstName = employee.name
      ? employee.name.split(' ')[0]
      : '';

    res.json({
      success: true,
      isBirthdayToday,
      firstName
    });

  } catch (error) {
    console.error('Check birthday error:', error);

    res.status(500).json({
      success: false,
      message: 'Failed to check birthday'
    });
  }
});

module.exports = router;