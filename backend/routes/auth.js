require('dotenv').config();
const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');

// Login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const result = await db.query(
      `SELECT u.*, t.name as tenant_name 
       FROM users u
       LEFT JOIN tenants t ON t.id = u.tenant_id
       WHERE u.email = $1`,
      [email]
    );

    if (!result.rows || result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      {
        id: user.id,
        role: user.role,
        tenant_id: user.tenant_id,
        tenant_name: user.tenant_name,
        email: user.email,
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      role: user.role,
      tenant_id: user.tenant_id,
      tenant_name: user.tenant_name,
      email: user.email,
    });

  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Register first superadmin (run once during setup)
router.post('/setup', async (req, res) => {
  const { email, password } = req.body;
  try {
    const { rows } = await db.query(`SELECT id FROM users WHERE role = 'superadmin' LIMIT 1`);
    if (rows.length > 0) {
      return res.status(403).json({ error: 'Setup already completed' });
    }
    const hash = await bcrypt.hash(password, 10);
    await db.query(
      `INSERT INTO users (email, password_hash, role) VALUES ($1, $2, 'superadmin')`,
      [email, hash]
    );
    res.json({ message: 'Superadmin created' });
  } catch (err) {
    console.error('Setup error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;