const router = require('express').Router();
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const db = require('../db');

// Create email transporter
function getTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

// POST /auth/forgot-password
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });

  try {
    const { rows } = await db.query('SELECT id, email, name FROM users WHERE email = $1', [email]);

    // Always respond with success (don't reveal if email exists)
    if (rows.length === 0) {
      return res.json({ message: 'If that email exists, a reset link has been sent.' });
    }

    const user = rows[0];

    // Delete any existing tokens for this user
    await db.query('DELETE FROM password_reset_tokens WHERE user_id = $1', [user.id]);

    // Generate secure token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await db.query(
      'INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [user.id, token, expiresAt]
    );

    const appUrl = process.env.APP_URL || 'https://frontend-pearl-one-64.vercel.app';
    const resetUrl = `${appUrl}?reset_token=${token}`;

    // Send email
    const transporter = getTransporter();
    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: user.email,
      subject: 'LaundroBot — Reset Your Password',
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #fff; border: 1px solid #e8e8e0; border-radius: 12px;">
          <div style="display:flex; align-items:center; gap:10px; margin-bottom:24px;">
            <div style="width:40px;height:40px;border-radius:10px;background:#378ADD;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:500;font-size:20px;">L</div>
            <div>
              <div style="font-weight:600;font-size:16px;">LaundroBot</div>
              <div style="font-size:12px;color:#888;">Password Reset</div>
            </div>
          </div>
          <p style="font-size:15px;color:#333;">Hi ${user.name || user.email},</p>
          <p style="font-size:14px;color:#555;">You requested to reset your password. Click the button below — this link expires in <strong>1 hour</strong>.</p>
          <a href="${resetUrl}" style="display:inline-block;margin:20px 0;padding:12px 28px;background:#378ADD;color:#fff;text-decoration:none;border-radius:8px;font-weight:500;font-size:14px;">
            Reset My Password
          </a>
          <p style="font-size:12px;color:#aaa;">If you didn't request this, you can safely ignore this email. Your password won't change.</p>
          <hr style="border:none;border-top:1px solid #f0f0f0;margin:20px 0;" />
          <p style="font-size:11px;color:#ccc;">LaundroBot Admin Dashboard</p>
        </div>
      `,
    });

    res.json({ message: 'If that email exists, a reset link has been sent.' });
  } catch (err) {
    console.error('[forgot-password]', err.message);
    res.status(500).json({ error: 'Failed to send reset email. Check SMTP settings.' });
  }
});

// POST /auth/reset-password
router.post('/reset-password', async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) return res.status(400).json({ error: 'Token and password are required' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

  try {
    const { rows } = await db.query(
      `SELECT t.*, u.id as uid FROM password_reset_tokens t
       JOIN users u ON u.id = t.user_id
       WHERE t.token = $1 AND t.used = FALSE AND t.expires_at > NOW()`,
      [token]
    );

    if (rows.length === 0) {
      return res.status(400).json({ error: 'Reset link is invalid or has expired.' });
    }

    const record = rows[0];
    const hash = await bcrypt.hash(password, 10);

    await db.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, record.uid]);
    await db.query('UPDATE password_reset_tokens SET used = TRUE WHERE id = $1', [record.id]);

    res.json({ message: 'Password updated successfully. You can now log in.' });
  } catch (err) {
    console.error('[reset-password]', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
