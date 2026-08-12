const crypto = require('crypto');
const { sendEmail } = require('../config/email');

/**
 * Generate a cryptographically secure verification token.
 * rawToken   : sent in the email URL; NEVER stored in DB.
 * hashedToken: SHA-256 of rawToken; stored in DB for safe comparison.
 * @returns {{ rawToken: string, hashedToken: string }}
 */
const generateVerificationToken = () => {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
  return { rawToken, hashedToken };
};

/**
 * Hash an incoming raw token (used during verification to look up DB record).
 * @param {string} rawToken
 * @returns {string} SHA-256 hex hash
 */
const hashToken = (rawToken) =>
  crypto.createHash('sha256').update(rawToken).digest('hex');

/**
 * Send an email-verification email to a newly-created / updated user.
 * If SMTP is not configured the raw token is logged to console so an admin
 * can manually construct the verify URL — employee/user save still succeeds.
 *
 * @param {{ name: string, email: string }} user
 * @param {string} rawToken - the unhashed token (goes in the URL)
 * @param {string} baseUrl  - e.g. 'http://localhost:5000'
 */
const sendVerificationEmail = async (user, rawToken, baseUrl) => {
  const verifyUrl = `${baseUrl}/pages/verify-email.html?token=${rawToken}`;

  // Always log so admins can copy it from the console when SMTP is offline.
  console.log(`[EmailVerification] Verify URL for ${user.email} -> ${verifyUrl}`);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Verify Your Email - Marine BDM CRM</title>
  <style>
    body{margin:0;padding:0;background:#060b13;font-family:Arial,sans-serif;color:#eaf2f6;}
    .wrap{max-width:560px;margin:40px auto;background:#0c1723;border-radius:16px;border:1px solid rgba(255,255,255,0.08);overflow:hidden;}
    .hero{background:linear-gradient(135deg,#0e7490,#0891b2);padding:36px 40px 28px;text-align:center;}
    .hero h1{margin:0 0 6px;font-size:1.4rem;color:#fff;}
    .hero p{margin:0;font-size:0.9rem;color:rgba(255,255,255,0.8);}
    .body{padding:32px 40px;}
    .body p{margin:0 0 18px;font-size:0.93rem;line-height:1.6;color:#b0c4cf;}
    .btn{display:inline-block;padding:14px 32px;background:linear-gradient(120deg,#22d3ee,#0891b2);color:#06222b;font-weight:700;font-size:0.93rem;border-radius:10px;text-decoration:none;margin:4px 0 20px;}
    .note{font-size:0.8rem;color:#7f94a4;}
    .url{color:#22d3ee;word-break:break-all;}
    .foot{padding:16px 40px;border-top:1px solid rgba(255,255,255,0.06);font-size:0.75rem;color:#4a6070;text-align:center;}
  </style>
</head>
<body>
  <div class="wrap">
    <div class="hero">
      <h1>Marine BDM CRM</h1>
      <p>Email Verification Required</p>
    </div>
    <div class="body">
      <p>Hi <strong>${user.name}</strong>,</p>
      <p>Your account has been created by the Admin/HR team. Please verify your email address to activate your login access.</p>
      <p style="text-align:center">
        <a href="${verifyUrl}" class="btn">Verify Email Address</a>
      </p>
      <p class="note">This link expires in <strong>24 hours</strong>. If you were not expecting this email, please ignore it.</p>
      <p class="note">If the button does not work, paste this URL into your browser:<br>
        <span class="url">${verifyUrl}</span>
      </p>
    </div>
    <div class="foot">Marine BDM CRM &mdash; Internal Operations Platform</div>
  </div>
</body>
</html>`;

  try {
    await sendEmail(user.email, 'Verify your Marine CRM email address', html);
  } catch (err) {
    // Non-fatal: employee + user records are already saved.
    console.error(`[EmailVerification] Failed to send to ${user.email}:`, err.message);
  }
};

module.exports = { generateVerificationToken, hashToken, sendVerificationEmail };
