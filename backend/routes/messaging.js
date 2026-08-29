const router = require('express').Router();
const auth = require('../middleware/auth');
const db = require('../db');
const { sendMessage } = require('../utils/messenger');

router.post('/blast', auth, async (req, res) => {
  if (!['admin','superadmin'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const { message, filter_status } = req.body;
  const tenantId = req.user.tenant_id;
  try {
    const { rows: [tenant] } = await db.query(
      'SELECT fb_page_access_token, plan FROM tenants WHERE id=$1', [tenantId]
    );
    if (!['growth', 'pro'].includes(tenant?.plan)) {
      return res.status(403).json({ error: 'Blast messaging requires the Growth plan or higher.' });
    }
    let customers;
    if (filter_status === 'subscribed') {
      const { rows } = await db.query(
        `SELECT fb_id, name, '' as order_id, '' as status
         FROM customers WHERE tenant_id=$1 AND promo_subscribed=TRUE AND fb_id IS NOT NULL`,
        [tenantId]
      );
      customers = rows;
    } else {
      let query = `SELECT DISTINCT ON (c.fb_id) c.fb_id, c.name, o.id as order_id, o.status
                   FROM customers c JOIN orders o ON o.customer_id=c.id
                   WHERE c.tenant_id=$1 AND c.fb_id IS NOT NULL`;
      const params = [tenantId];
      if (filter_status) { query += ` AND o.status=$2`; params.push(filter_status); }
      const { rows } = await db.query(query, params);
      customers = rows;
    }
    let sent = 0;
    for (const c of customers) {
      if (!c.fb_id) continue;
      const text = message
        .replace('{name}', c.name || 'Customer')
        .replace('{order_id}', c.order_id || '')
        .replace('{status}', c.status || '')
        .replace('{pickup_time}', c.pickup_time || '');
      try {
        await sendMessage(tenant.fb_page_access_token, c.fb_id, text);
        sent++;
      } catch (e) {
        console.warn(`[blast] failed to send to ${c.fb_id}:`, e.response?.data?.error?.message || e.message);
      }
    }
    await db.query(
      'INSERT INTO blast_logs (tenant_id, message, filter_status, sent_count) VALUES ($1,$2,$3,$4)',
      [tenantId, message, filter_status || 'ALL', sent]
    );
    res.json({ sent });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

// ── Manual shop announcement ──────────────────────────────────────────────
// Customers with a live booking, deduped by fb_id. Messenger only: there is no
// `channel` column on conversations and no IG blast path, so IG customers see
// the announcement passively (booking page banner + AI context) instead.
const ANNOUNCEMENT_AUDIENCE = `
  FROM customers c JOIN orders o ON o.customer_id = c.id
  WHERE c.tenant_id = $1 AND c.fb_id IS NOT NULL
    AND o.status NOT IN ('COMPLETED', 'CANCELLED')`;

// How many customers a "Notify customers" click would attempt — shown in the
// confirmation dialog. Not all of them are reachable (see the 24h note below).
router.get('/announcement/recipients', auth, async (req, res) => {
  try {
    const { rows: [row] } = await db.query(
      `SELECT COUNT(DISTINCT c.fb_id)::int AS count ${ANNOUNCEMENT_AUDIENCE}`,
      [req.user.tenant_id]
    );
    res.json({ count: row?.count || 0 });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

router.post('/announcement/send', auth, async (req, res) => {
  if (!['admin','superadmin'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const tenantId = req.user.tenant_id;
  try {
    const { rows: [tenant] } = await db.query(
      'SELECT fb_page_access_token, plan, announcement, announcement_enabled FROM tenants WHERE id=$1',
      [tenantId]
    );
    if (!['growth', 'pro'].includes(tenant?.plan)) {
      return res.status(403).json({ error: 'Blast messaging requires the Growth plan or higher.' });
    }
    const text = (tenant.announcement || '').trim();
    if (!tenant.announcement_enabled || !text) {
      return res.status(400).json({ error: 'Turn the announcement on and save it before notifying customers.' });
    }
    if (!tenant.fb_page_access_token) {
      return res.status(400).json({ error: 'Connect your Facebook Page before notifying customers.' });
    }

    const { rows: customers } = await db.query(
      `SELECT DISTINCT ON (c.fb_id) c.fb_id, c.name ${ANNOUNCEMENT_AUDIENCE}`,
      [tenantId]
    );

    let sent = 0, skipped = 0;
    for (const c of customers) {
      try {
        await sendMessage(tenant.fb_page_access_token, c.fb_id, text.replace('{name}', c.name || 'Customer'));
        sent++;
      } catch (e) {
        // Error 10 = outside Meta's 24h messaging window. There is no compliant
        // tag for a general announcement (the approved utility template is
        // order-status specific), so these are genuinely unreachable — report
        // them as skipped rather than counting them as delivered.
        const code = e.response?.data?.error?.code;
        if (code === 10) skipped++;
        else {
          skipped++;
          console.warn(`[announcement] failed to send to ${c.fb_id}:`, e.response?.data?.error?.message || e.message);
        }
      }
    }
    await db.query(
      'INSERT INTO blast_logs (tenant_id, message, filter_status, sent_count) VALUES ($1,$2,$3,$4)',
      [tenantId, text, 'ANNOUNCEMENT', sent]
    );
    res.json({ sent, skipped, total: customers.length });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

router.get('/blast/history', auth, async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT * FROM blast_logs WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT 20',
      [req.user.tenant_id]
    );
    res.json(rows);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

module.exports = router;