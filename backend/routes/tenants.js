const router = require('express').Router();
const auth = require('../middleware/auth');
const db = require('../db');
const { setupMessengerProfile } = require('../utils/messengerProfile');

function superadminOnly(req, res, next) {
  if (req.user.role !== 'superadmin') return res.status(403).json({ error: 'Superadmin only' });
  next();
}

// GET all tenants (superadmin only)
router.get('/', auth, superadminOnly, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT t.id, t.name, t.fb_page_id, t.logo_url, t.active, t.created_at,
              COUNT(o.id)::int AS total_orders,
              COALESCE(SUM(CASE WHEN o.paid THEN o.price ELSE 0 END), 0) AS total_revenue
       FROM tenants t
       LEFT JOIN orders o ON o.tenant_id = t.id
       GROUP BY t.id
       ORDER BY t.created_at DESC`
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
    // Auto-setup Messenger profile for the new page
    try { await setupMessengerProfile(fb_page_access_token, name); } catch (e) { console.warn('[tenant] messenger profile setup failed:', e.message); }
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST setup Messenger profile manually (Get Started, greeting, persistent menu)
router.post('/:id/setup-messenger', auth, superadminOnly, async (req, res) => {
  try {
    const { rows: [tenant] } = await db.query(
      `SELECT name, fb_page_access_token FROM tenants WHERE id=$1`, [req.params.id]
    );
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
    await setupMessengerProfile(tenant.fb_page_access_token, tenant.name);
    res.json({ message: 'Messenger profile configured successfully' });
  } catch (err) {
    console.error('[setup-messenger]', err.response?.data || err.message);
    res.status(500).json({ error: err.response?.data?.error?.message || err.message });
  }
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

// POST clone services from one tenant to another
router.post('/clone-services', auth, superadminOnly, async (req, res) => {
  const { source_tenant_id, target_tenant_id, clear_existing } = req.body;
  if (!source_tenant_id || !target_tenant_id) {
    return res.status(400).json({ error: 'source_tenant_id and target_tenant_id are required' });
  }
  if (source_tenant_id === target_tenant_id) {
    return res.status(400).json({ error: 'Source and target branches must be different' });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // Verify both tenants exist
    const { rows: tenantCheck } = await client.query(
      `SELECT id FROM tenants WHERE id = ANY($1)`, [[source_tenant_id, target_tenant_id]]
    );
    if (tenantCheck.length < 2) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'One or both branches not found' });
    }

    // Optionally wipe existing services + categories from target
    if (clear_existing) {
      await client.query(`DELETE FROM services WHERE tenant_id = $1`, [target_tenant_id]);
      await client.query(`DELETE FROM service_categories WHERE tenant_id = $1`, [target_tenant_id]);
    }

    // ── Clone categories ──────────────────────────────────────────────
    const { rows: sourceCats } = await client.query(
      `SELECT * FROM service_categories WHERE tenant_id = $1 ORDER BY sort_order ASC, id ASC`,
      [source_tenant_id]
    );

    // Map old category id → new category id
    const catIdMap = {};
    for (const cat of sourceCats) {
      const { rows: [newCat] } = await client.query(
        `INSERT INTO service_categories (tenant_id, name, sort_order, active)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [target_tenant_id, cat.name, cat.sort_order, cat.active]
      );
      catIdMap[cat.id] = newCat.id;
    }

    // ── Clone services ────────────────────────────────────────────────
    const { rows: sourceSvcs } = await client.query(
      `SELECT * FROM services WHERE tenant_id = $1 ORDER BY sort_order ASC, id ASC`,
      [source_tenant_id]
    );

    let clonedServices = 0;
    let clonedFields   = 0;

    for (const svc of sourceSvcs) {
      const newCategoryId = svc.category_id ? (catIdMap[svc.category_id] || null) : null;

      const { rows: [newSvc] } = await client.query(
        `INSERT INTO services
           (tenant_id, name, price, unit, description, active, category_id, sort_order, image_url)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
        [target_tenant_id, svc.name, svc.price, svc.unit, svc.description,
         svc.active, newCategoryId, svc.sort_order, svc.image_url]
      );
      clonedServices++;

      // Clone custom fields for this service
      const { rows: fields } = await client.query(
        `SELECT * FROM service_custom_fields WHERE service_id = $1 ORDER BY sort_order ASC`,
        [svc.id]
      );
      for (const f of fields) {
        await client.query(
          `INSERT INTO service_custom_fields (service_id, label, field_type, placeholder, required, sort_order)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [newSvc.id, f.label, f.field_type, f.placeholder, f.required, f.sort_order]
        );
        clonedFields++;
      }
    }

    await client.query('COMMIT');

    const { rows: [sourceTenant] } = await db.query(`SELECT name FROM tenants WHERE id=$1`, [source_tenant_id]);
    const { rows: [targetTenant] } = await db.query(`SELECT name FROM tenants WHERE id=$1`, [target_tenant_id]);

    res.json({
      message: `Successfully cloned services from "${sourceTenant.name}" to "${targetTenant.name}"`,
      stats: {
        categories: sourceCats.length,
        services: clonedServices,
        custom_fields: clonedFields,
      },
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[clone-services]', err.message);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// DELETE tenant
router.delete('/:id', auth, superadminOnly, async (req, res) => {
  try {
    await db.query(`DELETE FROM tenants WHERE id=$1`, [req.params.id]);
    res.json({ message: 'Tenant deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
