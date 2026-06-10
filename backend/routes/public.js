const router = require('express').Router();
const { randomUUID } = require('crypto');
const axios = require('axios');
const rateLimit = require('express-rate-limit');
const db = require('../db');
const { createInvoice } = require('../utils/xendit');
const { sendNewOrderEmail, sendCustomerOrderEmail } = require('../utils/email');
const { sendMessage, sendButtons } = require('../utils/messenger');
const { sendPushToTenant } = require('../utils/push');
const { haversine } = require('./deliveryBrackets');

const coordsLimiter = rateLimit({ windowMs: 60 * 1000, max: 5, standardHeaders: true, legacyHeaders: false });

// Look up a tenant by custom domain — used by the booking form on white-label domains
router.get('/by-domain/:hostname', async (req, res) => {
  try {
    const hostname = req.params.hostname.toLowerCase().trim();
    const { rows: [tenant] } = await db.query(
      `SELECT id, name, white_label FROM tenants WHERE LOWER(custom_domain) = $1 AND active = true`,
      [hostname]
    );
    if (!tenant) return res.status(404).json({ error: 'Domain not configured' });
    res.json({ tenant_id: tenant.id, tenant_name: tenant.name, white_label: tenant.white_label });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

// Serve service image — allows Messenger carousel to display base64-stored images via a public URL
router.get('/image/:serviceId', async (req, res) => {
  try {
    const { rows: [svc] } = await db.query('SELECT image_url FROM services WHERE id=$1', [req.params.serviceId]);
    if (!svc?.image_url) return res.status(404).end();
    const dataMatch = svc.image_url.match(/^data:([^;]+);base64,(.+)$/);
    if (dataMatch) {
      const [, mimeType, b64] = dataMatch;
      res.set('Content-Type', mimeType);
      res.set('Cache-Control', 'public, max-age=86400');
      return res.send(Buffer.from(b64, 'base64'));
    }
    if (!svc.image_url.startsWith('https://')) {
      return res.status(400).json({ error: 'Invalid image URL' });
    }
    res.redirect(svc.image_url);
  } catch (err) { res.status(500).end(); }
});

// Public geocode proxy — single result (kept for saved-address geocoding)
router.get('/geocode', async (req, res) => {
  const { q } = req.query;
  if (!q?.trim()) return res.status(400).json({ error: 'query required' });
  try {
    const { data } = await axios.get('https://nominatim.openstreetmap.org/search', {
      params: { q: q.trim(), format: 'json', limit: 1, countrycodes: 'ph' },
      headers: { 'User-Agent': 'LaundroBot/1.0 (hello@laundrobot.app)' },
      timeout: 8000,
    });
    if (!data.length) return res.json(null);
    res.json({ lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

// Address autocomplete — returns up to 5 suggestions with coords
router.get('/geocode/suggest', async (req, res) => {
  const { q } = req.query;
  if (!q?.trim() || q.trim().length < 3) return res.json([]);
  try {
    const { data } = await axios.get('https://nominatim.openstreetmap.org/search', {
      params: { q: q.trim(), format: 'json', limit: 5, countrycodes: 'ph', addressdetails: 1 },
      headers: { 'User-Agent': 'LaundroBot/1.0 (hello@laundrobot.app)' },
      timeout: 8000,
    });
    res.json(data.map(r => {
      // Build a short label: first 3 comma-parts of display_name
      const parts = r.display_name.split(',').map(s => s.trim());
      const label = parts.slice(0, 3).join(', ');
      return {
        lat: parseFloat(r.lat),
        lng: parseFloat(r.lon),
        label,
        full: r.display_name,
      };
    }));
  } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

// POST track a referral link click from the web booking form
// Called when BookingForm loads with ?ref=CODE so web links get click_count just like m.me links
router.post('/:tenantId/referral-click', async (req, res) => {
  const { ref } = req.body;
  if (!ref?.trim()) return res.status(400).json({ error: 'ref required' });
  try {
    const { rows: [link] } = await db.query(
      `UPDATE referral_links SET click_count = click_count + 1
       WHERE tenant_id=$1 AND ref=$2
       RETURNING id`,
      [req.params.tenantId, ref.trim().toUpperCase()]
    );
    if (!link) return res.status(404).json({ error: 'Referral link not found' });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET all booking-form data in one request
router.get('/:tenantId/bootstrap', async (req, res) => {
  const id = req.params.tenantId;
  try {
    const [
      { rows: [tenant] },
      { rows: categories },
      { rows: services },
      { rows: allFields },
      { rows: zones },
      { rows: brackets },
      { rows: [bracketMeta] },
      { rows: blockedDates },
    ] = await Promise.all([
      db.query(
        `SELECT name, logo_url, contact_number, minimum_order, fb_page_id, plan, open_days,
                to_char(store_open, 'HH24:MI') AS store_open,
                to_char(store_close, 'HH24:MI') AS store_close,
                to_char(booking_cutoff, 'HH24:MI') AS booking_cutoff
         FROM tenants WHERE id=$1 AND active=TRUE`, [id]
      ),
      db.query(`SELECT id, name FROM service_categories WHERE tenant_id=$1 AND active=TRUE ORDER BY sort_order, id`, [id]),
      db.query(
        `SELECT s.id, s.name, s.price, s.unit, s.description, s.image_url, s.category_id,
                c.name AS category_name
         FROM services s LEFT JOIN service_categories c ON c.id=s.category_id
         WHERE s.tenant_id=$1 AND s.active=TRUE AND s.available_online=TRUE ORDER BY s.sort_order, s.id`, [id]
      ),
      db.query(
        `SELECT id, service_id, label, field_type, placeholder, required, options,
                min_value, max_value, unit_price, allow_own, linked_to_field_label, linked_to_value, sync_qty
         FROM service_custom_fields
         WHERE service_id IN (SELECT id FROM services WHERE tenant_id=$1 AND active=TRUE AND available_online=TRUE)
         ORDER BY sort_order`, [id]
      ),
      db.query(`SELECT id, name, fee, custom_note FROM delivery_zones WHERE tenant_id=$1 AND active=TRUE ORDER BY sort_order, id`, [id]),
      db.query(`SELECT min_km, max_km, fee FROM delivery_brackets WHERE tenant_id=$1 ORDER BY min_km ASC`, [id]),
      db.query(`SELECT shop_lat, shop_lng, delivery_note, delivery_radius FROM tenants WHERE id=$1 AND active=TRUE`, [id]),
      db.query(`SELECT date::text, reason FROM blocked_dates WHERE tenant_id=$1 AND date >= CURRENT_DATE ORDER BY date ASC`, [id]),
    ]);
    if (!tenant) return res.status(404).json({ error: 'Shop not found' });
    const fieldMap = {};
    for (const f of allFields) {
      if (!fieldMap[f.service_id]) fieldMap[f.service_id] = [];
      fieldMap[f.service_id].push(f);
    }
    for (const svc of services) svc.custom_fields = fieldMap[svc.id] || [];
    res.json({
      tenant,
      categories,
      services,
      zones,
      bracketInfo: bracketMeta?.shop_lat && bracketMeta?.shop_lng
        ? { brackets, shop_lat: Number(bracketMeta.shop_lat), shop_lng: Number(bracketMeta.shop_lng), delivery_note: bracketMeta.delivery_note, delivery_radius: Number(bracketMeta.delivery_radius) || 15 }
        : null,
      blockedDates,
    });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

// GET tenant info (name + logo + store hours for booking form)
router.get('/:tenantId/info', async (req, res) => {
  try {
    const { rows: [t] } = await db.query(
      `SELECT name, logo_url, contact_number, minimum_order, fb_page_id, open_days,
              to_char(store_open, 'HH24:MI') AS store_open,
              to_char(store_close, 'HH24:MI') AS store_close,
              to_char(booking_cutoff, 'HH24:MI') AS booking_cutoff
       FROM tenants WHERE id=$1 AND active=TRUE`,
      [req.params.tenantId]
    );
    if (!t) return res.status(404).json({ error: 'Shop not found' });
    res.json(t);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

// GET blocked dates for public booking form
router.get('/:tenantId/blocked-dates', async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT date::text, reason FROM blocked_dates WHERE tenant_id=$1 AND date >= CURRENT_DATE ORDER BY date ASC`,
      [req.params.tenantId]
    );
    res.json(rows);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

// GET active categories
router.get('/:tenantId/categories', async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT id, name FROM service_categories WHERE tenant_id=$1 AND active=TRUE ORDER BY sort_order, id',
      [req.params.tenantId]
    );
    res.json(rows);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

// GET active services with custom fields
router.get('/:tenantId/services', async (req, res) => {
  try {
    const [{ rows: services }, { rows: allFields }] = await Promise.all([
      db.query(
        `SELECT s.id, s.name, s.price, s.unit, s.description, s.image_url, s.category_id,
                c.name AS category_name
         FROM services s
         LEFT JOIN service_categories c ON c.id = s.category_id
         WHERE s.tenant_id=$1 AND s.active=TRUE AND s.available_online=TRUE
         ORDER BY s.sort_order, s.id`,
        [req.params.tenantId]
      ),
      db.query(
        `SELECT id, service_id, label, field_type, placeholder, required, options,
                min_value, max_value, unit_price, allow_own, linked_to_field_label, linked_to_value, sync_qty
         FROM service_custom_fields
         WHERE service_id IN (SELECT id FROM services WHERE tenant_id=$1 AND active=TRUE AND available_online=TRUE)
         ORDER BY sort_order`,
        [req.params.tenantId]
      ),
    ]);
    const fieldMap = {};
    for (const f of allFields) {
      if (!fieldMap[f.service_id]) fieldMap[f.service_id] = [];
      fieldMap[f.service_id].push(f);
    }
    for (const svc of services) svc.custom_fields = fieldMap[svc.id] || [];
    res.json(services);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

// PATCH customer coords — called after geocoding succeeds for old customers with no stored coords
router.patch('/:tenantId/customer/coords', coordsLimiter, async (req, res) => {
  const { phone, addr_lat, addr_lng } = req.body;
  if (!phone?.trim() || !addr_lat || !addr_lng) return res.json({ ok: false });
  try {
    await db.query(
      `UPDATE customers SET addr_lat=$1, addr_lng=$2
       WHERE tenant_id=$3 AND phone=$4 AND (addr_lat IS NULL OR addr_lng IS NULL)`,
      [Number(addr_lat), Number(addr_lng), req.params.tenantId, phone.trim()]
    );
    res.json({ ok: true });
  } catch { res.json({ ok: false }); }
});

// GET customer by phone — repeat customer lookup (returns only fields needed for form prefill, no PII overload)
router.get('/:tenantId/customer', async (req, res) => {
  const { phone } = req.query;
  if (!phone?.trim()) return res.json(null);
  try {
    const { rows: [customer] } = await db.query(
      `SELECT c.name, c.phone, c.address, c.addr_lat, c.addr_lng
       FROM customers c
       WHERE c.tenant_id=$1 AND c.phone=$2`,
      [req.params.tenantId, phone.trim()]
    );
    if (!customer || !customer.address) return res.json(null);
    res.json({
      name: customer.name, phone: customer.phone, address: customer.address,
      addr_lat: customer.addr_lat ? Number(customer.addr_lat) : null,
      addr_lng: customer.addr_lng ? Number(customer.addr_lng) : null,
    });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

// GET active delivery zones
router.get('/:tenantId/delivery-zones', async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT id, name, fee, custom_note FROM delivery_zones WHERE tenant_id=$1 AND active=TRUE ORDER BY sort_order, id',
      [req.params.tenantId]
    );
    res.json(rows);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

// GET delivery brackets + shop location
router.get('/:tenantId/delivery-brackets', async (req, res) => {
  try {
    const [{ rows: brackets }, { rows: [t] }] = await Promise.all([
      db.query('SELECT min_km, max_km, fee FROM delivery_brackets WHERE tenant_id=$1 ORDER BY min_km ASC', [req.params.tenantId]),
      db.query('SELECT shop_lat, shop_lng, delivery_note, delivery_radius FROM tenants WHERE id=$1 AND active=TRUE', [req.params.tenantId]),
    ]);
    if (!t) return res.status(404).json({ error: 'Not found' });
    res.json({ brackets, shop_lat: t.shop_lat ? Number(t.shop_lat) : null, shop_lng: t.shop_lng ? Number(t.shop_lng) : null, delivery_note: t.delivery_note, delivery_radius: Number(t.delivery_radius) || 15 });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

// GET validate promo code
router.get('/:tenantId/promo', async (req, res) => {
  const { code, total } = req.query;
  if (!code?.trim()) return res.status(400).json({ error: 'Code is required' });
  try {
    const { rows: [promo] } = await db.query(
      `SELECT * FROM promo_codes WHERE tenant_id=$1 AND code=$2 AND active=TRUE`,
      [req.params.tenantId, code.trim().toUpperCase()]
    );
    if (!promo) return res.status(404).json({ error: 'Invalid or expired promo code' });
    if (promo.expires_at && new Date(promo.expires_at) < new Date()) {
      return res.status(400).json({ error: 'This promo code has expired' });
    }
    if (promo.max_uses !== null && promo.uses_count >= promo.max_uses) {
      return res.status(400).json({ error: 'This promo code has reached its usage limit' });
    }
    const orderTotal = parseFloat(total) || 0;
    if (promo.min_order && orderTotal < Number(promo.min_order)) {
      return res.status(400).json({ error: `Minimum order of ₱${Number(promo.min_order).toLocaleString('en-PH')} required for this promo` });
    }
    const discount = promo.discount_type === 'percent'
      ? Math.round(Math.min(orderTotal * Number(promo.discount_value) / 100, orderTotal) * 100) / 100
      : Math.min(Number(promo.discount_value), orderTotal);
    res.json({ code: promo.code, discount_type: promo.discount_type, discount_value: Number(promo.discount_value), discount });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

// ── Price calculator (per cart item) ────────────────────────────────────────
async function calcItemPrice(tenantId, serviceId, custom_fields) {
  const { rows: [service] } = await db.query(
    'SELECT * FROM services WHERE id=$1 AND tenant_id=$2 AND active=TRUE',
    [serviceId, tenantId]
  );
  if (!service) throw new Error(`Service ${serviceId} not found or inactive`);

  const { rows: svcFields } = await db.query(
    'SELECT id, label, field_type, unit_price, options FROM service_custom_fields WHERE service_id=$1',
    [serviceId]
  );

  const isPerKg = service.unit && service.unit.toLowerCase().includes('kg');
  const weightField = (custom_fields || []).find(f => f.label?.toLowerCase().includes('weight'));
  const weight = weightField ? parseFloat(weightField.value) || null : null;

  const numField = svcFields.find(f => f.field_type === 'number');
  const qtyField = numField ? (custom_fields || []).find(f => f.label === numField.label) : null;
  const qty = qtyField ? parseFloat(qtyField.value) || 0 : 0;

  const basePrice = isPerKg && weight
    ? Number(service.price) * weight
    : qty > 0 ? Number(service.price) * qty : Number(service.price);

  const addonTotal = (custom_fields || []).reduce((sum, cf) => {
    const fd = svcFields.find(f => f.field_type === 'addon' && f.label === cf.label);
    if (!fd) return sum;
    const unitPrice = Number(fd.unit_price || 0);
    const qty       = Math.max(0, Number(cf.value) || 0); // Number() preserves decimals; Math.max guards negatives
    if (unitPrice <= 0 || qty <= 0) return sum;           // skip invalid entries
    return sum + unitPrice * qty;
  }, 0);

  const selectFieldDefs = svcFields.filter(f => f.field_type === 'select');

  let baseVariationPrice = 0;
  for (const fd of selectFieldDefs) {
    const cf = (custom_fields || []).find(c => c.label === fd.label);
    if (!cf?.value) continue;
    const opt = (Array.isArray(fd.options) ? fd.options : []).find(o => typeof o === 'object' ? o.label === cf.value : o === cf.value);
    if (opt && typeof opt === 'object' && (opt.price_type || 'fixed') !== 'copy_base' && Number(opt.price || 0) > 0) {
      baseVariationPrice = Number(opt.price); break;
    }
  }

  const hasVarPricing = svcFields.some(f =>
    f.field_type === 'select' && Array.isArray(f.options) &&
    f.options.some(o => Number(typeof o === 'object' ? o.price : 0) > 0)
  );

  let primarySelectFieldId = null;
  for (const fd of selectFieldDefs) {
    const cf = (custom_fields || []).find(c => c.label === fd.label);
    if (!cf?.value) continue;
    const opt = (Array.isArray(fd.options) ? fd.options : []).find(o => typeof o === 'object' ? o.label === cf.value : o === cf.value);
    if (opt && typeof opt === 'object' && (opt.price_type || 'fixed') !== 'copy_base' && Number(opt.price || 0) > 0) {
      primarySelectFieldId = fd.id; break;
    }
  }

  const effectiveSubtotal = hasVarPricing
    ? selectFieldDefs.reduce((sum, fd) => {
        const cf = (custom_fields || []).find(c => c.label === fd.label);
        if (!cf?.value) return sum;
        const opt = (Array.isArray(fd.options) ? fd.options : []).find(o => typeof o === 'object' ? o.label === cf.value : o === cf.value);
        if (!opt || typeof opt !== 'object') return sum;
        const priceType = opt.price_type || 'fixed';
        const optPrice = priceType === 'copy_base' ? baseVariationPrice : Number(opt.price || 0);
        const scales = qty > 0 && (fd.id === primarySelectFieldId || priceType === 'copy_base');
        return sum + optPrice * (scales ? qty : 1);
      }, 0)
    : basePrice;

  // Resolve turnaround: use selected option's override if present, else service default
  let resolvedTurnaround = Number(service.turnaround_days || 2);
  for (const fd of selectFieldDefs) {
    const cf = (custom_fields || []).find(c => c.label === fd.label);
    if (!cf?.value) continue;
    const opt = (Array.isArray(fd.options) ? fd.options : []).find(o => typeof o === 'object' ? o.label === cf.value : o === cf.value);
    if (opt && typeof opt === 'object' && opt.turnaround_days != null && opt.turnaround_days !== '') {
      resolvedTurnaround = Number(opt.turnaround_days);
      break;
    }
  }

  return { service, effectiveSubtotal, addonTotal, weight, resolvedTurnaround };
}

// POST create order (public booking) — supports multi-service cart
router.post('/:tenantId/orders', async (req, res) => {
  const { cart, name, phone, email, address, pickup_date, delivery_zone_id, customer_lat, customer_lng, notes, promo_code, fb_id, is_dropoff, source, captcha_token, is_whatsapp, ref_code } = req.body;
  const isDropoff = is_dropoff === true || is_dropoff === 'true';

  if (!cart?.length || !name?.trim() || !phone?.trim() || !address?.trim() || !pickup_date?.trim()) {
    return res.status(400).json({ error: 'Cart, name, phone, address, and pickup date are required.' });
  }

  // Phone validation: accept PH numbers or international numbers flagged as WhatsApp
  const cleanPhone = phone.trim().replace(/\s/g, '');
  const isPHNumber = /^(09|\+639|639)\d{9}$/.test(cleanPhone);
  const isIntlNumber = /^\+(?!63)\d{6,15}$/.test(cleanPhone);
  if (!isPHNumber && !isIntlNumber && !is_whatsapp) {
    return res.status(400).json({ error: 'Please enter a valid mobile number (e.g. 09XXXXXXXXX) or a WhatsApp international number (e.g. +1XXXXXXXXXX).' });
  }

  // reCAPTCHA v3 verification (skip gracefully if secret not configured)
  const recaptchaSecret = process.env.RECAPTCHA_SECRET_KEY;
  if (recaptchaSecret) {
    if (!captcha_token) {
      return res.status(400).json({ error: 'Security check failed. Please refresh and try again.' });
    }
    try {
      const axios = require('axios');
      const { data: captchaRes } = await axios.post(
        `https://www.google.com/recaptcha/api/siteverify?secret=${recaptchaSecret}&response=${captcha_token}`,
        null, { timeout: 5000 }
      );
      // Reject score below 0.3 (likely bot); 1.0 = definitely human, 0.0 = definitely bot
      if (!captchaRes.success || captchaRes.score < 0.3) {
        console.warn('[captcha] rejected score:', captchaRes.score, 'action:', captchaRes.action);
        return res.status(403).json({ error: 'Security check failed. Please refresh the page and try again.' });
      }
    } catch (captchaErr) {
      console.warn('[captcha] verification error (allowing through):', captchaErr.message);
      // On captcha service error, allow through to not block real customers
    }
  }

  // Rate limit: max 3 pending/active bookings per phone per tenant per day
  try {
    const { rows: [{ count: pendingCount }] } = await db.query(
      `SELECT COUNT(*) FROM orders o
       JOIN customers c ON c.id = o.customer_id
       WHERE o.tenant_id=$1 AND c.phone=$2
         AND o.status NOT IN ('completed','cancelled','archived')
         AND o.created_at > NOW() - INTERVAL '24 hours'`,
      [req.params.tenantId, cleanPhone]
    );
    if (Number(pendingCount) >= 3) {
      return res.status(429).json({ error: 'You already have several active bookings. Please wait for them to be processed before placing more.' });
    }
  } catch (rateErr) {
    console.warn('[rate-limit] check failed (skipping):', rateErr.message);
  }

  // Normalize pickup to an explicit Asia/Manila offset. Older cached frontends send a naive
  // local string ("2026-06-10T15:30:00") which a UTC server/DB reads as UTC → +8h shift on display.
  const pickupRaw = pickup_date.trim();
  const pickupNormalized = /(Z|[+-]\d{2}:?\d{2})$/.test(pickupRaw) ? pickupRaw : `${pickupRaw}+08:00`;

  const pickupDay = new Date(pickupNormalized);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  if (isNaN(pickupDay.getTime()) || pickupDay < today) {
    return res.status(400).json({ error: 'Pickup date cannot be in the past.' });
  }

  const PUB_MONTH_LIMITS = { starter: 200, growth: 1000, pro: Infinity };

  let client;
  try {
    const { rows: [tenantPlan] } = await db.query('SELECT plan FROM tenants WHERE id=$1', [req.params.tenantId]);
    const monthLimit = PUB_MONTH_LIMITS[tenantPlan?.plan || 'starter'] ?? 200;
    if (isFinite(monthLimit)) {
      const { rows: [{ count }] } = await db.query(
        `SELECT COUNT(*) FROM orders WHERE tenant_id=$1 AND date_trunc('month', created_at) = date_trunc('month', NOW())`,
        [req.params.tenantId]
      );
      if (Number(count) >= monthLimit) {
        return res.status(403).json({ error: `This shop has reached its monthly order limit. Please contact the shop directly or try again next month.` });
      }
    }

    client = await db.pool.connect();
    await client.query('BEGIN');

    // Price all cart items (parallel reads from pool)
    const pricedItems = await Promise.all(
      cart.map(item => calcItemPrice(req.params.tenantId, item.service_id, item.custom_fields))
    );

    // Delivery fee — bracket-based or legacy zone
    let deliveryFee = 0, zoneName = null;
    if (customer_lat && customer_lng) {
      const { rows: [shopTenant] } = await db.query(
        'SELECT shop_lat, shop_lng, delivery_radius FROM tenants WHERE id=$1', [req.params.tenantId]
      );
      if (shopTenant?.shop_lat && shopTenant?.shop_lng) {
        const distKm = haversine(Number(shopTenant.shop_lat), Number(shopTenant.shop_lng), Number(customer_lat), Number(customer_lng));
        const radius = Number(shopTenant.delivery_radius) || 15;
        if (distKm > radius) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: `Sorry, your address is ${distKm.toFixed(1)}km away — outside our ${radius}km delivery area.` });
        }
        const { rows: brackets } = await db.query(
          'SELECT min_km, max_km, fee FROM delivery_brackets WHERE tenant_id=$1 ORDER BY min_km ASC', [req.params.tenantId]
        );
        for (const b of brackets) {
          if (distKm >= Number(b.min_km) && distKm <= Number(b.max_km)) {
            deliveryFee = Number(b.fee);
            zoneName = `${distKm.toFixed(1)}km`;
            break;
          }
        }
      }
    } else if (delivery_zone_id) {
      const { rows: [zone] } = await db.query(
        'SELECT * FROM delivery_zones WHERE id=$1 AND tenant_id=$2 AND active=TRUE',
        [delivery_zone_id, req.params.tenantId]
      );
      if (zone) { deliveryFee = Number(zone.fee); zoneName = zone.name; }
    }

    // Get or create customer
    // If fb_id present: atomic upsert on the (tenant_id, fb_id) unique constraint — no race condition possible.
    // If no fb_id: fall back to phone lookup then insert.
    let customerId;
    const coordLat = customer_lat ? Number(customer_lat) : null;
    const coordLng = customer_lng ? Number(customer_lng) : null;
    if (fb_id) {
      const { rows: [c] } = await client.query(
        `INSERT INTO customers (tenant_id, name, phone, email, address, fb_id, addr_lat, addr_lng)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (tenant_id, fb_id) DO UPDATE
           SET name=$2, phone=$3,
               email=COALESCE($4, customers.email),
               address=$5,
               addr_lat=COALESCE($7, customers.addr_lat),
               addr_lng=COALESCE($8, customers.addr_lng)
         RETURNING id`,
        [req.params.tenantId, name.trim(), phone.trim(), email?.trim() || null, address.trim(), fb_id, coordLat, coordLng]
      );
      customerId = c.id;
    } else {
      const { rows: [existing] } = await client.query(
        'SELECT id FROM customers WHERE tenant_id=$1 AND phone=$2',
        [req.params.tenantId, phone.trim()]
      );
      if (existing) {
        await client.query(
          `UPDATE customers SET email=COALESCE($1, email), address=$2,
           addr_lat=COALESCE($3, addr_lat), addr_lng=COALESCE($4, addr_lng) WHERE id=$5`,
          [email?.trim() || null, address.trim(), coordLat, coordLng, existing.id]
        );
        customerId = existing.id;
      } else {
        const { rows: [newC] } = await client.query(
          'INSERT INTO customers (tenant_id, name, phone, email, address, addr_lat, addr_lng) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id',
          [req.params.tenantId, name.trim(), phone.trim(), email?.trim() || null, address.trim(), coordLat, coordLng]
        );
        customerId = newC.id;
      }
    }

    // Referral attribution — prefer explicit ref_code (web form), fall back to Messenger conversation ref
    let referralRef = null;
    if (ref_code?.trim()) {
      // Web booking with ?ref=CODE — verify the ref actually exists for this tenant
      const { rows: [link] } = await db.query(
        `SELECT ref FROM referral_links WHERE tenant_id=$1 AND ref=$2`,
        [req.params.tenantId, ref_code.trim().toUpperCase()]
      );
      referralRef = link?.ref || null;
    } else if (fb_id) {
      // Messenger booking — pull ref stored when customer clicked m.me link
      const { rows: [conv] } = await db.query(
        `SELECT referral_ref FROM conversations WHERE tenant_id=$1 AND fb_user_id=$2`,
        [req.params.tenantId, fb_id]
      );
      referralRef = conv?.referral_ref || null;
    }

    // Generate booking ref — atomic counter, never reuses numbers even if orders are deleted
    const { rows: [{ last_ref }] } = await client.query(
      `INSERT INTO booking_ref_counters (tenant_id, last_ref) VALUES ($1, 1)
       ON CONFLICT (tenant_id) DO UPDATE SET last_ref = booking_ref_counters.last_ref + 1
       RETURNING last_ref`,
      [req.params.tenantId]
    );
    const bookingRef = 'BKG-' + String(last_ref).padStart(6, '0');


    const servicesTotal = pricedItems.reduce((s, i) => s + i.effectiveSubtotal + i.addonTotal, 0);

    // Promo code
    let promoDiscount = 0, promoCodeApplied = null;
    if (promo_code?.trim()) {
      const { rows: [promo] } = await client.query(
        `SELECT * FROM promo_codes WHERE tenant_id=$1 AND code=$2 AND active=TRUE FOR UPDATE`,
        [req.params.tenantId, promo_code.trim().toUpperCase()]
      );
      if (promo && !(promo.expires_at && new Date(promo.expires_at) < new Date())
               && !(promo.max_uses !== null && promo.uses_count >= promo.max_uses)
               && !(promo.min_order && servicesTotal + deliveryFee < Number(promo.min_order))) {
        promoDiscount = promo.discount_type === 'percent'
          ? Math.round(Math.min((servicesTotal + deliveryFee) * Number(promo.discount_value) / 100, servicesTotal + deliveryFee) * 100) / 100
          : Math.min(Number(promo.discount_value), servicesTotal + deliveryFee);
        promoCodeApplied = promo.code;
        await client.query('UPDATE promo_codes SET uses_count=uses_count+1 WHERE id=$1', [promo.id]);
      }
    }

    const grandTotal = Math.max(0, servicesTotal + deliveryFee - promoDiscount);
    const createdOrders = [];

    for (let i = 0; i < pricedItems.length; i++) {
      const { service, effectiveSubtotal, addonTotal, weight } = pricedItems[i];
      // Delivery fee only on first order; others are ₱0
      const itemDeliveryFee = i === 0 ? deliveryFee : 0;

      // ⚠️  INVARIANT: orders.price = service subtotal ONLY.
      // orders.delivery_fee is its own column — never add itemDeliveryFee here.
      // Grand total shown to the customer = price + delivery_fee (- promo_discount on row 0).
      // Xendit invoice uses `grandTotal` (computed above), which already includes delivery_fee.
      const itemServicePrice = effectiveSubtotal + addonTotal;

      const orderId = randomUUID();

      const orderStatus = isDropoff ? 'AWAITING PAYMENT' : 'NEW ORDER';
      const orderPaid   = false;

      // Auto-calculate delivery_date = pickup_date + max resolvedTurnaround across all cart items
      // resolvedTurnaround already accounts for per-option overrides (e.g. Express = 1 day)
      let deliveryDate = null;
      try {
        const maxTurnaround = Math.max(...pricedItems.map(pi => pi.resolvedTurnaround));
        const pd = new Date(pickupNormalized);
        if (!isNaN(pd.getTime())) {
          pd.setDate(pd.getDate() + maxTurnaround);
          deliveryDate = pd.toISOString();
        }
      } catch (_) {}

      const orderSource = fb_id ? 'messenger' : 'web';
      await client.query(
        `INSERT INTO orders (id, tenant_id, customer_id, service_id, weight, price, pickup_date,
                             address, delivery_fee, delivery_zone, notes, status, booking_ref, custom_selections, paid, delivery_date, source,
                             promo_code, promo_discount, referral_ref, is_dropoff)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)`,
        [orderId, req.params.tenantId, customerId, service.id,
         weight, itemServicePrice, pickupNormalized, address.trim(),
         itemDeliveryFee, i === 0 ? zoneName : null, notes?.trim() || null, orderStatus, bookingRef,
         cart[i].custom_fields ? JSON.stringify(cart[i].custom_fields) : null, orderPaid, deliveryDate, orderSource,
         i === 0 ? (promoCodeApplied || null) : null, i === 0 ? (promoDiscount || 0) : 0,
         i === 0 ? (referralRef || null) : null, isDropoff]
      );
      createdOrders.push({ order_id: orderId, service_name: service.name, price: itemServicePrice });
    }

    await client.query('COMMIT');

    // Payment setup — branch on tenant payment_mode
    let paymentUrl = null;
    let qrUrl = null;
    try {
      const { rows: [t] } = await db.query('SELECT xendit_api_key, fb_page_id, payment_mode, qr_image_url FROM tenants WHERE id=$1', [req.params.tenantId]);

      if (t?.payment_mode === 'qr_static') {
        // QR-static: no Xendit invoice — use tenant's merchant QR image
        qrUrl = t.qr_image_url || null;
      } else if (t?.xendit_api_key) {
        // Xendit: create invoice as before (unchanged)
        const invoice = await createInvoice(t.xendit_api_key, {
          externalId: bookingRef,
          amount: grandTotal,
          payerEmail: email?.trim() || undefined,
          description: `Booking ${bookingRef} — ${pricedItems.map(i => i.service.name).join(', ')}`,
          successRedirectUrl: t.fb_page_id
            ? `https://m.me/${t.fb_page_id}?ref=${bookingRef}`
            : undefined,
        });
        await db.query('UPDATE orders SET xendit_invoice_url=$1 WHERE booking_ref=$2', [invoice.invoiceUrl, bookingRef]);
        paymentUrl = invoice.invoiceUrl;
      }
    } catch (e) {
      console.warn('[public order] payment setup failed:', e.message);
    }

    // Resolve fb_id — use request value or fall back to stored customer record
    const { rows: [customerRow] } = await db.query('SELECT fb_id FROM customers WHERE id=$1', [customerId]);
    const effectiveFbId = fb_id || customerRow?.fb_id || null;

    // Mark any in-progress cart as converted so cart reminders stop firing
    if (effectiveFbId) {
      await db.query(
        `UPDATE carts SET converted=TRUE WHERE tenant_id=$1 AND fb_user_id=$2 AND converted=FALSE`,
        [req.params.tenantId, effectiveFbId]
      ).catch(() => {});
    }

    // Messenger confirmation to customer
    if (effectiveFbId) {
      try {
        const { rows: [tenant] } = await db.query(
          'SELECT name, fb_page_access_token FROM tenants WHERE id=$1', [req.params.tenantId]
        );
        if (tenant?.fb_page_access_token) {
          const pickupFormatted = (() => {
            try {
              return new Date(pickupNormalized).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Manila' });
            } catch { return pickup_date; }
          })();
          const servicesList = createdOrders.map(o => `• ${o.service_name} — ₱${Number(o.price).toLocaleString('en-PH')}`).join('\n');
          const confirmText = isDropoff
            ? `📋 Drop-off Booking Received!\n\n` +
              `Ref: ${bookingRef}\n` +
              `Hi ${name.trim()}! Your drop-off booking is received.\n\n` +
              `${servicesList}\n\n` +
              `📅 Drop-off: ${pickupFormatted}\n` +
              `💰 Total: ₱${Number(grandTotal).toLocaleString('en-PH')}\n\n` +
              (qrUrl
                ? `⚠️ Please scan the QR code sent to you and upload your payment screenshot to confirm your slot.`
                : `⚠️ Please complete your payment BEFORE dropping off your laundry. Your slot is not confirmed until payment is received.`)
            : `✅ Booking Confirmed!\n\n` +
              `Ref: ${bookingRef}\n` +
              `Hi ${name.trim()}! We've received your order.\n\n` +
              `${servicesList}\n\n` +
              `📅 Pickup: ${pickupFormatted}\n` +
              `💰 Total: ₱${Number(grandTotal).toLocaleString('en-PH')}\n\n` +
              (qrUrl
                ? `Please scan the QR code and upload your payment screenshot to confirm your booking. Thank you! 🧺`
                : `We'll be in touch to confirm your pickup. Thank you for choosing ${tenant.name}! 🧺`);

          if (paymentUrl) {
            await sendButtons(tenant.fb_page_access_token, effectiveFbId, confirmText, [{
              type: 'web_url',
              url: paymentUrl,
              title: '💳 Pay Now',
            }]);
          } else {
            await sendMessage(tenant.fb_page_access_token, effectiveFbId, confirmText);
          }
        }
      } catch (e) {
        console.warn('[public order] messenger confirmation failed:', e.response?.data?.error?.message || e.message);
      }
    }

    // Tenant push notification — new order
    sendPushToTenant(req.params.tenantId, {
      title: 'New Order',
      body: `${name.trim()} — ${pricedItems.map(i => i.service.name).join(', ')}`,
      url: '/orders',
    }).catch(() => {});

    // Tenant new order notification
    sendNewOrderEmail(req.params.tenantId, {
      orderId: bookingRef,
      serviceName: pricedItems.map(i => i.service.name).join(', '),
      customerName: name.trim(),
      customerPhone: phone.trim(),
      address: address.trim(),
      pickupDate: pickupNormalized,
      deliveryZone: zoneName || null,
      total: grandTotal,
      paymentUrl,
    }).catch(e => console.warn('[email] new order notify failed:', e.response?.data || e.message));

    // Customer booking confirmation
    sendCustomerOrderEmail(req.params.tenantId, {
      orderId: bookingRef,
      customerName: name.trim(),
      customerEmail: email?.trim() || null,
      serviceName: pricedItems.map(i => i.service.name).join(', '),
      pickupDate: pickupNormalized,
      address: address.trim(),
      total: grandTotal,
      paymentUrl,
    }).catch(e => console.warn('[email] customer confirm failed:', e.response?.data || e.message));

    res.json({
      booking_ref: bookingRef,
      order_ids: createdOrders.map(o => o.order_id),
      items: createdOrders,
      payment_url: paymentUrl,
      qr_url: qrUrl,
      total: grandTotal,
      promo_discount: promoDiscount,
      promo_code: promoCodeApplied,
      is_dropoff: isDropoff,
    });
  } catch (err) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    console.error('[public order]', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    if (client) client.release();
  }
});

// GET reorder data — returns a previous order's details for prefilling the booking form
router.get('/:tenantId/reorder/:orderId', async (req, res) => {
  const { psid, phone } = req.query;
  try {
    const { rows: [order] } = await db.query(
      `SELECT o.id, o.booking_ref, o.service_id, o.address, o.delivery_zone, o.notes,
              o.custom_selections, o.is_dropoff, o.customer_id, o.weight,
              s.name AS service_name,
              dz.id AS delivery_zone_id
       FROM orders o
       LEFT JOIN services s ON s.id = o.service_id
       LEFT JOIN delivery_zones dz ON dz.name = o.delivery_zone AND dz.tenant_id = o.tenant_id
       WHERE o.id = $1 AND o.tenant_id = $2`,
      [req.params.orderId, req.params.tenantId]
    );
    if (!order) return res.status(404).json({ error: 'Order not found' });

    let authorized = false;
    if (psid) {
      const { rows: [c] } = await db.query(
        `SELECT id FROM customers WHERE id=$1 AND fb_id=$2`,
        [order.customer_id, psid]
      );
      authorized = !!c;
    }
    if (!authorized && phone) {
      const { rows: [c] } = await db.query(
        `SELECT id FROM customers WHERE id=$1 AND phone=$2`,
        [order.customer_id, phone.trim()]
      );
      authorized = !!c;
    }
    if (!authorized) return res.status(403).json({ error: 'Not authorized to access this order' });

    res.json({
      booking_ref: order.booking_ref,
      service_id: order.service_id,
      service_name: order.service_name,
      address: order.address,
      delivery_zone_id: order.delivery_zone_id,
      delivery_zone: order.delivery_zone,
      notes: order.notes,
      custom_selections: order.custom_selections,
      is_dropoff: order.is_dropoff,
      weight: order.weight ? Number(order.weight) : null,
    });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

// POST save/update an in-progress cart (called by BookingForm on first item add)
router.post('/:tenantId/cart', async (req, res) => {
  const { fb_user_id, items, step } = req.body;
  if (!items?.length) return res.status(400).json({ error: 'items required' });
  try {
    const { rows: [cart] } = await db.query(
      `INSERT INTO carts (tenant_id, fb_user_id, items, step)
       VALUES ($1, $2, $3::jsonb, $4)
       RETURNING id`,
      [req.params.tenantId, fb_user_id || null, JSON.stringify(items), step || 1]
    );
    res.json({ cart_id: cart.id });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

// PATCH update cart step or mark converted
router.patch('/:tenantId/cart/:cartId', async (req, res) => {
  const { step, items, converted } = req.body;
  try {
    const fields = ['updated_at = NOW()'];
    const params = [];
    if (step      !== undefined) { fields.push(`step = $${params.length + 1}`);      params.push(step); }
    if (items     !== undefined) { fields.push(`items = $${params.length + 1}::jsonb`); params.push(JSON.stringify(items)); }
    if (converted !== undefined) { fields.push(`converted = $${params.length + 1}`); params.push(converted);
      if (converted) fields.push('converted_at = NOW()'); }
    params.push(req.params.cartId, req.params.tenantId);
    await db.query(
      `UPDATE carts SET ${fields.join(', ')} WHERE id=$${params.length - 1} AND tenant_id=$${params.length}`,
      params
    );
    res.json({ ok: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

module.exports = router;
