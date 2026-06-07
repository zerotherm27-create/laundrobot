require('dotenv').config();
const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');

// Login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const result = await db.query(
      `SELECT u.*, t.name as tenant_name 
       FROM users u
       LEFT JOIN tenants t ON t.id = u.tenant_id
       WHERE u.email = $1`,
      [email]
    );

    if (!result.rows || result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    let permissions = [];
    try {
      permissions = Array.isArray(user.permissions)
        ? user.permissions
        : JSON.parse(user.permissions || '[]');
    } catch { permissions = []; }

    const token = jwt.sign(
      {
        id: user.id,
        role: user.role,
        tenant_id: user.tenant_id,
        tenant_name: user.tenant_name,
        email: user.email,
        permissions,
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      role: user.role,
      tenant_id: user.tenant_id,
      tenant_name: user.tenant_name,
      email: user.email,
      permissions,
    });

  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Email normalization (Gmail dot/alias dedup + general +alias stripping) ───
function normalizeEmail(raw) {
  const lower = raw.trim().toLowerCase();
  const at = lower.lastIndexOf('@');
  if (at === -1) return lower;
  let local  = lower.slice(0, at);
  let domain = lower.slice(at + 1);
  // Strip +alias for all providers
  local = local.split('+')[0];
  // Gmail-specific: strip dots, normalize googlemail → gmail
  if (domain === 'gmail.com' || domain === 'googlemail.com') {
    local  = local.replace(/\./g, '');
    domain = 'gmail.com';
  }
  return `${local}@${domain}`;
}

// Self-service signup — creates a new tenant + admin user with a 14-day trial
router.post('/signup', async (req, res) => {
  const { business_name, email, password } = req.body;
  if (!business_name?.trim() || !email?.trim() || !password) {
    return res.status(400).json({ error: 'business_name, email and password are required' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  const normalizedEmail = normalizeEmail(email);
  // Extract real client IP (Railway sets X-Forwarded-For; trust proxy is enabled in server.js)
  const signupIp = req.ip || req.socket?.remoteAddress || 'unknown';

  let client;
  try {
    client = await db.pool.connect();
    await client.query('BEGIN');

    // Check exact email not already registered
    const { rows: existing } = await client.query(
      `SELECT id FROM users WHERE email = $1`, [email.trim().toLowerCase()]
    );
    if (existing.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'An account with that email already exists.' });
    }

    // Check normalized email (catches Gmail +alias / dot tricks)
    const { rows: normExisting } = await client.query(
      `SELECT id FROM users WHERE normalized_email = $1`, [normalizedEmail]
    );
    if (normExisting.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'An account with that email already exists.' });
    }

    // IP trial limit — max 2 trial accounts per IP (allows legitimate shared-office cases)
    if (signupIp && signupIp !== 'unknown') {
      const { rows: ipTrials } = await client.query(
        `SELECT COUNT(*) AS cnt FROM tenants WHERE signup_ip = $1`, [signupIp]
      );
      if (parseInt(ipTrials[0]?.cnt || 0) >= 2) {
        await client.query('ROLLBACK');
        return res.status(429).json({
          error: 'A trial account has already been created from your network. Please contact support if you need assistance.',
        });
      }
    }

    // Create tenant with 14-day trial
    const { rows: [tenant] } = await client.query(
      `INSERT INTO tenants (name, trial_ends_at, subscription_status, signup_ip)
       VALUES ($1, NOW() + INTERVAL '14 days', 'trial', $2)
       RETURNING id, name, trial_ends_at, subscription_status`,
      [business_name.trim(), signupIp]
    );

    // Create admin user
    const hash = await bcrypt.hash(password, 10);
    const { rows: [newUser] } = await client.query(
      `INSERT INTO users (email, password_hash, role, tenant_id, normalized_email)
       VALUES ($1, $2, 'admin', $3, $4) RETURNING id`,
      [email.trim().toLowerCase(), hash, tenant.id, normalizedEmail]
    );

    await client.query('COMMIT');

    const token = jwt.sign(
      {
        id: newUser.id,
        role: 'admin',
        tenant_id: tenant.id,
        tenant_name: tenant.name,
        email: email.trim().toLowerCase(),
        permissions: [],
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      role: 'admin',
      tenant_id: tenant.id,
      tenant_name: tenant.name,
      email: email.trim().toLowerCase(),
      permissions: [],
      subscription_status: tenant.subscription_status,
      trial_ends_at: tenant.trial_ends_at,
    });
  } catch (err) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    console.error('Signup error:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    if (client) client.release();
  }
});

