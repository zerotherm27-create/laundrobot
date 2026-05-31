const router = require('express').Router();
const auth = require('../middleware/auth');
const db = require('../db');
const { setupMessengerProfile } = require('../utils/messengerProfile');
const jwt = require('jsonwebtoken');
const axios = require('axios');

const GRAPH = 'https://graph.facebook.com/v19.0';

function superadminOnly(req, res, next) {
  if (req.user.role !== 'superadmin') return res.status(403).json({ error: 'Superadmin only' });
  next();
}

// GET own tenant settings (admin)
router.get('/settings', auth, async (req, res) => {
  try {
    const { rows: [tenant] } = await db.query(
      `SELECT id, name, logo_url, notification_email, contact_number, minimum_order, ai_enabled, ai_instructions,
              ig_user_id, ai_pause_hours, shop_address, fb_page_id, qr_image_url,
              custom_domain, white_label, plan, payment_mode, open_days,
              google_review_link, review_cooldown_days,
              (xendit_api_key IS NOT NULL AND xendit_api_key != '') AS has_xendit_key,
              CASE WHEN xendit_api_key IS NOT NULL AND length(xendit_api_key) >= 4
                   THEN right(xendit_api_key, 4) ELSE NULL END AS xendit_key_hint,
              to_char(store_open, 'HH24:MI') AS store_open,
              to_char(store_close, 'HH24:MI') AS store_close,
              to_char(booking_cutoff, 'HH24:MI') AS booking_cutoff
       FROM tenants WHERE id=$1`,
      [req.user.tenant_id]
    );
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
    res.json(tenant);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT own tenant settings (admin — only safe fields)
router.put('/settings', auth, async (req, res) => {
  const { notification_email, contact_number, store_open, store_close, booking_cutoff, open_days, minimum_order, ai_enabled, ai_instructions, ig_user_id, ai_pause_hours, shop_address, qr_image_url, custom_domain, white_label, logo_url, payment_mode, xendit_api_key, google_review_link, review_cooldown_days } = req.body;

  if (ai_instructions && ai_instructions.length > 3000) {
    return res.status(400).json({ error: 'AI instructions must be 3000 characters or less.' });
  }

  try {
    // Only Pro tenants can set custom domain / white label
    const { rows: [current] } = await db.query(
      `SELECT plan, custom_domain, fb_page_access_token, ig_user_id FROM tenants WHERE id=$1`,
      [req.user.tenant_id]
    );
    const isPro = current?.plan === 'pro';

    const validPaymentModes = ['xendit', 'qr_static'];
    const safePaymentMode = validPaymentModes.includes(payment_mode) ? payment_mode : null;

    // Validate Xendit key if provided
    const newXenditKey = xendit_api_key?.trim() || null;
    if (newXenditKey) {
      try {
        await axios.get('https://api.xendit.co/balance', {
          auth: { username: newXenditKey, password: '' },
          timeout: 8000,
        });
      } catch (e) {
        if (e.response?.status === 401) {
          return res.status(400).json({ error: 'Invalid Xendit API key — please check the key and try again.' });
        }
        // Network/timeout errors: don't block the save, key may still be valid
      }
    }

    // Snapshot current settings before overwriting (non-blocking — never fails the save)
    try {
      const { rows: [snap] } = await db.query(
        `SELECT notification_email, contact_number, store_open, store_close, booking_cutoff,
                minimum_order, ai_enabled, ai_instructions, ig_user_id, ai_pause_hours,
                shop_address, qr_image_url, custom_domain, white_label, logo_url,
                payment_mode, open_days, google_review_link, review_cooldown_days
         FROM tenants WHERE id=$1`,
        [req.user.tenant_id]
      );
      if (snap) {
        await db.query(
          `INSERT INTO tenant_settings_history (tenant_id, changed_by, snapshot)
           VALUES ($1, $2, $3)`,
          [req.user.tenant_id, req.user.email, JSON.stringify(snap)]
        );
      }
    } catch (snapErr) {
      console.warn('[settings] snapshot failed (non-fatal):', snapErr.message);
    }

    const { rows: [tenant] } = await db.query(
      `UPDATE tenants
       SET notification_email = COALESCE($1, notification_email),
           contact_number     = COALESCE($2, contact_number),
           store_open         = COALESCE($3, store_open),
           store_close        = COALESCE($4, store_close),
           booking_cutoff     = COALESCE($5, booking_cutoff),
           minimum_order      = COALESCE($6, minimum_order),
           ai_enabled=$7,
           ai_instructions = CASE WHEN $14 THEN COALESCE($8, ai_instructions) ELSE ai_instructions END,
           ig_user_id    = COALESCE($9, ig_user_id),
           ai_pause_hours=$10,
           shop_address  = COALESCE($11, shop_address),
           qr_image_url  = COALESCE($12, qr_image_url),
           custom_domain = CASE WHEN $14 THEN COALESCE($13, custom_domain) ELSE custom_domain END,
           white_label   = CASE WHEN $14 THEN $15 ELSE white_label   END,
           logo_url      = COALESCE($17, logo_url),
           payment_mode  = COALESCE($18, payment_mode),
           xendit_api_key = COALESCE($19, xendit_api_key),
           open_days     = COALESCE($20, open_days),
           google_review_link = COALESCE($21, google_review_link),
           review_cooldown_days = COALESCE($22, review_cooldown_days)
       WHERE id=$16
       RETURNING id, name, logo_url, notification_email, contact_number, minimum_order, ai_enabled, ai_instructions,
                 ig_user_id, ai_pause_hours, shop_address, qr_image_url, custom_domain, white_label, plan, payment_mode,
                 open_days, google_review_link, review_cooldown_days,
                 (xendit_api_key IS NOT NULL AND xendit_api_key != '') AS has_xendit_key,
                 CASE WHEN xendit_api_key IS NOT NULL AND length(xendit_api_key) >= 4
                      THEN right(xendit_api_key, 4) ELSE NULL END AS xendit_key_hint,
                 to_char(store_open, 'HH24:MI') AS store_open,
                 to_char(store_close, 'HH24:MI') AS store_close,
                 to_char(booking_cutoff, 'HH24:MI') AS booking_cutoff`,
      [
        notification_email?.trim() || null,
        contact_number?.trim() || null,
        store_open || null,
        store_close || null,
        booking_cutoff || null,
        minimum_order != null && minimum_order !== '' ? Number(minimum_order) : null,
        ai_enabled === true || ai_enabled === 'true',
        ai_instructions?.trim() || null,
        ig_user_id?.trim() || null,
        ai_pause_hours != null && ai_pause_hours !== '' ? Number(ai_pause_hours) : 2,
        shop_address?.trim() || null,
        qr_image_url?.trim() || null,
        custom_domain?.trim().toLowerCase() || null,  // $13
        isPro,                                         // $14 — gate
        white_label === true || white_label === 'true',// $15
        req.user.tenant_id,                            // $16
        logo_url || null,                              // $17
        safePaymentMode,                               // $18
        newXenditKey,                                  // $19
        Array.isArray(open_days) ? open_days : null,  // $20
        google_review_link?.trim() || null,            // $21
        review_cooldown_days != null && review_cooldown_days !== '' ? Number(review_cooldown_days) : null, // $22
      ]
    );
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
    res.json(tenant);

    // Auto-update Messenger whitelist if custom domain changed (fire-and-forget)
    const newDomain = custom_domain?.trim().toLowerCase() || null;
    if (isPro && newDomain !== (current?.custom_domain || null) && current?.fb_page_access_token) {
      setupMessengerProfile(
        current.fb_page_access_token, tenant.name, req.user.tenant_id,
        process.env.APP_URL, current.ig_user_id, newDomain
      ).catch(e => console.warn('[auto-whitelist] messenger profile update failed:', e.message));
    }
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET settings history for own tenant (last 20 snapshots)
router.get('/settings/history', auth, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT id, changed_at, changed_by, snapshot
       FROM tenant_settings_history
       WHERE tenant_id=$1
       ORDER BY changed_at DESC
       LIMIT 20`,
      [req.user.tenant_id]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST restore a specific snapshot (admin)
router.post('/settings/history/:snapshotId/restore', auth, async (req, res) => {
  try {
    const { rows: [entry] } = await db.query(
      `SELECT snapshot FROM tenant_settings_history WHERE id=$1 AND tenant_id=$2`,
      [req.params.snapshotId, req.user.tenant_id]
    );
    if (!entry) return res.status(404).json({ error: 'Snapshot not found' });
    const s = entry.snapshot;
    await db.query(
      `UPDATE tenants SET
         notification_email=$1, contact_number=$2, store_open=$3, store_close=$4,
         booking_cutoff=$5, minimum_order=$6, ai_enabled=$7, ai_instructions=$8,
         ig_user_id=$9, ai_pause_hours=$10, shop_address=$11, qr_image_url=$12,
         custom_domain=$13, white_label=$14, logo_url=$15, payment_mode=$16,
         open_days=$17, google_review_link=$18, review_cooldown_days=$19
       WHERE id=$20`,
      [
        s.notification_email, s.contact_number, s.store_open, s.store_close,
        s.booking_cutoff, s.minimum_order, s.ai_enabled, s.ai_instructions,
        s.ig_user_id, s.ai_pause_hours, s.shop_address, s.qr_image_url,
        s.custom_domain, s.white_label, s.logo_url, s.payment_mode,
        s.open_days, s.google_review_link, s.review_cooldown_days,
        req.user.tenant_id,
      ]
    );
    res.json({ message: 'Settings restored successfully' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST fetch linked Instagram Business Account from the connected Facebook Page
router.post('/settings/instagram-fetch', auth, async (req, res) => {
  try {
    const { rows: [tenant] } = await db.query(
      `SELECT fb_page_id, fb_page_access_token FROM tenants WHERE id=$1`, [req.user.tenant_id]
    );
    if (!tenant?.fb_page_id || !tenant?.fb_page_access_token) {
      return res.status(400).json({ error: 'Connect your Facebook Page first before auto-detecting Instagram.' });
    }
    const igRes = await axios.get(`${GRAPH}/${tenant.fb_page_id}`, {
      params: { fields: 'instagram_business_account', access_token: tenant.fb_page_access_token },
    });
    const igId = igRes.data?.instagram_business_account?.id;
    if (!igId) {
      return res.status(404).json({ error: 'No Instagram Business account linked to this Facebook Page. Make sure your Instagram account is connected to the Page in Meta Business Suite.' });
    }
    // Save it
    await db.query(`UPDATE tenants SET ig_user_id=$1 WHERE id=$2`, [igId, req.user.tenant_id]);
    res.json({ ig_user_id: igId });
  } catch (err) {
    const fbMsg = err.response?.data?.error?.message;
    console.error('[instagram-fetch]', fbMsg || err.message);
    res.status(500).json({ error: fbMsg || 'Failed to fetch Instagram account.' });
  }
});

// POST reset Messenger profile for own tenant (any admin)
router.post('/settings/setup-messenger', auth, async (req, res) => {
  try {
    const { rows: [tenant] } = await db.query(
      `SELECT id, name, fb_page_access_token, ig_user_id, custom_domain FROM tenants WHERE id=$1`, [req.user.tenant_id]
    );
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
    if (!tenant.fb_page_access_token) return res.status(400).json({ error: 'No Facebook page token configured.' });
    const { fbError, igError } = await setupMessengerProfile(tenant.fb_page_access_token, tenant.name, tenant.id, process.env.APP_URL, tenant.ig_user_id, tenant.custom_domain);
    res.json({ fbError: fbError || null, igError: igError || null });
  } catch (err) {
    console.error('[setup-messenger]', err.response?.data || err.message);
    res.status(500).json({ error: err.response?.data?.error?.message || err.message });
  }
});

// POST fetch Facebook Pages the user admins (step 1 of OAuth connect flow)
router.post('/settings/facebook-pages', auth, async (req, res) => {
  const { userToken } = req.body;
  if (!userToken) return res.status(400).json({ error: 'userToken is required' });
  const appId     = process.env.FB_APP_ID;
  const appSecret = process.env.FB_APP_SECRET;
  if (!appId || !appSecret) return res.status(500).json({ error: 'Facebook app credentials not configured on server.' });
  try {
    // Exchange short-lived user token → long-lived user token
    const exchangeRes = await axios.get('https://graph.facebook.com/oauth/access_token', {
      params: { grant_type: 'fb_exchange_token', client_id: appId, client_secret: appSecret, fb_exchange_token: userToken },
    });
    const longLivedToken = exchangeRes.data.access_token;

    // Fetch pages the user admins, including their page access tokens
    const pagesRes = await axios.get(`${GRAPH}/me/accounts`, {
      params: { access_token: longLivedToken, fields: 'id,name,category,access_token' },
    });
    const pages = pagesRes.data.data || [];
    if (pages.length === 0) {
      return res.status(400).json({ error: 'No Facebook Pages found for this account. Make sure you are an Admin of at least one Page.' });
    }

    // Sign page data (including tokens) into a short-lived JWT so tokens stay server-side
    const pageDataToken = jwt.sign(
      { pages, tid: req.user.tenant_id },
      process.env.JWT_SECRET,
      { expiresIn: '5m' }
    );

    // Return only names/IDs — never expose access tokens to the frontend
    res.json({
      pages: pages.map(p => ({ id: p.id, name: p.name, category: p.category })),
      pageDataToken,
    });
  } catch (err) {
    const fbMsg = err.response?.data?.error?.message;
    console.error('[facebook-pages]', fbMsg || err.message);
    res.status(400).json({ error: fbMsg || 'Failed to fetch Facebook Pages. Check your app permissions.' });
  }
});

// POST exchange Facebook OAuth code for pages (redirect-based flow)
router.post('/settings/facebook-oauth-exchange', auth, async (req, res) => {
  const { code, redirectUri } = req.body;
  if (!code || !redirectUri) return res.status(400).json({ error: 'code and redirectUri are required' });
  const appId     = process.env.FB_APP_ID;
  const appSecret = process.env.FB_APP_SECRET;
  if (!appId || !appSecret) return res.status(500).json({ error: 'Facebook app credentials not configured on server.' });
  try {
    // Exchange code for short-lived user token
    const tokenRes = await axios.get('https://graph.facebook.com/v19.0/oauth/access_token', {
      params: { client_id: appId, client_secret: appSecret, redirect_uri: redirectUri, code },
    });
    const shortToken = tokenRes.data.access_token;

    // Exchange short-lived → long-lived user token
    const exchangeRes = await axios.get('https://graph.facebook.com/oauth/access_token', {
      params: { grant_type: 'fb_exchange_token', client_id: appId, client_secret: appSecret, fb_exchange_token: shortToken },
    });
    const longLivedToken = exchangeRes.data.access_token;

    // Fetch personal pages
    const pagesRes = await axios.get(`${GRAPH}/me/accounts`, {
      params: { access_token: longLivedToken, fields: 'id,name,category,access_token' },
    });
    const personalPages = pagesRes.data.data || [];

    // Also fetch pages from Business Portfolios
    let businessPages = [];
    try {
      const bizRes = await axios.get(`${GRAPH}/me/businesses`, {
        params: { access_token: longLivedToken, fields: 'id,name' },
      });
      const businesses = bizRes.data.data || [];
      for (const biz of businesses) {
        try {
          const bPagesRes = await axios.get(`${GRAPH}/${biz.id}/owned_pages`, {
            params: { access_token: longLivedToken, fields: 'id,name,category,access_token' },
          });
          businessPages = businessPages.concat(bPagesRes.data.data || []);
        } catch (e) {
          console.warn(`[facebook-oauth-exchange] failed to fetch pages for business ${biz.id}:`, e.response?.data?.error?.message || e.message);
        }
      }
    } catch (e) {
      console.warn('[facebook-oauth-exchange] failed to fetch businesses:', e.response?.data?.error?.message || e.message);
    }

    // Merge, deduplicate by page id, personal pages take priority (they have tokens)
    const pageMap = new Map();
    for (const p of [...businessPages, ...personalPages]) {
      pageMap.set(p.id, p);
    }
    const pages = Array.from(pageMap.values()).filter(p => p.access_token);
    if (pages.length === 0) return res.status(400).json({ error: 'No Facebook Pages found for this account. Make sure you are an Admin of at least one Page.' });

    const pageDataToken = jwt.sign(
      { pages, tid: req.user.tenant_id },
      process.env.JWT_SECRET,
      { expiresIn: '5m' }
    );
    res.json({ pages: pages.map(p => ({ id: p.id, name: p.name, category: p.category })), pageDataToken });
  } catch (err) {
    const fbMsg = err.response?.data?.error?.message;
    console.error('[facebook-oauth-exchange]', fbMsg || err.message);
    res.status(400).json({ error: fbMsg || 'Failed to exchange Facebook code.' });
  }
});

// POST save selected Facebook Page and run Messenger setup (step 2 of OAuth connect flow)
router.post('/settings/facebook-connect', auth, async (req, res) => {
  const { pageId, pageDataToken } = req.body;
  if (!pageId || !pageDataToken) return res.status(400).json({ error: 'pageId and pageDataToken are required' });
  try {
    console.log('[facebook-connect] step: jwt.verify');
    const payload = jwt.verify(pageDataToken, process.env.JWT_SECRET);
    if (payload.tid !== req.user.tenant_id) return res.status(403).json({ error: 'Token mismatch' });

    console.log('[facebook-connect] step: find page', pageId, 'in', payload.pages?.map(p => p.id));
    const page = payload.pages.find(p => p.id === pageId);
    if (!page) return res.status(400).json({ error: 'Selected page not found in session' });
    console.log('[facebook-connect] page found:', page.name, 'has_token:', !!page.access_token);

    console.log('[facebook-connect] step: db SELECT existing');
    const { rows: [existing] } = await db.query(
      `SELECT custom_domain, ig_user_id FROM tenants WHERE id=$1`, [req.user.tenant_id]
    );
    console.log('[facebook-connect] step: db UPDATE tenant');
    const { rows: [tenant] } = await db.query(
      `UPDATE tenants SET fb_page_id=$1, fb_page_access_token=$2 WHERE id=$3 RETURNING id, name`,
      [page.id, page.access_token, req.user.tenant_id]
    );
    console.log('[facebook-connect] db updated, tenant:', tenant?.name);

    try {
      console.log('[facebook-connect] step: setupMessengerProfile');
      await setupMessengerProfile(page.access_token, tenant.name, req.user.tenant_id, process.env.APP_URL, existing?.ig_user_id, existing?.custom_domain);
    } catch (e) {
      console.warn('[facebook-connect] messenger profile setup failed:', e.message);
    }

    res.json({ success: true, pageName: page.name });
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      return res.status(400).json({ error: 'Session expired — please try connecting again.' });
    }
    console.error('[facebook-connect] CAUGHT ERROR:', err.name, err.message, err.stack);
    res.status(500).json({ error: `[${err.name}] ${err.message}` });
  }
});

// GET validate the stored Facebook page token against Graph API
router.get('/settings/facebook-status', auth, async (req, res) => {
  try {
    const { rows: [tenant] } = await db.query(
      `SELECT fb_page_id, fb_page_access_token FROM tenants WHERE id=$1`, [req.user.tenant_id]
    );
    if (!tenant?.fb_page_access_token) {
      return res.json({ connected: false, reason: 'no_token' });
    }
    const { data } = await axios.get('https://graph.facebook.com/v19.0/me', {
      params: { fields: 'id,name', access_token: tenant.fb_page_access_token },
      timeout: 5000,
    });
    res.json({ connected: true, page_name: data.name, page_id: data.id });
  } catch (err) {
    const fbError = err.response?.data?.error?.message;
    res.json({ connected: false, reason: 'invalid_token', fb_error: fbError || err.message });
  }
});

// GET all tenants (superadmin only)
router.get('/', auth, superadminOnly, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT t.id, t.name, t.fb_page_id, t.fb_page_access_token, t.xendit_api_key, t.logo_url, t.active, t.created_at, t.plan, t.ai_daily_cap,
              COUNT(o.id)::int AS total_orders,
              COALESCE(SUM(CASE WHEN o.paid THEN o.price ELSE 0 END), 0) AS total_revenue
       FROM tenants t
       LEFT JOIN orders o ON o.tenant_id = t.id
       GROUP BY t.id
       ORDER BY t.created_at DESC`
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET single tenant
router.get('/:id', auth, superadminOnly, async (req, res) => {
  try {
    const { rows: [tenant] } = await db.query(
      `SELECT id, name, fb_page_id, fb_page_access_token, xendit_api_key, logo_url, active, created_at, plan FROM tenants WHERE id=$1`,
      [req.params.id]
    );
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
    res.json(tenant);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST create tenant
router.post('/', auth, superadminOnly, async (req, res) => {
  const { name, fb_page_id, fb_page_access_token, xendit_api_key, logo_url } = req.body;
  try {
    const { rows } = await db.query(
      `INSERT INTO tenants (name, fb_page_id, fb_page_access_token, xendit_api_key, logo_url, subscription_status, trial_ends_at)
       VALUES ($1, $2, $3, $4, $5, 'trial', NOW() + INTERVAL '14 days')
       RETURNING id, name, fb_page_id, logo_url, active, created_at`,
      [name, fb_page_id, fb_page_access_token, xendit_api_key, logo_url]
    );
    // Auto-setup Messenger profile for the new page
    try { await setupMessengerProfile(fb_page_access_token, name, rows[0].id, process.env.APP_URL); } catch (e) { console.warn('[tenant] messenger profile setup failed:', e.message); }
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST setup Messenger profile manually (Get Started, greeting, persistent menu)
router.post('/:id/setup-messenger', auth, superadminOnly, async (req, res) => {
  try {
    const { rows: [tenant] } = await db.query(
      `SELECT name, fb_page_access_token, ig_user_id, custom_domain FROM tenants WHERE id=$1`, [req.params.id]
    );
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
    await setupMessengerProfile(tenant.fb_page_access_token, tenant.name, req.params.id, process.env.APP_URL, tenant.ig_user_id, tenant.custom_domain);
    res.json({ message: 'Messenger profile configured successfully' });
  } catch (err) {
    console.error('[setup-messenger]', err.response?.data || err.message);
    res.status(500).json({ error: err.response?.data?.error?.message || err.message });
  }
});

const PLAN_AI_CAPS = { starter: 300, growth: 1500, pro: 9999 };

// PATCH update tenant plan (superadmin)
router.patch('/:id/plan', auth, superadminOnly, async (req, res) => {
  const { plan, subscription_status } = req.body;
  const validPlans = ['starter', 'growth', 'pro'];
  const validStatuses = ['trial', 'active', 'expired', 'cancelled'];
  if (plan && !validPlans.includes(plan)) return res.status(400).json({ error: 'Invalid plan' });
  if (subscription_status && !validStatuses.includes(subscription_status)) return res.status(400).json({ error: 'Invalid status' });
  try {
    const updates = [];
    const vals = [];
    if (plan) {
      updates.push(`plan=$${vals.length+1}`); vals.push(plan);
      updates.push(`ai_daily_cap=$${vals.length+1}`); vals.push(PLAN_AI_CAPS[plan]);
    }
    if (subscription_status) { updates.push(`subscription_status=$${vals.length+1}`); vals.push(subscription_status); }
    if (!updates.length) return res.status(400).json({ error: 'Nothing to update' });
    vals.push(req.params.id);
    await db.query(`UPDATE tenants SET ${updates.join(',')} WHERE id=$${vals.length}`, vals);
    res.json({ message: 'Updated' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT update tenant
router.put('/:id', auth, superadminOnly, async (req, res) => {
  const { name, fb_page_id, fb_page_access_token, xendit_api_key, logo_url, active, ai_daily_cap } = req.body;
  try {
    const { rows: [before] } = await db.query(
      `SELECT fb_page_access_token, ig_user_id, custom_domain FROM tenants WHERE id=$1`, [req.params.id]
    );
    const { rows } = await db.query(
      `UPDATE tenants SET name=$1, fb_page_id=$2, fb_page_access_token=$3,
                          xendit_api_key=$4, logo_url=$5, active=$6,
                          ai_daily_cap=COALESCE($8, ai_daily_cap)
       WHERE id=$7
       RETURNING id, name, fb_page_id, logo_url, active, created_at, ai_daily_cap`,
      [name, fb_page_id, fb_page_access_token, xendit_api_key, logo_url, active, req.params.id,
       ai_daily_cap != null ? Number(ai_daily_cap) : null]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Tenant not found' });
    res.json(rows[0]);

    // Re-setup Messenger profile when the token changes
    if (fb_page_access_token && fb_page_access_token !== before?.fb_page_access_token) {
      setupMessengerProfile(fb_page_access_token, rows[0].name, req.params.id, process.env.APP_URL, before?.ig_user_id, before?.custom_domain)
        .catch(e => console.warn('[tenant-update] messenger profile setup failed:', e.message));
    }
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST clone data from one tenant to another
router.post('/clone-services', auth, superadminOnly, async (req, res) => {
  const { source_tenant_id, target_tenant_id, clear_existing, clone_options } = req.body;
  if (!source_tenant_id || !target_tenant_id) {
    return res.status(400).json({ error: 'source_tenant_id and target_tenant_id are required' });
  }
  if (source_tenant_id === target_tenant_id) {
    return res.status(400).json({ error: 'Source and target branches must be different' });
  }

  const opts = {
    services:       clone_options?.services       !== false,
    settings:       clone_options?.settings       || false,
    faqs:           clone_options?.faqs           || false,
    delivery_zones: clone_options?.delivery_zones !== false,
  };

  if (!opts.services && !opts.settings && !opts.faqs && !opts.delivery_zones) {
    return res.status(400).json({ error: 'Select at least one item to clone.' });
  }

  let client;
  try {
    client = await db.pool.connect();
    await client.query('BEGIN');

    const { rows: tenantCheck } = await client.query(
      `SELECT id FROM tenants WHERE id = ANY($1)`, [[source_tenant_id, target_tenant_id]]
    );
    if (tenantCheck.length < 2) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'One or both branches not found' });
    }

    const stats = { categories: 0, services: 0, custom_fields: 0, delivery_zones: 0, faqs: 0 };

    // ── Clone services + categories ───────────────────────────────────
    if (opts.services) {
      if (clear_existing) {
        await client.query(`DELETE FROM services WHERE tenant_id = $1`, [target_tenant_id]);
        await client.query(`DELETE FROM service_categories WHERE tenant_id = $1`, [target_tenant_id]);
      }

      const { rows: sourceCats } = await client.query(
        `SELECT * FROM service_categories WHERE tenant_id = $1 ORDER BY sort_order ASC, id ASC`,
        [source_tenant_id]
      );
      const catIdMap = {};
      for (const cat of sourceCats) {
        const { rows: [newCat] } = await client.query(
          `INSERT INTO service_categories (tenant_id, name, sort_order, active)
           VALUES ($1,$2,$3,$4) RETURNING id`,
          [target_tenant_id, cat.name, cat.sort_order, cat.active]
        );
        catIdMap[cat.id] = newCat.id;
      }
      stats.categories = sourceCats.length;

      const { rows: sourceSvcs } = await client.query(
        `SELECT * FROM services WHERE tenant_id = $1 ORDER BY sort_order ASC, id ASC`,
        [source_tenant_id]
      );
      for (const svc of sourceSvcs) {
        const newCategoryId = svc.category_id ? (catIdMap[svc.category_id] || null) : null;
        const { rows: [newSvc] } = await client.query(
          `INSERT INTO services
             (tenant_id, name, price, unit, description, active, category_id, sort_order, image_url)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
          [target_tenant_id, svc.name, svc.price, svc.unit, svc.description,
           svc.active, newCategoryId, svc.sort_order, svc.image_url]
        );
        stats.services++;
        const { rows: fields } = await client.query(
          `SELECT * FROM service_custom_fields WHERE service_id = $1 ORDER BY sort_order ASC`,
          [svc.id]
        );
        for (const f of fields) {
          await client.query(
            `INSERT INTO service_custom_fields
               (service_id, label, field_type, placeholder, required, sort_order, options,
                min_value, max_value, unit_price, allow_own, linked_to_field_label, linked_to_value, sync_qty)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
            [newSvc.id, f.label, f.field_type, f.placeholder, f.required, f.sort_order,
             f.options != null ? JSON.stringify(f.options) : null,
             f.min_value, f.max_value, f.unit_price,
             f.allow_own ?? false, f.linked_to_field_label ?? null, f.linked_to_value ?? null, f.sync_qty ?? false]
          );
          stats.custom_fields++;
        }
      }
    }

    // ── Clone delivery zones ──────────────────────────────────────────
    if (opts.delivery_zones) {
      if (clear_existing) {
        await client.query(`DELETE FROM delivery_zones WHERE tenant_id = $1`, [target_tenant_id]);
        await client.query(`DELETE FROM delivery_brackets WHERE tenant_id = $1`, [target_tenant_id]);
      }

      const { rows: sourceZones } = await client.query(
        `SELECT * FROM delivery_zones WHERE tenant_id = $1 ORDER BY sort_order ASC, id ASC`,
        [source_tenant_id]
      );
      for (const z of sourceZones) {
        await client.query(
          `INSERT INTO delivery_zones (tenant_id, name, fee, active, sort_order, custom_note)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [target_tenant_id, z.name, z.fee, z.active, z.sort_order, z.custom_note]
        );
        stats.delivery_zones++;
      }

      const { rows: sourceBrackets } = await client.query(
        `SELECT * FROM delivery_brackets WHERE tenant_id = $1 ORDER BY min_km ASC`,
        [source_tenant_id]
      );
      for (const b of sourceBrackets) {
        await client.query(
          `INSERT INTO delivery_brackets (tenant_id, min_km, max_km, fee, sort_order)
           VALUES ($1,$2,$3,$4,$5)`,
          [target_tenant_id, b.min_km, b.max_km, b.fee, b.sort_order]
        );
      }
    }

    // ── Clone settings ────────────────────────────────────────────────
    if (opts.settings) {
      const { rows: [src] } = await client.query(
        `SELECT store_open, store_close, booking_cutoff, minimum_order,
                ai_enabled, ai_instructions, contact_number,
                delivery_note, delivery_radius, shop_address, shop_lat, shop_lng
         FROM tenants WHERE id=$1`, [source_tenant_id]
      );
      await client.query(
        `UPDATE tenants SET
           store_open      = COALESCE($1, store_open),
           store_close     = COALESCE($2, store_close),
           booking_cutoff  = COALESCE($3, booking_cutoff),
           minimum_order   = COALESCE($4, minimum_order),
           ai_enabled      = $5,
           ai_instructions = COALESCE($6, ai_instructions),
           contact_number  = COALESCE($7, contact_number),
           delivery_note   = COALESCE($8, delivery_note),
           delivery_radius = COALESCE($9, delivery_radius),
           shop_address    = COALESCE($10, shop_address),
           shop_lat        = COALESCE($11, shop_lat),
           shop_lng        = COALESCE($12, shop_lng)
         WHERE id=$13`,
        [src.store_open, src.store_close, src.booking_cutoff, src.minimum_order,
         src.ai_enabled, src.ai_instructions, src.contact_number,
         src.delivery_note, src.delivery_radius, src.shop_address, src.shop_lat, src.shop_lng,
         target_tenant_id]
      );
    }

    // ── Clone FAQs ────────────────────────────────────────────────────
    if (opts.faqs) {
      if (clear_existing) {
        await client.query(`DELETE FROM faqs WHERE tenant_id = $1`, [target_tenant_id]);
      }
      const { rows: sourceFaqs } = await client.query(
        `SELECT * FROM faqs WHERE tenant_id = $1 ORDER BY sort_order ASC, id ASC`,
        [source_tenant_id]
      );
      for (const f of sourceFaqs) {
        await client.query(
          `INSERT INTO faqs (tenant_id, question, answer, active, sort_order)
           VALUES ($1,$2,$3,$4,$5)`,
          [target_tenant_id, f.question, f.answer, f.active, f.sort_order]
        );
        stats.faqs++;
      }
    }

    await client.query('COMMIT');

    const { rows: [sourceTenant] } = await db.query(`SELECT name FROM tenants WHERE id=$1`, [source_tenant_id]);
    const { rows: [targetTenant] } = await db.query(`SELECT name FROM tenants WHERE id=$1`, [target_tenant_id]);

    res.json({
      message: `Successfully cloned from "${sourceTenant.name}" to "${targetTenant.name}"`,
      stats,
    });
  } catch (err) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    console.error('[clone-services]', err.message);
    res.status(500).json({ error: err.message });
  } finally {
    if (client) client.release();
  }
});

// DELETE tenant
router.delete('/:id', auth, superadminOnly, async (req, res) => {
  try {
    await db.query(`DELETE FROM tenants WHERE id=$1`, [req.params.id]);
    res.json({ message: 'Tenant deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
