const router = require('express').Router();
const bcrypt = require('bcryptjs');
const auth = require('../middleware/auth');
const db = require('../db');

// GET all users for tenant (superadmin can pass ?tenant_id=)
router.get('/', auth, async (req, res) => {
  const tenantId = req.user.role === 'superadmin'
    ? (req.query.tenant_id || null)
    : req.user.tenant_id;
  try {
    const { rows } = await db.query(
      `SELECT id, name, email, role, permissions, tenant_id, created_at
       FROM users
       WHERE tenant_id = $1 OR ($1::uuid IS NULL AND role = 'superadmin')
       ORDER BY created_at DESC`,
      [tenantId]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

const STAFF_LIMITS = { starter: 2, growth: 5, pro: 10 };

// POST create new user
router.post('/', auth, async (req, res) => {
  const { name, email, password, role, permissions, tenant_id } = req.body;
  // Superadmin can create users for any branch via req.body.tenant_id
  const targetTenantId = req.user.role === 'superadmin'
    ? (tenant_id || null)
    : req.user.tenant_id;
  try {
    // Enforce staff limit per plan (superadmin accounts have no tenant, skip)
    if (targetTenantId && req.user.role !== 'superadmin') {
      const { rows: [t] } = await db.query('SELECT plan FROM tenants WHERE id=$1', [targetTenantId]);
      const limit = STAFF_LIMITS[t?.plan || 'starter'] ?? 2;
      const { rows: [{ count }] } = await db.query(
        `SELECT COUNT(*) FROM users WHERE tenant_id=$1`, [targetTenantId]
      );
      if (Number(count) >= limit) {
        return res.status(403).json({ error: `Your plan allows up to ${limit} staff account(s). Upgrade your plan to add more.` });
      }
    }
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await db.query(
      `INSERT INTO users (tenant_id, name, email, password_hash, role, permissions)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, name, email, role, permissions, tenant_id, created_at`,
      [targetTenantId, name, email, hash, role, JSON.stringify(permissions || [])]
    );
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT update user
router.put('/:id', auth, async (req, res) => {
  const { name, email, password, role, permissions } = req.body;
  const isSuperAdmin = req.user.role === 'superadmin';
  try {
    let query, params;
    if (password) {
      const hash = await bcrypt.hash(password, 10);
      if (isSuperAdmin) {
        query = `UPDATE users SET name=$1, email=$2, password_hash=$3, role=$4, permissions=$5
                 WHERE id=$6 RETURNING id, name, email, role, permissions, tenant_id`;
        params = [name, email, hash, role, JSON.stringify(permissions || []), req.params.id];
      } else {
        query = `UPDATE users SET name=$1, email=$2, password_hash=$3, role=$4, permissions=$5
                 WHERE id=$6 AND tenant_id=$7 RETURNING id, name, email, role, permissions, tenant_id`;
        params = [name, email, hash, role, JSON.stringify(permissions || []), req.params.id, req.user.tenant_id];
      }
    } else {
      if (isSuperAdmin) {
        query = `UPDATE users SET name=$1, email=$2, role=$3, permissions=$4
                 WHERE id=$5 RETURNING id, name, email, role, permissions, tenant_id`;
        params = [name, email, role, JSON.stringify(permissions || []), req.params.id];
      } else {
        query = `UPDATE users SET name=$1, email=$2, role=$3, permissions=$4
                 WHERE id=$5 AND tenant_id=$6 RETURNING id, name, email, role, permissions, tenant_id`;
        params = [name, email, role, JSON.stringify(permissions || []), req.params.id, req.user.tenant_id];
      }
    }
    const { rows } = await db.query(query, params);
    if (!rows[0]) return res.status(404).json({ error: 'User not found' });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH change password for a specific user (admin/superadmin only)
router.patch('/:id/password', auth, async (req, res) => {
  const { password } = req.body;
  if (!password || password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
  try {
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await db.query(
      `UPDATE users SET password_hash=$1 WHERE id=$2 AND (tenant_id=$3 OR $4 = 'superadmin') RETURNING id, email`,
      [hash, req.params.id, req.user.tenant_id, req.user.role]
    );
    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    res.json({ message: 'Password updated successfully' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH change own password (any logged-in user)
router.patch('/me/password', auth, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Both current and new password are required' });
  if (newPassword.length < 6) return res.status(400).json({ error: 'New password must be at least 6 characters' });
  try {
    const { rows } = await db.query('SELECT password_hash FROM users WHERE id=$1', [req.user.id]);
    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    const valid = await bcrypt.compare(currentPassword, rows[0].password_hash);
    if (!valid) return res.status(400).json({ error: 'Current password is incorrect' });
    const hash = await bcrypt.hash(newPassword, 10);
    await db.query('UPDATE users SET password_hash=$1 WHERE id=$2', [hash, req.user.id]);
    res.json({ message: 'Password updated successfully' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE user
router.delete('/:id', auth, async (req, res) => {
  const isSuperAdmin = req.user.role === 'superadmin';
  try {
    if (isSuperAdmin) {
      await db.query(`DELETE FROM users WHERE id=$1 AND role != 'superadmin'`, [req.params.id]);
    } else {
      await db.query(`DELETE FROM users WHERE id=$1 AND tenant_id=$2`, [req.params.id, req.user.tenant_id]);
    }
    res.json({ message: 'User deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;