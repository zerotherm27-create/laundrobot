const router = require('express').Router();
const auth = require('../middleware/auth');
const db = require('../db');

// GET VAPID public key (no auth — needed before login for SW setup)
router.get('/vapid-public-key', (req, res) => {
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY || null });
});

// POST save a push subscription for the logged-in user
router.post('/subscribe', auth, async (req, res) => {
  const { endpoint, keys } = req.body;
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return res.status(400).json({ error: 'endpoint and keys (p256dh, auth) are required' });
  }
  try {
    await db.query(
      `INSERT INTO push_subscriptions (user_id, tenant_id, endpoint, p256dh, auth)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id, endpoint) DO UPDATE SET p256dh=$4, auth=$5`,
      [req.user.id, req.user.tenant_id, endpoint, keys.p256dh, keys.auth]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE remove a push subscription (e.g. on logout)
router.delete('/subscribe', auth, async (req, res) => {
  const { endpoint } = req.body;
  if (!endpoint) return res.status(400).json({ error: 'endpoint required' });
  try {
    await db.query(
      'DELETE FROM push_subscriptions WHERE user_id=$1 AND endpoint=$2',
      [req.user.id, endpoint]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
