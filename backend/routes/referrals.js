const router = require('express').Router();
const auth   = require('../middleware/auth');
const db     = require('../db');

// GET all referral links with click + order stats
router.get('/', auth, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT rl.id, rl.name, rl.ref, rl.click_count, rl.created_at,
              COUNT(DISTINCT o.id) AS order_count
       FROM referral_links rl
       LEFT JOIN orders o ON o.referral_ref = rl.ref AND o.tenant_id = rl.tenant_id
       WHERE rl.tenant_id = $1
       GROUP BY rl.id
       ORDER BY rl.created_at DESC`,
      [req.user.tenant_id]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST create a referral link
router.post('/', auth, async (req, res) => {
  const { name, ref } = req.body;
  if (!name?.trim() || !ref?.trim()) {
    return res.status(400).json({ error: 'name and ref are required' });
  }
  const cleanRef = ref.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '_');
  try {
    const { rows: [link] } = await db.query(
      `INSERT INTO referral_links (tenant_id, name, ref)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [req.user.tenant_id, name.trim(), cleanRef]
    );
    res.status(201).json(link);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: `Ref "${cleanRef}" already exists` });
    res.status(500).json({ error: err.message });
  }
});

// PATCH rename a referral link
router.patch('/:id', auth, async (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'name is required' });
  try {
    const { rows: [link] } = await db.query(
      `UPDATE referral_links SET name=$1 WHERE id=$2 AND tenant_id=$3 RETURNING *`,
      [name.trim(), req.params.id, req.user.tenant_id]
    );
    if (!link) return res.status(404).json({ error: 'Link not found' });
    res.json(link);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE a referral link
router.delete('/:id', auth, async (req, res) => {
  try {
    await db.query(
      `DELETE FROM referral_links WHERE id=$1 AND tenant_id=$2`,
      [req.params.id, req.user.tenant_id]
    );
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
