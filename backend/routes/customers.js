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
  const { name, phone, address } = req.body;
  try {
    const { rows } = await db.query(
      `UPDATE customers SET name=$1, phone=$2, address=$3
       WHERE id=$4 AND tenant_id=$5 RETURNING *`,
      [name, phone, address, req.params.id, req.user.tenant_id]
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
