const router = require('express').Router();
const auth   = require('../middleware/auth');
const db     = require('../db');

router.get('/', auth, async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT * FROM blocked_dates WHERE tenant_id=$1 ORDER BY date ASC',
      [req.user.tenant_id]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', auth, async (req, res) => {
  const { date, reason } = req.body;
  if (!date) return res.status(400).json({ error: 'date is required' });
  try {
    const { rows } = await db.query(
      'INSERT INTO blocked_dates (tenant_id, date, reason) VALUES ($1,$2,$3) ON CONFLICT (tenant_id, date) DO UPDATE SET reason=$3 RETURNING *',
      [req.user.tenant_id, date, reason?.trim() || null]
    );
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    await db.query('DELETE FROM blocked_dates WHERE id=$1 AND tenant_id=$2', [req.params.id, req.user.tenant_id]);
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
