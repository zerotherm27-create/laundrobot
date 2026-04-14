const router = require('express').Router();
const auth = require('../middleware/auth');
const db = require('../db');

// GET all services for tenant (with category info)
router.get('/', auth, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT s.*, c.name AS category_name
       FROM services s
       LEFT JOIN service_categories c ON c.id = s.category_id
       WHERE s.tenant_id = $1
       ORDER BY c.sort_order ASC NULLS LAST, s.sort_order ASC, s.name ASC`,
      [req.user.tenant_id]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST create service
router.post('/', auth, async (req, res) => {
  const { name, price, unit, description, category_id, sort_order, image_url } = req.body;
  try {
    const { rows } = await db.query(
      `INSERT INTO services (tenant_id, name, price, unit, description, category_id, sort_order, image_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [req.user.tenant_id, name, price, unit || 'per kg', description, category_id || null, sort_order || 0, image_url || null]
    );
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT update service
router.put('/:id', auth, async (req, res) => {
  const { name, price, unit, description, active, category_id, sort_order, image_url } = req.body;
  try {
    const { rows } = await db.query(
      `UPDATE services SET name=$1, price=$2, unit=$3, description=$4, active=$5,
                           category_id=$6, sort_order=$7, image_url=$8
       WHERE id=$9 AND tenant_id=$10 RETURNING *`,
      [name, price, unit, description, active, category_id || null, sort_order || 0, image_url || null, req.params.id, req.user.tenant_id]
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
