const router = require('express').Router();
const auth = require('../middleware/auth');
const db = require('../db');
const { setupMessengerProfile } = require('../utils/messengerProfile');

function superadminOnly(req, res, next) {
  if (req.user.role !== 'superadmin') return res.status(403).json({ error: 'Superadmin only' });
  next();
}

// GET own tenant settings (admin)
router.get('/settings', auth, async (req, res) => {
  try {
    const { rows: [tenant] } = await db.query(
      `SELECT id, name, logo_url, notification_email, contact_number, minimum_order, ai_enabled, ai_instructions,
              ig_user_id, ai_pause_hours, shop_address, fb_page_id, qr_image_url,
              custom_domain, white_label, plan,
              to_char(store_open, 'HH24:MI') AS store_open,
              to_char(store_close, 'HH24:MI') AS store_close,
              to_char(booking_cutoff, 'HH24:MI') AS booking_cutoff
       FROM tenants WHERE id=$1`,
      [req.user.tenant_id]
    );
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
    res.json(tenant);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT own tenant settings (admin — only safe fields)
router.put('/settings', auth, async (req, res) => {
  const { notification_email, contact_number, store_open, store_close, booking_cutoff, minimum_order, ai_enabled, ai_instructions, ig_user_id, ai_pause_hours, shop_address, qr_image_url, custom_domain, white_label } = req.body;
  try {
    // Only Pro tenants can set custom domain / white label
    const { rows: [current] } = await db.query(`SELECT plan FROM tenants WHERE id=$1`, [req.user.tenant_id]);
    const isPro = current?.plan === 'pro';

    const { rows: [tenant] } = await db.query(
      `UPDATE tenants
       SET notification_email=$1, contact_number=$2,
           store_open=$3, store_close=$4, booking_cutoff=$5, minimum_order=$6, ai_enabled=$7, ai_instructions=$8,
           ig_user_id=$9, ai_pause_hours=$10, shop_address=$11, qr_image_url=$12,
           custom_domain = CASE WHEN $14 THEN $13 ELSE custom_domain END,
           white_label   = CASE WHEN $14 THEN $15 ELSE white_label   END
       WHERE id=$16
       RETURNING id, name, logo_url, notification_email, contact_number, minimum_order, ai_enabled, ai_instructions,
                 ig_user_id, ai_pause_hours, shop_address, qr_image_url, custom_domain, white_label, plan,
                 to_char(store_open, 'HH24:MI') AS store_open,
                 to_char(store_close, 'HH24:MI') AS store_close,
                 to_char(booking_cutoff, 'HH24:MI') AS booking_cutoff`,
      [
        notification_email?.trim() || null,
        contact_number?.trim() || null,
        store_open || null,
        store_close || null,
        booking_cutoff || null,
        minimum_order != null && minimum_order !== '' ? Number(minimum_order) : null,
        ai_enabled === true || ai_enabled === 'true',
        ai_instructions?.trim() || null,
        ig_user_id?.trim() || null,
        ai_pause_hours != null && ai_pause_hours !== '' ? Number(ai_pause_hours) : 2,
        shop_address?.trim() || null,
        qr_image_url?.trim() || null,
        custom_domain?.trim().toLowerCase() || null,  // $13
        isPro,                                         // $14 — gate
        white_label === true || white_label === 'true',// $15
        req.user.tenant_id,                            // $16
      ]
    );
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
    res.json(tenant);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST reset Messenger profile for own tenant (any admin)
router.post('/settings/setup-messenger', auth, async (req, res) => {
  try {
    const { rows: [tenant] } = await db.query(
      `SELECT id, name, fb_page_access_token, ig_user_id FROM tenants WHERE id=$1`, [req.user.tenant_id]
    );
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
    if (!tenant.fb_page_access_token) return res.status(400).json({ error: 'No Facebook page token configured.' });
    const { fbError, igError } = await setupMessengerProfile(tenant.fb_page_access_token, tenant.name, tenant.id, process.env.APP_URL, tenant.ig_user_id);
    res.json({ fbError: fbError || null, igError: igError || null });
  } catch (err) {
    console.error('[setup-messenger]', err.response?.data || err.message);
    res.status(500).json({ error: err.response?.data?.error?.message || err.message });
  }
});

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
    try { await setupMessengerProfile(fb_page_access_token, name, rows[0].id, process.env.APP_URL); } catch (e) { console.warn('[tenant] messenger profile setup failed:', e.message); }
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST setup Messenger profile manually (Get Started, greeting, persistent menu)
router.post('/:id/setup-messenger', auth, superadminOnly, async (req, res) => {
  try {
    const { rows: [tenant] } = await db.query(
      `SELECT name, fb_page_access_token, ig_user_id FROM tenants WHERE id=$1`, [req.params.id]
    );
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
    await setupMessengerProfile(tenant.fb_page_access_token, tenant.name, req.params.id, process.env.APP_URL, tenant.ig_user_id);
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

// POST clone data from one tenant to another
router.post('/clone-services', auth, superadminOnly, async (req, res) => {
  const { source_tenant_id, target_tenant_id, clear_existing, clone_options } = req.body;
  if (!source_tenant_id || !target_tenant_id) {
    return res.status(400).json({ error: 'source_tenant_id and target_tenant_id are required' });
  }
  if (source_tenant_id === target_tenant_id) {
    return res.status(400).json({ error: 'Source and target branches must be different' });
  }

  const opts = {
    services:       clone_options?.services       !== false,
    settings:       clone_options?.settings       || false,
    faqs:           clone_options?.faqs           || false,
    delivery_zones: clone_options?.delivery_zones !== false,
  };

  if (!opts.services && !opts.settings && !opts.faqs && !opts.delivery_zones) {
    return res.status(400).json({ error: 'Select at least one item to clone.' });
  }

  let client;
  try {
    client = await db.pool.connect();
    await client.query('BEGIN');

    const { rows: tenantCheck } = await client.query(
      `SELECT id FROM tenants WHERE id = ANY($1)`, [[source_tenant_id, target_tenant_id]]
    );
    if (tenantCheck.length < 2) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'One or both branches not found' });
    }

    const stats = { categories: 0, services: 0, custom_fields: 0, delivery_zones: 0, faqs: 0 };

    // ── Clone services + categories ───────────────────────────────────
    if (opts.services) {
      if (clear_existing) {
        await client.query(`DELETE FROM services WHERE tenant_id = $1`, [target_tenant_id]);
        await client.query(`DELETE FROM service_categories WHERE tenant_id = $1`, [target_tenant_id]);
      }

      const { rows: sourceCats } = await client.query(
        `SELECT * FROM service_categories WHERE tenant_id = $1 ORDER BY sort_order ASC, id ASC`,
        [source_tenant_id]
      );
      const catIdMap = {};
      for (const cat of sourceCats) {
        const { rows: [newCat] } = await client.query(
          `INSERT INTO service_categories (tenant_id, name, sort_order, active)
           VALUES ($1,$2,$3,$4) RETURNING id`,
          [target_tenant_id, cat.name, cat.sort_order, cat.active]
        );
        catIdMap[cat.id] = newCat.id;
      }
      stats.categories = sourceCats.length;

      const { rows: sourceSvcs } = await client.query(
        `SELECT * FROM services WHERE tenant_id = $1 ORDER BY sort_order ASC, id ASC`,
        [source_tenant_id]
      );
      for (const svc of sourceSvcs) {
        const newCategoryId = svc.category_id ? (catIdMap[svc.category_id] || null) : null;
        const { rows: [newSvc] } = await client.query(
          `INSERT INTO services
             (tenant_id, name, price, unit, description, active, category_id, sort_order, image_url)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
          [target_tenant_id, svc.name, svc.price, svc.unit, svc.description,
           svc.active, newCategoryId, svc.sort_order, svc.image_url]
        );
        stats.services++;
        const { rows: fields } = await client.query(
          `SELECT * FROM service_custom_fields WHERE service_id = $1 ORDER BY sort_order ASC`,
          [svc.id]
        );
        for (const f of fields) {
          await client.query(
            `INSERT INTO service_custom_fields
               (service_id, label, field_type, placeholder, required, sort_order, options,
                min_value, max_value, unit_price, allow_own, linked_to_field_label, linked_to_value, sync_qty)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
            [newSvc.id, f.label, f.field_type, f.placeholder, f.required, f.sort_order,
             f.options != null ? JSON.stringify(f.options) : null,
             f.min_value, f.max_value, f.unit_price,
             f.allow_own ?? false, f.linked_to_field_label ?? null, f.linked_to_value ?? null, f.sync_qty ?? false]
          );
          stats.custom_fields++;
        }
      }
    }

    // ── Clone delivery zones ──────────────────────────────────────────
    if (opts.delivery_zones) {
      if (clear_existing) {
        await client.query(`DELETE FROM delivery_zones WHERE tenant_id = $1`, [target_tenant_id]);
        await client.query(`DELETE FROM delivery_brackets WHERE tenant_id = $1`, [target_tenant_id]);
      }

      const { rows: sourceZones } = await client.query(
        `SELECT * FROM delivery_zones WHERE tenant_id = $1 ORDER BY sort_order ASC, id ASC`,
        [source_tenant_id]
      );
      for (const z of sourceZones) {
        await client.query(
          `INSERT INTO delivery_zones (tenant_id, name, fee, active, sort_order, custom_note)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [target_tenant_id, z.name, z.fee, z.active, z.sort_order, z.custom_note]
        );
        stats.delivery_zones++;
      }

      const { rows: sourceBrackets } = await client.query(
        `SELECT * FROM delivery_brackets WHERE tenant_id = $1 ORDER BY min_km ASC`,
        [source_tenant_id]
      );
      for (const b of sourceBrackets) {
        await client.query(
          `INSERT INTO delivery_brackets (tenant_id, min_km, max_km, fee, sort_order)
           VALUES ($1,$2,$3,$4,$5)`,
          [target_tenant_id, b.min_km, b.max_km, b.fee, b.sort_order]
        );
      }
    }

    // ── Clone settings ────────────────────────────────────────────────
    if (opts.settings) {
      const { rows: [src] } = await client.query(
        `SELECT store_open, store_close, booking_cutoff, minimum_order,
                ai_enabled, ai_instructions, contact_number,
                delivery_note, delivery_radius, shop_address, shop_lat, shop_lng
         FROM tenants WHERE id=$1`, [source_tenant_id]
      );
      await client.query(
        `UPDATE tenants SET
           store_open=$1, store_close=$2, booking_cutoff=$3, minimum_order=$4,
           ai_enabled=$5, ai_instructions=$6, contact_number=$7,
           delivery_note=$8, delivery_radius=$9, shop_address=$10, shop_lat=$11, shop_lng=$12
         WHERE id=$13`,
        [src.store_open, src.store_close, src.booking_cutoff, src.minimum_order,
         src.ai_enabled, src.ai_instructions, src.contact_number,
         src.delivery_note, src.delivery_radius, src.shop_address, src.shop_lat, src.shop_lng,
         target_tenant_id]
      );
    }

    // ── Clone FAQs ────────────────────────────────────────────────────
    if (opts.faqs) {
      if (clear_existing) {
        await client.query(`DELETE FROM faqs WHERE tenant_id = $1`, [target_tenant_id]);
      }
      const { rows: sourceFaqs } = await client.query(
        `SELECT * FROM faqs WHERE tenant_id = $1 ORDER BY sort_order ASC, id ASC`,
        [source_tenant_id]
      );
      for (const f of sourceFaqs) {
        await client.query(
          `INSERT INTO faqs (tenant_id, question, answer, active, sort_order)
           VALUES ($1,$2,$3,$4,$5)`,
          [target_tenant_id, f.question, f.answer, f.active, f.sort_order]
        );
        stats.faqs++;
      }
    }

    await client.query('COMMIT');

    const { rows: [sourceTenant] } = await db.query(`SELECT name FROM tenants WHERE id=$1`, [source_tenant_id]);
    const { rows: [targetTenant] } = await db.query(`SELECT name FROM tenants WHERE id=$1`, [target_tenant_id]);

    res.json({
      message: `Successfully cloned from "${sourceTenant.name}" to "${targetTenant.name}"`,
      stats,
    });
  } catch (err) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    console.error('[clone-services]', err.message);
    res.status(500).json({ error: err.message });
  } finally {
    if (client) client.release();
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
