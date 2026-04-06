const router = require('express').Router();
const bcrypt = require('bcryptjs');
const auth = require('../middleware/auth');
const db = require('../db');

// GET all users for tenant
router.get('/', auth, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT id, name, email, role, permissions, created_at
       FROM users
       WHERE tenant_id = $1 OR (role = 'superadmin' AND $1::uuid IS NULL)
       ORDER BY created_at DESC`,
      [req.user.tenant_id]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST create new user
router.post('/', auth, async (req, res) => {
  const { name, email, password, role, permissions } = req.body;
  try {
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await db.query(
      `INSERT INTO users (tenant_id, name, email, password_hash, role, permissions)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, name, email, role, permissions, created_at`,
      [req.user.tenant_id, name, email, hash, role, JSON.stringify(permissions || [])]
    );
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT update user
router.put('/:id', auth, async (req, res) => {
  const { name, email, password, role, permissions } = req.body;
  try {
    let query, params;
    if (password) {
      const hash = await bcrypt.hash(password, 10);
      query = `UPDATE users SET name=$1, email=$2, password_hash=$3, role=$4, permissions=$5
               WHERE id=$6 AND tenant_id=$7 RETURNING id, name, email, role, permissions`;
      params = [name, email, hash, role, JSON.stringify(permissions || []), req.params.id, req.user.tenant_id];
    } else {
      query = `UPDATE users SET name=$1, email=$2, role=$3, permissions=$4
               WHERE id=$5 AND tenant_id=$6 RETURNING id, name, email, role, permissions`;
      params = [name, email, role, JSON.stringify(permissions || []), req.params.id, req.user.tenant_id];
    }
    const { rows } = await db.query(query, params);
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE user
router.delete('/:id', auth, async (req, res) => {
  try {
    await db.query(
      `DELETE FROM users WHERE id=$1 AND tenant_id=$2`,
      [req.params.id, req.user.tenant_id]
    );
    res.json({ message: 'User deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;