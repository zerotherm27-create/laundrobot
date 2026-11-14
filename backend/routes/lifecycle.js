// Endpoints behind the links in the automated trial emails (jobs/lifecycleEmail.js).
// Both are POST on purpose: mail scanners pre-open links in emails, which would trigger a GET.
// The page the link opens (frontend LifecycleLink.jsx) shows a button; the button makes the POST.
const router = require('express').Router();
const db = require('../db');
const { verifyLink } = require('../utils/lifecycleLinks');
const { sendEmail } = require('../utils/email');

const EXTRA_DAYS = 7;

// POST /auth/extend-trial { token } — reopen an ended, never-paid trial for 7 days. Once per shop.
router.post('/extend-trial', async (req, res) => {
  const tenantId = verifyLink(req.body?.token, 'extend');
  if (!tenantId) return res.status(400).json({ error: 'This link is invalid or has expired.' });
  try {
    const { rows: [updated] } = await db.query(
      `UPDATE tenants
       SET subscription_status = 'trial',
           trial_ends_at = NOW() + INTERVAL '${EXTRA_DAYS} days',
           trial_extended_at = NOW()
       WHERE id = $1
         AND trial_extended_at IS NULL
         AND subscription_status IN ('trial', 'expired')
         AND subscription_paid_until IS NULL
         AND (trial_ends_at IS NULL OR trial_ends_at < NOW())
       RETURNING name, trial_ends_at`,
      [tenantId]
    );
    if (updated) {
      console.log(`[lifecycle] trial reopened for tenant ${tenantId} (${updated.name})`);
      sendEmail({
        to: [process.env.PLATFORM_NOTIFY_EMAIL || 'hello@laundrobot.app'],
        subject: `Trial reopened: ${updated.name}`,
        text: `${updated.name} used the "7 more trial days" offer. New trial end: ${new Date(updated.trial_ends_at).toISOString()}`,
        html: `<p><b>${String(updated.name).replace(/</g, '&lt;')}</b> used the "7 more trial days" offer.</p>`,
      }).catch(() => {});
      return res.json({ ok: true, days: EXTRA_DAYS });
    }

    // Nothing updated — tell the owner why, without changing anything.
    const { rows: [t] } = await db.query(
      `SELECT subscription_status, trial_ends_at, trial_extended_at FROM tenants WHERE id = $1`, [tenantId]
    );
    if (!t) return res.status(404).json({ error: 'We could not find this shop.' });
    if (t.subscription_status === 'active') return res.status(409).json({ error: 'This shop already has an active subscription. Just sign in.' });
    if (t.trial_extended_at) return res.status(409).json({ error: 'The extra trial days were already used for this shop. Sign in to choose a plan.' });
    if (t.trial_ends_at && new Date(t.trial_ends_at) > new Date()) return res.status(409).json({ error: 'Your trial is still running. Just sign in.' });
    return res.status(409).json({ error: 'This offer is not available for this shop. Sign in to choose a plan.' });
  } catch (err) {
    console.error('[lifecycle] extend-trial', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /auth/unsubscribe { token } — stop the automated trial emails for this shop.
router.post('/unsubscribe', async (req, res) => {
  const tenantId = verifyLink(req.body?.token, 'unsub');
  if (!tenantId) return res.status(400).json({ error: 'This link is invalid.' });
  try {
    await db.query(
      `UPDATE tenants SET marketing_unsubscribed_at = COALESCE(marketing_unsubscribed_at, NOW()) WHERE id = $1`,
      [tenantId]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('[lifecycle] unsubscribe', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
