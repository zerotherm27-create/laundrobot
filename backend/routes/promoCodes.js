const router = require('express').Router();
const auth = require('../middleware/auth');
const db = require('../db');

// GET all promo codes for tenant
router.get('/', auth, async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT * FROM promo_codes WHERE tenant_id=$1 ORDER BY created_at DESC',
      [req.user.tenant_id]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST create promo code
router.post('/', auth, async (req, res) => {
  const { code, discount_type, discount_value, min_order, max_uses, expires_at } = req.body;
  if (!code?.trim()) return res.status(400).json({ error: 'Code is required' });
  if (!discount_type || !['fixed', 'percent'].includes(discount_type))
    return res.status(400).json({ error: 'discount_type must be fixed or percent' });
  if (!discount_value || Number(discount_value) <= 0)
    return res.status(400).json({ error: 'discount_value must be > 0' });
  if (discount_type === 'percent' && Number(discount_value) > 100)
    return res.status(400).json({ error: 'Percent discount cannot exceed 100' });
  try {
    const { rows: [promo] } = await db.query(
      `INSERT INTO promo_codes (tenant_id, code, discount_type, discount_value, min_order, max_uses, expires_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [
        req.user.tenant_id,
        code.trim().toUpperCase(),
        discount_type,
        Number(discount_value),
        min_order ? Number(min_order) : null,
        max_uses ? Number(max_uses) : null,
        expires_at || null,
      ]
    );
    res.json(promo);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'A promo code with that name already exists' });
    res.status(500).json({ error: err.message });
  }
});

// PATCH toggle active
router.patch('/:id', auth, async (req, res) => {
  const { active } = req.body;
  try {
    const { rows: [promo] } = await db.query(
      'UPDATE promo_codes SET active=$1 WHERE id=$2 AND tenant_id=$3 RETURNING *',
      [active, req.params.id, req.user.tenant_id]
    );
    if (!promo) return res.status(404).json({ error: 'Not found' });
    res.json(promo);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE promo code
router.delete('/:id', auth, async (req, res) => {
  try {
    await db.query('DELETE FROM promo_codes WHERE id=$1 AND tenant_id=$2', [req.params.id, req.user.tenant_id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
