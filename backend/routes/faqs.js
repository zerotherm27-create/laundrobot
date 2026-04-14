const router = require('express').Router();
const auth = require('../middleware/auth');
const db = require('../db');

// GET all FAQs for tenant
router.get('/', auth, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT * FROM faqs WHERE tenant_id=$1 ORDER BY sort_order ASC, id ASC`,
      [req.user.tenant_id]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST create FAQ
router.post('/', auth, async (req, res) => {
  const { question, answer, sort_order } = req.body;
  if (!question || !answer) return res.status(400).json({ error: 'question and answer are required' });
  try {
    const { rows: [faq] } = await db.query(
      `INSERT INTO faqs (tenant_id, question, answer, sort_order)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [req.user.tenant_id, question, answer, sort_order || 0]
    );
    res.json(faq);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT update FAQ
router.put('/:id', auth, async (req, res) => {
  const { question, answer, sort_order, active } = req.body;
  try {
    const { rows: [faq] } = await db.query(
      `UPDATE faqs SET question=$1, answer=$2, sort_order=$3, active=$4
       WHERE id=$5 AND tenant_id=$6 RETURNING *`,
      [question, answer, sort_order ?? 0, active ?? true, req.params.id, req.user.tenant_id]
    );
    if (!faq) return res.status(404).json({ error: 'FAQ not found' });
    res.json(faq);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE FAQ
router.delete('/:id', auth, async (req, res) => {
  try {
    await db.query(
      `DELETE FROM faqs WHERE id=$1 AND tenant_id=$2`,
      [req.params.id, req.user.tenant_id]
    );
    res.json({ message: 'FAQ deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
