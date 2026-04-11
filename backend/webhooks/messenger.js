cd ~/laundrobot/backend/routes
rm messaging.js
cat > messaging.js << 'EOF'
const router = require('express').Router();
const auth = require('../middleware/auth');
const db = require('../db');
const { sendMessage } = require('../utils/messenger');

router.post('/blast', auth, async (req, res) => {
  const { message, filter_status } = req.body;
  const tenantId = req.user.tenant_id;
  try {
    const { rows: [tenant] } = await db.query(
      'SELECT fb_page_access_token FROM tenants WHERE id=$1', [tenantId]
    );
    let query = 'SELECT DISTINCT c.fb_id, c.name, o.id as order_id, o.status, o.pickup_date FROM customers c JOIN orders o ON o.customer_id = c.id WHERE c.tenant_id = $1';
    const params = [tenantId];
    if (filter_status) { query += ' AND o.status = $2'; params.push(filter_status); }
    const { rows: customers } = await db.query(query, params);
    let sent = 0;
    for (const c of customers) {
      const text = message
        .replace('{name}', c.name || 'Customer')
        .replace('{order_id}', c.order_id)
        .replace('{status}', c.status)
        .replace('{pickup_time}', c.pickup_date ? new Date(c.pickup_date).toLocaleString() : '');
      await sendMessage(tenant.fb_page_access_token, c.fb_id, text);
      sent++;
    }
    await db.query(
      'INSERT INTO blast_logs (tenant_id, message, filter_status, sent_count) VALUES ($1,$2,$3,$4)',
      [tenantId, message, filter_status || 'ALL', sent]
    );
    res.json({ sent });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/blast/history', auth, async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT * FROM blast_logs WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT 20',
      [req.user.tenant_id]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
EOF