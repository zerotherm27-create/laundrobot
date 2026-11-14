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

// ── No-login "Choose a plan" (the link in the trial emails) ──────────────────────────────────────
// The signed token identifies the shop, so the owner can pick a plan and pay without signing in.
// It grants NOTHING else: no session, no shop data beyond the shop's name.

// POST /auth/plan-link { token } — who is this link for, and can they still subscribe?
router.post('/plan-link', async (req, res) => {
  const tenantId = verifyLink(req.body?.token, 'plan');
  if (!tenantId) return res.status(400).json({ error: 'This link is invalid or has expired. Sign in to choose a plan.' });
  try {
    const { rows: [t] } = await db.query(
      `SELECT name, subscription_status, subscription_paid_until FROM tenants WHERE id = $1 AND active = TRUE`, [tenantId]
    );
    if (!t) return res.status(404).json({ error: 'We could not find this shop.' });
    const subscribed = t.subscription_status === 'active'
      && (!t.subscription_paid_until || new Date(t.subscription_paid_until) > new Date());
    res.json({ shop_name: t.name, subscribed });
  } catch (err) {
    console.error('[lifecycle] plan-link', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /auth/plan-link/pay { token, plan } — create the Xendit invoice for that shop.
router.post('/plan-link/pay', async (req, res) => {
  const tenantId = verifyLink(req.body?.token, 'plan');
  if (!tenantId) return res.status(400).json({ error: 'This link is invalid or has expired. Sign in to choose a plan.' });
  const { PLANS, createSubscriptionInvoice } = require('../utils/subscriptionPlans');
  const plan = String(req.body?.plan || '');
  if (!PLANS[plan]) return res.status(400).json({ error: 'Please choose a plan.' });
  try {
    const { rows: [t] } = await db.query(
      `SELECT t.name,
              (SELECT u.email FROM users u WHERE u.tenant_id = t.id AND u.role = 'admin' AND u.email IS NOT NULL
               ORDER BY u.created_at ASC LIMIT 1) AS owner_email
       FROM tenants t WHERE t.id = $1 AND t.active = TRUE`, [tenantId]
    );
    if (!t || !t.owner_email) return res.status(404).json({ error: 'We could not find this shop.' });
    const { invoiceUrl } = await createSubscriptionInvoice({
      tenantId, tenantName: t.name, payerEmail: t.owner_email, plan, successPath: '/?plan_paid=1',
    });
    res.json({ invoiceUrl });
  } catch (err) {
    console.error('[lifecycle] plan-link/pay', err.response?.data || err);
    res.status(500).json({ error: 'Could not open the payment page. Please try again.' });
  }
});

module.exports = router;
