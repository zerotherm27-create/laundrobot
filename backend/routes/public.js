const router = require('express').Router();
const axios = require('axios');
const db = require('../db');
const { createInvoice } = require('../utils/xendit');
const { sendNewOrderEmail } = require('../utils/email');
const { sendMessage, sendButtons } = require('../utils/messenger');
const { haversine } = require('./deliveryBrackets');

// Public geocode proxy — single result (kept for saved-address geocoding)
router.get('/geocode', async (req, res) => {
  const { q } = req.query;
  if (!q?.trim()) return res.status(400).json({ error: 'query required' });
  try {
    const { data } = await axios.get('https://nominatim.openstreetmap.org/search', {
      params: { q: q.trim(), format: 'json', limit: 1, countrycodes: 'ph' },
      headers: { 'User-Agent': 'LaundroBot/1.0 (laundrobot@thelaundryproject.ph)' },
      timeout: 8000,
    });
    if (!data.length) return res.json(null);
    res.json({ lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Address autocomplete — returns up to 5 suggestions with coords
router.get('/geocode/suggest', async (req, res) => {
  const { q } = req.query;
  if (!q?.trim() || q.trim().length < 3) return res.json([]);
  try {
    const { data } = await axios.get('https://nominatim.openstreetmap.org/search', {
      params: { q: q.trim(), format: 'json', limit: 5, countrycodes: 'ph', addressdetails: 1 },
      headers: { 'User-Agent': 'LaundroBot/1.0 (laundrobot@thelaundryproject.ph)' },
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
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET tenant info (name + logo + store hours for booking form)
router.get('/:tenantId/info', async (req, res) => {
  try {
    const { rows: [t] } = await db.query(
      `SELECT name, logo_url, contact_number, minimum_order, fb_page_id,
              to_char(store_open, 'HH24:MI') AS store_open,
              to_char(store_close, 'HH24:MI') AS store_close,
              to_char(booking_cutoff, 'HH24:MI') AS booking_cutoff
       FROM tenants WHERE id=$1 AND active=TRUE`,
      [req.params.tenantId]
    );
    if (!t) return res.status(404).json({ error: 'Shop not found' });
    res.json(t);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET blocked dates for public booking form
router.get('/:tenantId/blocked-dates', async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT date::text, reason FROM blocked_dates WHERE tenant_id=$1 AND date >= CURRENT_DATE ORDER BY date ASC`,
      [req.params.tenantId]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET active categories
router.get('/:tenantId/categories', async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT id, name FROM service_categories WHERE tenant_id=$1 AND active=TRUE ORDER BY sort_order, id',
      [req.params.tenantId]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET active services with custom fields
router.get('/:tenantId/services', async (req, res) => {
  try {
    const { rows: services } = await db.query(
      `SELECT s.id, s.name, s.price, s.unit, s.description, s.image_url, s.category_id,
              c.name AS category_name
       FROM services s
       LEFT JOIN service_categories c ON c.id = s.category_id
       WHERE s.tenant_id=$1 AND s.active=TRUE
       ORDER BY s.sort_order, s.id`,
      [req.params.tenantId]
    );
    for (const svc of services) {
      const { rows: fields } = await db.query(
        'SELECT id, label, field_type, placeholder, required, options, min_value, max_value, unit_price, allow_own, linked_to_field_label, linked_to_value, sync_qty FROM service_custom_fields WHERE service_id=$1 ORDER BY sort_order',
        [svc.id]
      );
      svc.custom_fields = fields;
    }
    res.json(services);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET customer by phone — repeat customer lookup
router.get('/:tenantId/customer', async (req, res) => {
  const { phone } = req.query;
  if (!phone?.trim()) return res.json(null);
  try {
    const { rows: [customer] } = await db.query(
      `SELECT c.name, c.phone, c.email,
              (SELECT o.address FROM orders o WHERE o.customer_id=c.id AND o.address IS NOT NULL ORDER BY o.created_at DESC LIMIT 1) AS address
       FROM customers c
       WHERE c.tenant_id=$1 AND c.phone=$2`,
      [req.params.tenantId, phone.trim()]
    );
    if (!customer || !customer.address) return res.json(null);
    res.json({ name: customer.name, phone: customer.phone, email: customer.email, address: customer.address });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET active delivery zones
router.get('/:tenantId/delivery-zones', async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT id, name, fee, custom_note FROM delivery_zones WHERE tenant_id=$1 AND active=TRUE ORDER BY sort_order, id',
      [req.params.tenantId]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
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
  } catch (err) { res.status(500).json({ error: err.message }); }
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
  } catch (err) { res.status(500).json({ error: err.message }); }
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
    return fd && cf.value ? sum + Number(fd.unit_price || 0) * (parseInt(cf.value) || 0) : sum;
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
  const { cart, name, phone, email, address, pickup_date, delivery_zone_id, customer_lat, customer_lng, notes, promo_code, fb_id, initial_status, paid: initialPaid, source, custom_delivery_fee } = req.body;

  if (!cart?.length || !name?.trim() || !phone?.trim() || !address?.trim() || !pickup_date?.trim()) {
    return res.status(400).json({ error: 'Cart, name, phone, address, and pickup date are required.' });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // Price all cart items (parallel reads from pool)
    const pricedItems = await Promise.all(
      cart.map(item => calcItemPrice(req.params.tenantId, item.service_id, item.custom_fields))
    );

    // Delivery fee — custom override takes priority, then bracket-based or legacy zone
    let deliveryFee = 0, zoneName = null;
    if (custom_delivery_fee != null && custom_delivery_fee !== '') {
      deliveryFee = Math.max(0, Number(custom_delivery_fee) || 0);
      zoneName = 'Custom';
    } else
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
    const { rows: [existing] } = await client.query(
      'SELECT * FROM customers WHERE tenant_id=$1 AND phone=$2',
      [req.params.tenantId, phone.trim()]
    );
    let customerId;
    if (existing) {
      await client.query('UPDATE customers SET name=$1, email=$2, address=$3, fb_id=COALESCE($4, fb_id) WHERE id=$5',
        [name.trim(), email?.trim() || existing.email, address.trim(), fb_id || null, existing.id]);
      customerId = existing.id;
    } else {
      const { rows: [newC] } = await client.query(
        'INSERT INTO customers (tenant_id, name, phone, email, address, fb_id) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id',
        [req.params.tenantId, name.trim(), phone.trim(), email?.trim() || null, address.trim(), fb_id || null]
      );
      customerId = newC.id;
    }

    // Generate booking ref
    const { rows: [{ count: bkgCount }] } = await client.query(
      `SELECT COUNT(DISTINCT booking_ref) FROM orders WHERE tenant_id=$1 AND booking_ref IS NOT NULL`,
      [req.params.tenantId]
    );
    const bookingRef = 'BKG-' + String(Number(bkgCount) + 1).padStart(6, '0');

    // Base order count (increment manually for each item in the loop)
    const { rows: [{ count: baseCount }] } = await client.query(
      'SELECT COUNT(*) FROM orders WHERE tenant_id=$1', [req.params.tenantId]
    );
    let orderCount = Number(baseCount);

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
      const itemTotal = effectiveSubtotal + addonTotal + itemDeliveryFee;

      orderCount++;
      const orderId = 'ORD-' + String(orderCount).padStart(6, '0');

      const orderStatus = initial_status || 'NEW ORDER';
      const orderPaid   = initialPaid === true || initialPaid === 'true' ? true : false;

      // Auto-calculate delivery_date = pickup_date + max resolvedTurnaround across all cart items
      // resolvedTurnaround already accounts for per-option overrides (e.g. Express = 1 day)
      let deliveryDate = null;
      try {
        const maxTurnaround = Math.max(...pricedItems.map(pi => pi.resolvedTurnaround));
        const pd = new Date(pickup_date.trim());
        if (!isNaN(pd.getTime())) {
          pd.setDate(pd.getDate() + maxTurnaround);
          deliveryDate = pd.toISOString();
        }
      } catch (_) {}

      const orderSource = source || 'web';
      await client.query(
        `INSERT INTO orders (id, tenant_id, customer_id, service_id, weight, price, pickup_date,
                             address, delivery_fee, delivery_zone, notes, status, booking_ref, custom_selections, paid, delivery_date, source,
                             promo_code, promo_discount)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)`,
        [orderId, req.params.tenantId, customerId, service.id,
         weight, itemTotal, pickup_date.trim(), address.trim(),
         itemDeliveryFee, i === 0 ? zoneName : null, notes?.trim() || null, orderStatus, bookingRef,
         cart[i].custom_fields ? JSON.stringify(cart[i].custom_fields) : null, orderPaid, deliveryDate, orderSource,
         i === 0 ? (promoCodeApplied || null) : null, i === 0 ? (promoDiscount || 0) : 0]
      );
      createdOrders.push({ order_id: orderId, service_name: service.name, price: itemTotal });
    }

    await client.query('COMMIT');

    // Xendit invoice (one for the whole booking)
    let paymentUrl = null;
    try {
      const { rows: [t] } = await db.query('SELECT xendit_api_key, fb_page_id FROM tenants WHERE id=$1', [req.params.tenantId]);
      if (t?.xendit_api_key) {
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
      console.warn('[public order] xendit invoice failed:', e.message);
    }

    // Resolve fb_id — use request value or fall back to stored customer record
    const { rows: [customerRow] } = await db.query('SELECT fb_id FROM customers WHERE id=$1', [customerId]);
    const effectiveFbId = fb_id || customerRow?.fb_id || null;

    // Messenger confirmation to customer
    if (effectiveFbId) {
      try {
        const { rows: [tenant] } = await db.query(
          'SELECT name, fb_page_access_token FROM tenants WHERE id=$1', [req.params.tenantId]
        );
        if (tenant?.fb_page_access_token) {
          const pickupFormatted = (() => {
            try {
              return new Date(pickup_date).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' });
            } catch { return pickup_date; }
          })();
          const servicesList = createdOrders.map(o => `• ${o.service_name} — ₱${Number(o.price).toLocaleString('en-PH')}`).join('\n');
          const confirmText =
            `✅ Booking Confirmed!\n\n` +
            `Ref: ${bookingRef}\n` +
            `Hi ${name.trim()}! We've received your order.\n\n` +
            `${servicesList}\n\n` +
            `📅 Pickup: ${pickupFormatted}\n` +
            `💰 Total: ₱${Number(grandTotal).toLocaleString('en-PH')}\n\n` +
            `We'll be in touch to confirm your pickup. Thank you for choosing ${tenant.name}! 🧺`;

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

    // Email notification
    sendNewOrderEmail(req.params.tenantId, {
      orderId: bookingRef,
      serviceName: pricedItems.map(i => i.service.name).join(', '),
      customerName: name.trim(),
      customerPhone: phone.trim(),
      address: address.trim(),
      pickupDate: pickup_date.trim(),
      deliveryZone: zoneName || null,
      total: grandTotal,
      paymentUrl,
    }).catch(() => {});

    res.json({
      booking_ref: bookingRef,
      order_ids: createdOrders.map(o => o.order_id),
      items: createdOrders,
      payment_url: paymentUrl,
      total: grandTotal,
      promo_discount: promoDiscount,
      promo_code: promoCodeApplied,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[public order]', err.message);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;
