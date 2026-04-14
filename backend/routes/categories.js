const router = require('express').Router();
const auth = require('../middleware/auth');
const db = require('../db');

// GET all categories for tenant
router.get('/', auth, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT c.*, COUNT(s.id) AS service_count
       FROM service_categories c
       LEFT JOIN services s ON s.category_id = c.id AND s.active = TRUE
       WHERE c.tenant_id = $1
       GROUP BY c.id
       ORDER BY c.sort_order ASC, c.created_at ASC`,
      [req.user.tenant_id]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST create category
router.post('/', auth, async (req, res) => {
  const { name, sort_order } = req.body;
  try {
    const { rows } = await db.query(
      `INSERT INTO service_categories (tenant_id, name, sort_order)
       VALUES ($1, $2, $3) RETURNING *`,
      [req.user.tenant_id, name, sort_order || 0]
    );
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT update category
router.put('/:id', auth, async (req, res) => {
  const { name, sort_order, active } = req.body;
  try {
    const { rows } = await db.query(
      `UPDATE service_categories SET name=$1, sort_order=$2, active=$3
       WHERE id=$4 AND tenant_id=$5 RETURNING *`,
      [name, sort_order ?? 0, active ?? true, req.params.id, req.user.tenant_id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Category not found' });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE category
router.delete('/:id', auth, async (req, res) => {
  try {
    // Unassign services first
    await db.query(
      `UPDATE services SET category_id = NULL WHERE category_id = $1 AND tenant_id = $2`,
      [req.params.id, req.user.tenant_id]
    );
    await db.query(
      `DELETE FROM service_categories WHERE id=$1 AND tenant_id=$2`,
      [req.params.id, req.user.tenant_id]
    );
    res.json({ message: 'Category deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
