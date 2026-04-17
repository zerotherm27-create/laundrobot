const router = require('express').Router();
const auth = require('../middleware/auth');
const db = require('../db');
const { sendTaggedMessage } = require('../utils/messenger');

// GET all orders for tenant (archived=true to fetch archives)
router.get('/', auth, async (req, res) => {
  try {
    const { status, page = 1, limit = 200, archived = 'false' } = req.query;
    const offset = (page - 1) * limit;
    const isArchived = archived === 'true';
    let query = `
      SELECT o.*, c.name as customer_name, c.phone as customer_phone, c.address as customer_address, s.name as service_name
      FROM orders o
      LEFT JOIN customers c ON c.id = o.customer_id
      LEFT JOIN services s ON s.id = o.service_id
      WHERE o.tenant_id = $1 AND o.archived = $2
    `;
    const params = [req.user.tenant_id, isArchived];
    if (status) { query += ` AND o.status = $${params.length + 1}`; params.push(status); }
    query += ` ORDER BY o.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);
    const { rows } = await db.query(query, params);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST archive completed orders for a given month (or auto by cron)
router.post('/archive-month', auth, async (req, res) => {
  const { year, month } = req.body; // month = 1-12
  if (!year || !month) return res.status(400).json({ error: 'year and month required' });
  try {
    const { rowCount } = await db.query(
      `UPDATE orders SET archived=TRUE, archived_at=NOW()
       WHERE tenant_id=$1 AND status='COMPLETED' AND archived=FALSE
         AND date_part('year', created_at)=$2 AND date_part('month', created_at)=$3`,
      [req.user.tenant_id, year, month]
    );
    res.json({ archived: rowCount });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET single order
router.get('/:id', auth, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT o.*, c.name as customer_name, c.phone as customer_phone, c.fb_id, c.address as customer_address,
              s.name as service_name
       FROM orders o
       LEFT JOIN customers c ON c.id = o.customer_id
       LEFT JOIN services s ON s.id = o.service_id
       WHERE o.id = $1 AND o.tenant_id = $2`,
      [req.params.id, req.user.tenant_id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Order not found' });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH update order status / notes / service / price
router.patch('/:id', auth, async (req, res) => {
  const { status, notes, paid, service_id, weight, price } = req.body;
  try {
    const fields = [];
    const params = [];
    if (status     !== undefined) { fields.push(`status = $${params.length + 1}`);     params.push(status); }
    if (notes      !== undefined) { fields.push(`notes = $${params.length + 1}`);      params.push(notes); }
    if (paid       !== undefined) { fields.push(`paid = $${params.length + 1}`);       params.push(paid); }
    if (service_id !== undefined) { fields.push(`service_id = $${params.length + 1}`); params.push(service_id); }
    if (weight     !== undefined) { fields.push(`weight = $${params.length + 1}`);     params.push(weight || null); }
    if (price      !== undefined) { fields.push(`price = $${params.length + 1}`);      params.push(price); }
    if (!fields.length) return res.status(400).json({ error: 'Nothing to update' });
    params.push(req.params.id, req.user.tenant_id);
    const { rows } = await db.query(
      `UPDATE orders SET ${fields.join(', ')} WHERE id = $${params.length - 1} AND tenant_id = $${params.length} RETURNING *`,
      params
    );
    if (!rows[0]) return res.status(404).json({ error: 'Order not found' });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST send order-update notification to customer via Messenger
router.post('/:id/notify-update', auth, async (req, res) => {
  const { old_price, new_price, new_service_name, message_override } = req.body;
  try {
    // Load order + customer fb_id + tenant token
    const { rows: [order] } = await db.query(
      `SELECT o.*, c.name AS customer_name, c.fb_id, s.name AS service_name
       FROM orders o
       LEFT JOIN customers c ON c.id = o.customer_id
       LEFT JOIN services s ON s.id = o.service_id
       WHERE o.id=$1 AND o.tenant_id=$2`,
      [req.params.id, req.user.tenant_id]
    );
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (!order.fb_id) return res.status(400).json({ error: 'Customer has no Messenger account linked — order was placed via web form.' });

    const { rows: [tenant] } = await db.query(
      `SELECT name, fb_page_access_token FROM tenants WHERE id=$1`, [req.user.tenant_id]
    );
    if (!tenant?.fb_page_access_token) return res.status(400).json({ error: 'Messenger not configured for this branch.' });

    const diff = Number(new_price) - Number(old_price);
    const svcName = new_service_name || order.service_name;

    let text;
    if (message_override?.trim()) {
      text = message_override.trim();
    } else {
      text = `📋 Order Update — ${order.id}\n\n`;
      text += `Hi ${order.customer_name || 'there'}! Your order has been updated by our team.\n\n`;
      text += `Service: ${svcName}\n`;
      text += `Updated Price: ₱${Number(new_price).toLocaleString('en-PH')}\n`;
      if (diff > 0) {
        text += `\n⚠️ Additional amount to settle: ₱${diff.toLocaleString('en-PH')}\n`;
        text += `Please coordinate with us to process the balance.`;
      } else if (diff < 0) {
        text += `\n✅ Price adjustment: ₱${Math.abs(diff).toLocaleString('en-PH')} less than original.\n`;
        text += `We will process the difference accordingly.`;
      } else {
        text += `\nNo price difference — your total remains the same.`;
      }
    }

    await sendTaggedMessage(tenant.fb_page_access_token, order.fb_id, text);
    res.json({ ok: true, sent_to: order.fb_id });
  } catch (err) {
    console.error('[notify-update]', err.response?.data || err.message);
    res.status(500).json({ error: err.response?.data?.error?.message || err.message });
  }
});

// DELETE order
router.delete('/:id', auth, async (req, res) => {
  try {
    await db.query(
      `DELETE FROM orders WHERE id = $1 AND tenant_id = $2`,
      [req.params.id, req.user.tenant_id]
    );
    res.json({ message: 'Order deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
