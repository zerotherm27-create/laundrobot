const router = require('express').Router();
const auth = require('../middleware/auth');
const db = require('../db');

// ── helpers ────────────────────────────────────────────────────────────────

async function attachFields(services) {
  if (!services.length) return services;
  const ids = services.map(s => s.id);
  const { rows } = await db.query(
    `SELECT * FROM service_custom_fields WHERE service_id = ANY($1) ORDER BY sort_order ASC, id ASC`,
    [ids]
  );
  const byService = {};
  for (const f of rows) {
    if (!byService[f.service_id]) byService[f.service_id] = [];
    byService[f.service_id].push(f);
  }
  return services.map(s => ({ ...s, custom_fields: byService[s.id] || [] }));
}

async function saveFields(client, serviceId, fields) {
  await client.query('DELETE FROM service_custom_fields WHERE service_id = $1', [serviceId]);
  if (!fields || !fields.length) return;
  for (let i = 0; i < fields.length; i++) {
    const f = fields[i];
    await client.query(
      `INSERT INTO service_custom_fields
         (service_id, label, field_type, placeholder, required, sort_order, options, min_value, max_value, unit_price)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        serviceId,
        f.label || 'Custom Field',
        f.field_type || 'text',
        f.placeholder || '',
        f.required || false,
        i,
        JSON.stringify(f.options || []),
        f.min_value != null && f.min_value !== '' ? f.min_value : null,
        f.max_value != null && f.max_value !== '' ? f.max_value : null,
        f.unit_price != null && f.unit_price !== '' ? f.unit_price : 0,
      ]
    );
  }
}

// ── routes ─────────────────────────────────────────────────────────────────

// GET all services for tenant (with category info + custom fields)
router.get('/', auth, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT s.*, c.name AS category_name
       FROM services s
       LEFT JOIN service_categories c ON c.id = s.category_id
       WHERE s.tenant_id = $1
       ORDER BY c.sort_order ASC NULLS LAST, s.sort_order ASC, s.name ASC`,
      [req.user.tenant_id]
    );
    const withFields = await attachFields(rows);
    res.json(withFields);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST create service
router.post('/', auth, async (req, res) => {
  const { name, price, unit, description, category_id, sort_order, image_url, custom_fields } = req.body;
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO services (tenant_id, name, price, unit, description, category_id, sort_order, image_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [req.user.tenant_id, name, price, unit || 'per kg', description, category_id || null, sort_order || 0, image_url || null]
    );
    await saveFields(client, rows[0].id, custom_fields);
    await client.query('COMMIT');
    const [withFields] = await attachFields([rows[0]]);
    res.json(withFields);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally { client.release(); }
});

// PUT update service
router.put('/:id', auth, async (req, res) => {
  const { name, price, unit, description, active, category_id, sort_order, image_url, custom_fields } = req.body;
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `UPDATE services SET name=$1, price=$2, unit=$3, description=$4, active=$5,
                           category_id=$6, sort_order=$7, image_url=$8
       WHERE id=$9 AND tenant_id=$10 RETURNING *`,
      [name, price, unit, description, active, category_id || null, sort_order || 0, image_url || null, req.params.id, req.user.tenant_id]
    );
    if (!rows[0]) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Service not found' }); }
    await saveFields(client, rows[0].id, custom_fields);
    await client.query('COMMIT');
    const [withFields] = await attachFields([rows[0]]);
    res.json(withFields);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally { client.release(); }
});

// DELETE service
router.delete('/:id', auth, async (req, res) => {
  try {
    await db.query(
      `DELETE FROM services WHERE id=$1 AND tenant_id=$2`,
      [req.params.id, req.user.tenant_id]
    );
    res.json({ message: 'Service deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
