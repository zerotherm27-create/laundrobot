const router = require('express').Router();
const auth   = require('../middleware/auth');
const db     = require('../db');

router.get('/', auth, async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT * FROM delivery_zones WHERE tenant_id=$1 ORDER BY sort_order, id',
      [req.user.tenant_id]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', auth, async (req, res) => {
  const { name, fee, active = true, sort_order = 0 } = req.body;
  if (!name || fee == null) return res.status(400).json({ error: 'name and fee are required' });
  try {
    const { rows } = await db.query(
      'INSERT INTO delivery_zones (tenant_id,name,fee,active,sort_order) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [req.user.tenant_id, name, fee, active, sort_order]
    );
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', auth, async (req, res) => {
  const { name, fee, active, sort_order } = req.body;
  try {
    const { rows } = await db.query(
      `UPDATE delivery_zones SET name=$1, fee=$2, active=$3, sort_order=$4
       WHERE id=$5 AND tenant_id=$6 RETURNING *`,
      [name, fee, active, sort_order, req.params.id, req.user.tenant_id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    await db.query('DELETE FROM delivery_zones WHERE id=$1 AND tenant_id=$2', [req.params.id, req.user.tenant_id]);
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