// GET subscription status for current tenant
router.get('/subscription', require('../middleware/auth'), async (req, res) => {
  try {
    const { rows: [tenant] } = await db.query(
      `SELECT subscription_status, trial_ends_at, subscription_paid_until, subscription_plan
       FROM tenants WHERE id = $1`,
      [req.user.tenant_id]
    );
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

    // Auto-expire trial if past trial_ends_at
    if (tenant.subscription_status === 'trial' && tenant.trial_ends_at && new Date(tenant.trial_ends_at) < new Date()) {
      await db.query(
        `UPDATE tenants SET subscription_status = 'expired' WHERE id = $1`,
        [req.user.tenant_id]
      );
      tenant.subscription_status = 'expired';
    }

    res.json(tenant);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST create a subscription payment invoice via platform Xendit key
router.post('/subscription/pay', require('../middleware/auth'), async (req, res) => {
  const { plan } = req.body; // 'starter_monthly' | 'growth_monthly' | 'pro_monthly' | '*_annual'
  const PLANS = {
    starter_monthly: { amount: 999,   label: 'LaundroBot Starter Monthly', tier: 'starter' },
    growth_monthly:  { amount: 1999,  label: 'LaundroBot Growth Monthly',  tier: 'growth'  },
    pro_monthly:     { amount: 5499,  label: 'LaundroBot Pro Monthly',     tier: 'pro'     },
    starter_annual:  { amount: 9990,  label: 'LaundroBot Starter Annual',  tier: 'starter' },
    growth_annual:   { amount: 19990, label: 'LaundroBot Growth Annual',   tier: 'growth'  },
    pro_annual:      { amount: 54990, label: 'LaundroBot Pro Annual',      tier: 'pro'     },
  };
  const chosen = PLANS[plan] || PLANS.starter_monthly;
  const platformKey = process.env.XENDIT_PLATFORM_API_KEY;
  if (!platformKey) return res.status(500).json({ error: 'Platform payment not configured' });

  try {
    const { rows: [tenant] } = await db.query(
      `SELECT name FROM tenants WHERE id = $1`, [req.user.tenant_id]
    );
    const { createInvoice } = require('../utils/xendit');
    const externalId = `sub-${req.user.tenant_id}-${Date.now()}`;
    const { invoiceUrl } = await createInvoice(platformKey, {
      externalId,
      amount: chosen.amount,
      payerEmail: req.user.email,
      description: `${chosen.label} — ${tenant?.name || req.user.tenant_name}`,
      successRedirectUrl: `${process.env.APP_URL || 'https://laundrobot.app'}/?subscribed=1`,
    });
    res.json({ invoiceUrl, externalId, amount: chosen.amount });
  } catch (err) {
    console.error('Subscription pay error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Register first superadmin (run once during setup)
router.post('/setup', async (req, res) => {
  const { email, password } = req.body;
  try {
    const { rows } = await db.query(`SELECT id FROM users WHERE role = 'superadmin' LIMIT 1`);
    if (rows.length > 0) {
      return res.status(403).json({ error: 'Setup already completed' });
    }
    const hash = await bcrypt.hash(password, 10);
    await db.query(
      `INSERT INTO users (email, password_hash, role) VALUES ($1, $2, 'superadmin')`,
      [email, hash]
    );
    res.json({ message: 'Superadmin created' });
  } catch (err) {
    console.error('Setup error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;