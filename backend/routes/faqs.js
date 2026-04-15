const router = require('express').Router();
const auth = require('../middleware/auth');
const db = require('../db');

// Resolve tenant_id: superadmin can pass ?tenant_id=, others use their own
function getTenantId(req) {
  if (req.user.role === 'superadmin') return req.query.tenant_id || req.body.tenant_id || null;
  return req.user.tenant_id;
}

// GET all FAQs for tenant
router.get('/', auth, async (req, res) => {
  const tenantId = getTenantId(req);
  if (!tenantId) return res.json([]); // superadmin with no tenant selected
  try {
    const { rows } = await db.query(
      `SELECT * FROM faqs WHERE tenant_id=$1 ORDER BY sort_order ASC, id ASC`,
      [tenantId]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST create FAQ
router.post('/', auth, async (req, res) => {
  const { question, answer, sort_order } = req.body;
  if (!question || !answer) return res.status(400).json({ error: 'question and answer are required' });
  const tenantId = getTenantId(req);
  if (!tenantId) return res.status(400).json({ error: 'tenant_id is required for superadmin' });
  try {
    const { rows: [faq] } = await db.query(
      `INSERT INTO faqs (tenant_id, question, answer, sort_order)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [tenantId, question, answer, sort_order || 0]
    );
    res.json(faq);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT update FAQ
router.put('/:id', auth, async (req, res) => {
  const { question, answer, sort_order, active } = req.body;
  const tenantId = getTenantId(req);
  try {
    const { rows: [faq] } = await db.query(
      `UPDATE faqs SET question=$1, answer=$2, sort_order=$3, active=$4
       WHERE id=$5 AND tenant_id=$6 RETURNING *`,
      [question, answer, sort_order ?? 0, active ?? true, req.params.id, tenantId]
    );
    if (!faq) return res.status(404).json({ error: 'FAQ not found' });
    res.json(faq);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE FAQ
router.delete('/:id', auth, async (req, res) => {
  const tenantId = getTenantId(req);
  try {
    await db.query(
      `DELETE FROM faqs WHERE id=$1 AND tenant_id=$2`,
      [req.params.id, tenantId]
    );
    res.json({ message: 'FAQ deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
