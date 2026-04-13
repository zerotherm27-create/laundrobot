const router = require('express').Router();
const auth = require('../middleware/auth');
const db = require('../db');

function superadminOnly(req, res, next) {
  if (req.user.role !== 'superadmin') return res.status(403).json({ error: 'Superadmin only' });
  next();
}

// GET all tenants (superadmin only)
router.get('/', auth, superadminOnly, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT id, name, fb_page_id, logo_url, active, created_at FROM tenants ORDER BY created_at DESC`
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET single tenant
router.get('/:id', auth, superadminOnly, async (req, res) => {
  try {
    const { rows: [tenant] } = await db.query(
      `SELECT id, name, fb_page_id, logo_url, active, created_at FROM tenants WHERE id=$1`,
      [req.params.id]
    );
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
    res.json(tenant);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST create tenant
router.post('/', auth, superadminOnly, async (req, res) => {
  const { name, fb_page_id, fb_page_access_token, xendit_api_key, logo_url } = req.body;
  try {
    const { rows } = await db.query(
      `INSERT INTO tenants (name, fb_page_id, fb_page_access_token, xendit_api_key, logo_url)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, fb_page_id, logo_url, active, created_at`,
      [name, fb_page_id, fb_page_access_token, xendit_api_key, logo_url]
    );
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT update tenant
router.put('/:id', auth, superadminOnly, async (req, res) => {
  const { name, fb_page_id, fb_page_access_token, xendit_api_key, logo_url, active } = req.body;
  try {
    const { rows } = await db.query(
      `UPDATE tenants SET name=$1, fb_page_id=$2, fb_page_access_token=$3,
                          xendit_api_key=$4, logo_url=$5, active=$6
       WHERE id=$7
       RETURNING id, name, fb_page_id, logo_url, active, created_at`,
      [name, fb_page_id, fb_page_access_token, xendit_api_key, logo_url, active, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Tenant not found' });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE tenant
router.delete('/:id', auth, superadminOnly, async (req, res) => {
  try {
    await db.query(`DELETE FROM tenants WHERE id=$1`, [req.params.id]);
    res.json({ message: 'Tenant deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
