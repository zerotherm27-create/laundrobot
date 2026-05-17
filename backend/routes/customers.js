const router = require('express').Router();
const auth = require('../middleware/auth');
const db = require('../db');

// GET all customers for tenant
router.get('/', auth, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT c.*,
              COUNT(o.id)::int AS total_orders,
              COALESCE(SUM(CASE WHEN o.paid THEN o.price ELSE 0 END), 0) AS total_spent,
              MAX(o.created_at) AS last_order_at
       FROM customers c
       LEFT JOIN orders o ON o.customer_id = c.id
       WHERE c.tenant_id = $1
       GROUP BY c.id
       ORDER BY c.created_at DESC`,
      [req.user.tenant_id]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET single customer with order history
router.get('/:id', auth, async (req, res) => {
  try {
    const { rows: [customer] } = await db.query(
      `SELECT * FROM customers WHERE id=$1 AND tenant_id=$2`,
      [req.params.id, req.user.tenant_id]
    );
    if (!customer) return res.status(404).json({ error: 'Customer not found' });
    const { rows: orders } = await db.query(
      `SELECT o.*, s.name as service_name FROM orders o
       LEFT JOIN services s ON s.id = o.service_id
       WHERE o.customer_id=$1 ORDER BY o.created_at DESC`,
      [req.params.id]
    );
    res.json({ ...customer, orders });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH update customer info
router.patch('/:id', auth, async (req, res) => {
  const { name, phone, address, has_reviewed } = req.body;
  try {
    const fields = [];
    const params = [];
    if (name         !== undefined) { fields.push(`name=$${params.length+1}`);         params.push(name); }
    if (phone        !== undefined) { fields.push(`phone=$${params.length+1}`);        params.push(phone); }
    if (address      !== undefined) { fields.push(`address=$${params.length+1}`);      params.push(address); }
    if (has_reviewed !== undefined) { fields.push(`has_reviewed=$${params.length+1}`); params.push(!!has_reviewed); }
    if (!fields.length) return res.status(400).json({ error: 'Nothing to update' });
    params.push(req.params.id, req.user.tenant_id);
    const { rows } = await db.query(
      `UPDATE customers SET ${fields.join(', ')} WHERE id=$${params.length-1} AND tenant_id=$${params.length} RETURNING *`,
      params
    );
    if (!rows[0]) return res.status(404).json({ error: 'Customer not found' });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE customer
router.delete('/:id', auth, async (req, res) => {
  try {
    const { rowCount } = await db.query(
      `DELETE FROM customers WHERE id=$1 AND tenant_id=$2`,
      [req.params.id, req.user.tenant_id]
    );
    if (!rowCount) return res.status(404).json({ error: 'Customer not found' });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
