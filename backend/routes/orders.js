const router = require('express').Router();
const auth = require('../middleware/auth');
const db = require('../db');

// GET all orders for tenant
router.get('/', auth, async (req, res) => {
  try {
    const { status, page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;
    let query = `
      SELECT o.*, c.name as customer_name, c.phone as customer_phone, c.address as customer_address, s.name as service_name
      FROM orders o
      LEFT JOIN customers c ON c.id = o.customer_id
      LEFT JOIN services s ON s.id = o.service_id
      WHERE o.tenant_id = $1
    `;
    const params = [req.user.tenant_id];
    if (status) { query += ` AND o.status = $${params.length + 1}`; params.push(status); }
    query += ` ORDER BY o.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);
    const { rows } = await db.query(query, params);
    res.json(rows);
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

// PATCH update order status / notes
router.patch('/:id', auth, async (req, res) => {
  const { status, notes, paid } = req.body;
  try {
    const fields = [];
    const params = [];
    if (status !== undefined) { fields.push(`status = $${params.length + 1}`); params.push(status); }
    if (notes !== undefined)  { fields.push(`notes = $${params.length + 1}`); params.push(notes); }
    if (paid !== undefined)   { fields.push(`paid = $${params.length + 1}`); params.push(paid); }
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
