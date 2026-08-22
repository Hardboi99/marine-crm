// Birthday Service — Marine CRM
// Sends professional birthday emails via SMTP using shared email config.

require('dotenv').config();
const { sendEmail } = require('../config/email');

// In-memory dedup set: "employeeId:YYYY-MM-DD" → prevents duplicate sends within same server process
const sentToday = new Set();
let lastClearedDate = '';

function getTodayStr() {
  return new Date().toISOString().split('T')[0];
}

function clearSentSetIfNewDay() {
  const today = getTodayStr();
  if (today !== lastClearedDate) {
    sentToday.clear();
    lastClearedDate = today;
  }
}

async function sendBirthdayEmail(employee) {
  if (!employee.email) return { sent: false, reason: 'no email' };

  const firstName = employee.name.split(' ')[0];
  const html = `
<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f4f7fb;font-family:'Segoe UI',Arial,sans-serif;">
<div style="max-width:560px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.10);">
  <div style="background:linear-gradient(135deg,#0ea5e9 0%,#6366f1 100%);padding:40px 32px;text-align:center;">
    <div style="font-size:56px;margin-bottom:8px;">🎂</div>
    <h1 style="color:#fff;margin:0;font-size:28px;font-weight:700;">Happy Birthday, ${firstName}!</h1>
  </div>
  <div style="padding:32px 36px;">
    <p style="color:#334155;font-size:16px;line-height:1.7;margin:0 0 16px;">
      On behalf of the entire <strong>Marine CRM</strong> team, we wish you a wonderful birthday filled with joy, good health, and great success ahead.
    </p>
    <p style="color:#334155;font-size:16px;line-height:1.7;margin:0 0 24px;">
      Your dedication and hard work make our team truly exceptional. We are grateful to have you with us. Here's to another amazing year! 🚢
    </p>
    <div style="border-top:1px solid #e2e8f0;padding-top:20px;text-align:center;">
      <p style="color:#94a3b8;font-size:13px;margin:0;">Marine Recruitment CRM · Vessel Management &amp; Sales Pipeline</p>
    </div>
  </div>
</div>
</body></html>`;

  const info = await sendEmail(
    employee.email,
    `🎉 Happy Birthday, ${firstName}! — Marine CRM Team`,
    html
  );

  return { sent: !!info };
}

async function runDailyBirthdayCheck() {
  clearSentSetIfNewDay();
  const today = getTodayStr();
  const now = new Date();
  const todayMonth = now.getMonth() + 1; // 1-12
  const todayDay = now.getDate();

  try {
    // Dynamic require to avoid circular deps at module load
    const { Employee } = require('../models');
    const employees = await Employee.find({ dateOfBirth: { $ne: null } });

    let sent = 0, skipped = 0;
    for (const emp of employees) {
      const dob = new Date(emp.dateOfBirth);
      if (dob.getMonth() + 1 === todayMonth && dob.getDate() === todayDay) {
        const key = `${emp._id.toString()}:${today}`;
        if (sentToday.has(key)) { skipped++; continue; }

        try {
          const result = await sendBirthdayEmail(emp);
          if (result.sent) { sentToday.add(key); sent++; }
          else { skipped++; console.log(`Birthday email skipped for ${emp.name}: ${result.reason}`); }
        } catch (emailErr) {
          console.error(`Birthday email failed for ${emp.name}:`, emailErr.message);
        }
      }
    }
    if (sent > 0 || skipped > 0)
      console.log(`🎂 Birthday check: ${sent} sent, ${skipped} skipped.`);
  } catch (err) {
    console.error('Birthday check error:', err.message);
  }
}

function scheduleBirthdayJob() {
  // Run once at startup (in case server restarted mid-day)
  runDailyBirthdayCheck();

  // Run every 24 hours
  setInterval(runDailyBirthdayCheck, 24 * 60 * 60 * 1000);
  console.log('🎂 Birthday email scheduler started.');
}

module.exports = { scheduleBirthdayJob, runDailyBirthdayCheck, sendBirthdayEmail };
