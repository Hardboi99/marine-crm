const nodemailer = require('nodemailer');

let transporter = null;

const getTransporter = () => {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  return transporter;
};

/**
 * Send an email notification
 * @param {string} to - recipient email
 * @param {string} subject
 * @param {string} html - HTML body
 */
const sendEmail = async (to, subject, html) => {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn('[Email] SMTP not configured — skipping email send');
    return;
  }
  try {
    const info = await getTransporter().sendMail({
      from: `"Marine CRM" <${process.env.SMTP_USER}>`,
      to,
      subject,
      html,
    });
    console.log('[Email] Sent:', info.messageId);
    return info;
  } catch (err) {
    console.error('[Email] Failed to send:', err.message);
    // Don't throw — email failure should not crash the API
  }
};

module.exports = { sendEmail };
