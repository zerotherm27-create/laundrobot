const router = require('express').Router();
const auth = require('../middleware/auth');
const db = require('../db');

// GET all services for tenant
router.get('/', auth, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT * FROM services WHERE tenant_id = $1 ORDER BY name`,
      [req.user.tenant_id]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST create service
router.post('/', auth, async (req, res) => {
  const { name, price, unit, description } = req.body;
  try {
    const { rows } = await db.query(
      `INSERT INTO services (tenant_id, name, price, unit, description)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [req.user.tenant_id, name, price, unit || 'per kg', description]
    );
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT update service
router.put('/:id', auth, async (req, res) => {
  const { name, price, unit, description, active } = req.body;
  try {
    const { rows } = await db.query(
      `UPDATE services SET name=$1, price=$2, unit=$3, description=$4, active=$5
       WHERE id=$6 AND tenant_id=$7 RETURNING *`,
      [name, price, unit, description, active, req.params.id, req.user.tenant_id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Service not found' });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE service
router.delete('/:id', auth, async (req, res) => {
  try {
    await db.query(
      `DELETE FROM services WHERE id=$1 AND tenant_id=$2`,
      [req.params.id, req.user.tenant_id]
    );
    res.json({ message: 'Service deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
