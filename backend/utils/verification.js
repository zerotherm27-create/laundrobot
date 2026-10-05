const crypto = require('crypto');
const db = require('../db');
const { sendEmail } = require('./email');

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;

const sha256 = s => crypto.createHash('sha256').update(s).digest('hex');

// Creates a fresh token (replacing older ones) and emails the confirmation link.
// `q` is a db client/pool so signup can call it inside its transaction.
async function createVerificationToken(q, userId) {
  const token = crypto.randomBytes(32).toString('hex');
  await q.query('DELETE FROM email_verification_tokens WHERE user_id = $1', [userId]);
  await q.query(
    'INSERT INTO email_verification_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
    [userId, sha256(token), new Date(Date.now() + TOKEN_TTL_MS)],
  );
  return token;
}

function verificationEmail(shopName, url) {
  const subject = 'Confirm your email to start your LaundroBot trial';
  const text =
`Hi,

Thanks for signing up ${shopName ? `"${shopName}" ` : ''}on LaundroBot.
Confirm your email to finish setting up your account:

${url}

This link expires in 24 hours. If you didn't sign up, you can ignore this email.

LaundroBot`;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const html = `<div style="font-family:-apple-system,Segoe UI,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#333;">
  <p style="font-size:15px;">Hi,</p>
  <p style="font-size:14px;line-height:1.6;">Thanks for signing up${shopName ? ` <strong>${esc(shopName)}</strong>` : ''} on LaundroBot. Confirm your email to finish setting up your account.</p>
  <p style="margin:24px 0;"><a href="${esc(url)}" style="background:#378ADD;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:500;">Confirm my email</a></p>
  <p style="font-size:12px;color:#777;line-height:1.5;">Button not working? Copy this link into your browser:<br>${esc(url)}</p>
  <p style="font-size:12px;color:#777;">This link expires in 24 hours. If you didn't sign up, you can ignore this email.</p>
</div>`;
  return { subject, html, text };
}

// Never throws: a mail failure must not fail signup (the user can use "Resend").
async function sendVerificationEmail(email, token, shopName) {
  try {
    // Same domain as the From address (laundrobot.app) — link/sender alignment helps deliverability.
    const appUrl = process.env.APP_URL || 'https://laundrobot.app';
    const url = `${appUrl.replace(/\/$/, '')}/?verify_token=${token}`;
    await sendEmail({ to: email, ...verificationEmail(shopName, url) });
    return true;
  } catch (err) {
    console.error('[verify-email] send failed:', err.response?.data || err.message);
    return false;
  }
}

module.exports = { createVerificationToken, sendVerificationEmail, sha256, RESEND_COOLDOWN_MS };
