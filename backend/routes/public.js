const router = require('express').Router();
const db = require('../db');
const { createInvoice } = require('../utils/xendit');
const { sendNewOrderEmail } = require('../utils/email');

// GET tenant info (name + logo + store hours for booking form)
router.get('/:tenantId/info', async (req, res) => {
  try {
    const { rows: [t] } = await db.query(
      `SELECT name, logo_url, contact_number,
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
        'SELECT id, label, field_type, placeholder, required, options, min_value, max_value, unit_price FROM service_custom_fields WHERE service_id=$1 ORDER BY sort_order',
        [svc.id]
      );
      svc.custom_fields = fields;
      // Skip base64 images — not usable in img tags for public form
      if (svc.image_url && svc.image_url.startsWith('data:')) svc.image_url = null;
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
      'SELECT id, name, fee FROM delivery_zones WHERE tenant_id=$1 AND active=TRUE ORDER BY sort_order, id',
      [req.params.tenantId]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST create order (public booking)
router.post('/:tenantId/orders', async (req, res) => {
  const { service_id, custom_fields, name, phone, email, address, pickup_date, delivery_zone_id, notes } = req.body;

  if (!service_id || !name?.trim() || !phone?.trim() || !address?.trim() || !pickup_date?.trim()) {
    return res.status(400).json({ error: 'Service, name, phone, address, and pickup date are required.' });
  }

  try {
    // Validate service
    const { rows: [service] } = await db.query(
      'SELECT * FROM services WHERE id=$1 AND tenant_id=$2 AND active=TRUE',
      [service_id, req.params.tenantId]
    );
    if (!service) return res.status(404).json({ error: 'Service not found' });

    // Delivery zone
    let deliveryFee = 0;
    let zoneName = null;
    if (delivery_zone_id) {
      const { rows: [zone] } = await db.query(
        'SELECT * FROM delivery_zones WHERE id=$1 AND tenant_id=$2 AND active=TRUE',
        [delivery_zone_id, req.params.tenantId]
      );
      if (zone) { deliveryFee = Number(zone.fee); zoneName = zone.name; }
    }

    // Calculate price
    const isPerKg = service.unit && service.unit.toLowerCase().includes('kg');
    const weightField = (custom_fields || []).find(f => f.label?.toLowerCase().includes('weight'));
    const weight = weightField ? parseFloat(weightField.value) || null : null;

    // Fetch custom fields for qty multiplier + addon prices
    const { rows: svcFields } = await db.query(
      'SELECT id, label, field_type, unit_price, options FROM service_custom_fields WHERE service_id=$1',
      [service_id]
    );
    // First number-type field = qty multiplier (non-kg)
    const numField = svcFields.find(f => f.field_type === 'number');
    const qtyField = numField ? (custom_fields || []).find(f => f.label === numField.label) : null;
    const qty = qtyField ? parseFloat(qtyField.value) || 0 : 0;

    const subtotal = isPerKg && weight
      ? Number(service.price) * weight
      : (qty > 0 ? Number(service.price) * qty : Number(service.price));

    // Sum addon fields
    const addonTotal = (custom_fields || []).reduce((sum, cf) => {
      const fieldDef = svcFields.find(f => f.field_type === 'addon' && f.label === cf.label);
      if (fieldDef && cf.value) {
        return sum + Number(fieldDef.unit_price || 0) * (parseInt(cf.value) || 0);
      }
      return sum;
    }, 0);

    // Sum variation (select) field option prices (with copy_base support)
    const selectFieldDefs = svcFields.filter(f => f.field_type === 'select');

    // Base variation price = price of the first fixed-priced selected option with price > 0
    let baseVariationPrice = 0;
    for (const fieldDef of selectFieldDefs) {
      const cf = (custom_fields || []).find(c => c.label === fieldDef.label);
      if (!cf?.value) continue;
      const options = Array.isArray(fieldDef.options) ? fieldDef.options : [];
      const selectedOpt = options.find(o => typeof o === 'object' ? o.label === cf.value : o === cf.value);
      if (selectedOpt && typeof selectedOpt === 'object') {
        const priceType = selectedOpt.price_type || 'fixed';
        const optPrice = Number(selectedOpt.price || 0);
        if (priceType !== 'copy_base' && optPrice > 0) {
          baseVariationPrice = optPrice;
          break;
        }
      }
    }

    const variationTotal = (custom_fields || []).reduce((sum, cf) => {
      const fieldDef = svcFields.find(f => f.field_type === 'select' && f.label === cf.label);
      if (fieldDef && cf.value) {
        const options = Array.isArray(fieldDef.options) ? fieldDef.options : [];
        const selectedOpt = options.find(o =>
          typeof o === 'object' ? o.label === cf.value : o === cf.value
        );
        if (selectedOpt && typeof selectedOpt === 'object') {
          const priceType = selectedOpt.price_type || 'fixed';
          const optPrice = priceType === 'copy_base' ? baseVariationPrice : Number(selectedOpt.price || 0);
          return sum + optPrice;
        }
      }
      return sum;
    }, 0);

    // If service has variation pricing, base price is 0
    const hasVarPricing = svcFields.some(f =>
      f.field_type === 'select' &&
      Array.isArray(f.options) &&
      f.options.some(o => Number(typeof o === 'object' ? o.price : 0) > 0)
    );
    // When qty > 0 with variation pricing, primary (first priced) variation is multiplied by qty; rest flat
    const effectiveSubtotal = hasVarPricing
      ? (qty > 0 ? baseVariationPrice * qty + (variationTotal - baseVariationPrice) : variationTotal)
      : subtotal;

    const total = effectiveSubtotal + addonTotal + deliveryFee;

    // Get or create customer
    const { rows: [existing] } = await db.query(
      'SELECT * FROM customers WHERE tenant_id=$1 AND phone=$2',
      [req.params.tenantId, phone.trim()]
    );
    let customerId;
    if (existing) {
      await db.query('UPDATE customers SET name=$1, email=$2, address=$3 WHERE id=$4',
        [name.trim(), email?.trim() || existing.email, address.trim(), existing.id]);
      customerId = existing.id;
    } else {
      const { rows: [newC] } = await db.query(
        'INSERT INTO customers (tenant_id, name, phone, email, address) VALUES ($1,$2,$3,$4,$5) RETURNING id',
        [req.params.tenantId, name.trim(), phone.trim(), email?.trim() || null, address.trim()]
      );
      customerId = newC.id;
    }

    // Generate order ID
    const { rows: [{ count }] } = await db.query(
      'SELECT COUNT(*) FROM orders WHERE tenant_id=$1', [req.params.tenantId]
    );
    const orderId = 'ORD-' + String(Number(count) + 1).padStart(6, '0');

    await db.query(
      `INSERT INTO orders (id, tenant_id, customer_id, service_id, weight, price, pickup_date,
                           address, delivery_fee, delivery_zone, notes, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'NEW ORDER')`,
      [orderId, req.params.tenantId, customerId, service_id,
       weight, total, pickup_date.trim(), address.trim(),
       deliveryFee, zoneName, notes?.trim() || null]
    );

    // Generate Xendit invoice if configured
    let paymentUrl = null;
    try {
      const { rows: [t] } = await db.query('SELECT xendit_api_key FROM tenants WHERE id=$1', [req.params.tenantId]);
      if (t?.xendit_api_key) {
        const invoice = await createInvoice(t.xendit_api_key, {
          externalId: orderId,
          amount: total,
          payerEmail: email?.trim() || undefined,
          description: `${service.name} — Order ${orderId}`,
        });
        await db.query('UPDATE orders SET xendit_invoice_url=$1 WHERE id=$2', [invoice.invoiceUrl, orderId]);
        paymentUrl = invoice.invoiceUrl;
      }
    } catch (e) {
      console.warn('[public order] xendit invoice failed:', e.message);
    }

    // Send new order email notification (non-blocking)
    sendNewOrderEmail(req.params.tenantId, {
      orderId,
      serviceName: service.name,
      customerName: name.trim(),
      customerPhone: phone.trim(),
      address: address.trim(),
      pickupDate: pickup_date.trim(),
      deliveryZone: zoneName || null,
      total,
      paymentUrl,
    }).catch(() => {});

    res.json({ order_id: orderId, payment_url: paymentUrl, total, service_name: service.name });
  } catch (err) {
    console.error('[public order]', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
