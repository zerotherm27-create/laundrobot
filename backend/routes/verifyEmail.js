const router = require('express').Router();
const db = require('../db');
const { createVerificationToken, sendVerificationEmail, sha256, RESEND_COOLDOWN_MS } = require('../utils/verification');

// POST /auth/verify-email { token }
// POST (not GET) on purpose: mail scanners prefetch links in emails, which would burn a GET token.
router.post('/verify-email', async (req, res) => {
  const token = String(req.body?.token || '');
  if (!/^[a-f0-9]{64}$/.test(token)) return res.status(400).json({ error: 'This confirmation link is invalid.' });
  let client;
  try {
    client = await db.pool.connect();
    await client.query('BEGIN');
    const { rows: [row] } = await client.query(
      `SELECT user_id FROM email_verification_tokens WHERE token_hash = $1 AND expires_at > NOW()`,
      [sha256(token)],
    );
    if (!row) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'This confirmation link is invalid or has expired. Request a new one from the sign-in page.' });
    }
    await client.query(`UPDATE users SET email_verified = TRUE WHERE id = $1`, [row.user_id]);
    await client.query(`DELETE FROM email_verification_tokens WHERE user_id = $1`, [row.user_id]);
    // The free trial starts when the owner confirms, not while they wait for the email.
    await client.query(
      `UPDATE tenants SET trial_ends_at = NOW() + INTERVAL '14 days'
       WHERE subscription_status = 'trial' AND id = (SELECT tenant_id FROM users WHERE id = $1)`,
      [row.user_id],
    );
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (err) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    console.error('[verify-email]', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    if (client) client.release();
  }
});

// POST /auth/resend-verification { email } — always the same answer (never reveals which emails exist).
router.post('/resend-verification', async (req, res) => {
  const generic = { message: 'If that account is waiting for confirmation, a new email has been sent.' };
  const email = String(req.body?.email || '').trim().toLowerCase();
  if (!email) return res.status(400).json({ error: 'Email is required' });
  try {
    const { rows: [user] } = await db.query(
      `SELECT u.id, u.email, t.name AS shop FROM users u LEFT JOIN tenants t ON t.id = u.tenant_id
       WHERE LOWER(u.email) = $1 AND u.email_verified = FALSE`, [email]);
    if (!user) return res.json(generic);
    const { rows: [recent] } = await db.query(
      `SELECT created_at FROM email_verification_tokens WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`, [user.id]);
    if (recent && Date.now() - new Date(recent.created_at).getTime() < RESEND_COOLDOWN_MS) return res.json(generic);
    const token = await createVerificationToken(db, user.id);
    await sendVerificationEmail(user.email, token, user.shop);
    res.json(generic);
  } catch (err) {
    console.error('[resend-verification]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
