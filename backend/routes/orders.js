const router = require('express').Router();
const { randomUUID } = require('crypto');
const auth = require('../middleware/auth');
const db = require('../db');
const { sendTaggedMessage, sendStatusUpdate, sendButtons } = require('../utils/messenger');
const { createInvoice, createRefund, getInvoiceStatus } = require('../utils/xendit');
const { sendInvoiceEmail, sendCustomerPaymentEmail, sendPaidOrderEmail } = require('../utils/email');
const { sendPushToTenant } = require('../utils/push');

const { deductInventory } = require('./inventory');
const MONTH_LIMITS = { starter: 200, growth: 1000, pro: Infinity };

// Naive datetime strings from the dashboard mean Asia/Manila wall-clock time. Pin the
// offset so a UTC server/DB doesn't read them as UTC (+8h display shift). Leaves
// strings that already carry Z/offset, and bare dates ("2026-06-10"), untouched.
function normalizeManila(str) {
  const s = String(str).trim();
  return /T.*$/.test(s) && !/(Z|[+-]\d{2}:?\d{2})$/.test(s) ? `${s}+08:00` : s;
}

// POST walk-in order (staff POS — paid in cash/QR/card, no Xendit required)
router.post('/walk-in', auth, async (req, res) => {
  const { cart, name, phone, email, address, notes, pickup_date, payment_method, paid } = req.body;
  const isPaid       = paid !== false;   // true unless caller explicitly sends false (credit card)
  const paymentMeth  = payment_method || 'gcash';
  if (!cart?.length || !name?.trim() || !phone?.trim()) {
    return res.status(400).json({ error: 'Cart, name, and phone are required.' });
  }
  let client;
  try {
    const { rows: [tenant] } = await db.query('SELECT plan FROM tenants WHERE id=$1', [req.user.tenant_id]);
    const monthLimit = MONTH_LIMITS[tenant?.plan || 'starter'] ?? 200;
    if (isFinite(monthLimit)) {
      const { rows: [{ count }] } = await db.query(
        `SELECT COUNT(*) FROM orders WHERE tenant_id=$1 AND date_trunc('month', created_at) = date_trunc('month', NOW())`,
        [req.user.tenant_id]
      );
      if (Number(count) >= monthLimit) {
        return res.status(403).json({ error: `You've reached your ${monthLimit}-order/month limit on the ${tenant?.plan || 'starter'} plan. Upgrade to continue.` });
      }
    }
    client = await db.pool.connect();
    await client.query('BEGIN');

    // Find or create customer
    const { rows: [existing] } = await client.query(
      'SELECT * FROM customers WHERE tenant_id=$1 AND phone=$2',
      [req.user.tenant_id, phone.trim()]
    );
    let customerId;
    if (existing) {
      await client.query(
        'UPDATE customers SET email=COALESCE($1, email), address=COALESCE($2, address) WHERE id=$3',
        [email?.trim() || null, address?.trim() || null, existing.id]
      );
      customerId = existing.id;
    } else {
      const { rows: [newC] } = await client.query(
        'INSERT INTO customers (tenant_id, name, phone, email, address) VALUES ($1,$2,$3,$4,$5) RETURNING id',
        [req.user.tenant_id, name.trim(), phone.trim(), email?.trim() || null, address?.trim() || null]
      );
      customerId = newC.id;
    }

    // Booking ref — atomic counter, never reuses numbers even if orders are deleted
    const { rows: [{ last_ref }] } = await client.query(
      `INSERT INTO booking_ref_counters (tenant_id, last_ref) VALUES ($1, 1)
       ON CONFLICT (tenant_id) DO UPDATE SET last_ref = booking_ref_counters.last_ref + 1
       RETURNING last_ref`,
      [req.user.tenant_id]
    );
    const bookingRef = 'BKG-' + String(last_ref).padStart(6, '0');

    const orderIds = [];
    for (const item of cart) {
      const orderId = randomUUID();
      orderIds.push(orderId);
      await client.query(
        `INSERT INTO orders (id, tenant_id, customer_id, service_id, weight, price, pickup_date, address, notes, status, paid, booking_ref, source, custom_selections, payment_method)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'NEW ORDER',$10,$11,'walk_in',$12,$13)`,
        [orderId, req.user.tenant_id, customerId, item.service_id || null,
         item.weight || null, Number(item.price),
         pickup_date ? new Date(normalizeManila(pickup_date)).toISOString() : null,
         address?.trim() || null, notes?.trim() || null,
         isPaid,        // $10
         bookingRef,    // $11
         item.custom_fields ? JSON.stringify(item.custom_fields) : null,  // $12
         paymentMeth,   // $13
        ]
      );
    }

    await client.query('COMMIT');

    sendPushToTenant(req.user.tenant_id, {
      title: 'New Walk-in Order',
      body: `${name.trim()} — ${cart.map(i => i.service_name || 'item').join(', ')}`,
      url: '/orders',
    }).catch(() => {});

    res.json({ ok: true, booking_ref: bookingRef, order_ids: orderIds });
  } catch (err) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    console.error('[walk-in order]', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    if (client) client.release();
  }
});

// GET payment status for a booking ref (used by walk-in credit card polling)
router.get('/booking/:ref/payment-status', auth, async (req, res) => {
  try {
    const { rows: [order] } = await db.query(
      `SELECT paid FROM orders WHERE booking_ref=$1 AND tenant_id=$2 LIMIT 1`,
      [req.params.ref, req.user.tenant_id]
    );
    if (!order) return res.status(404).json({ error: 'Order not found' });
    res.json({ paid: order.paid === true });
  } catch (err) {
    console.error('[payment-status]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET all orders for tenant (archived=true to fetch archives)
router.get('/', auth, async (req, res) => {
  try {
    const { status, page = 1, archived = 'false' } = req.query;
    const limit = Math.min(parseInt(req.query.limit) || 200, 500);
    const offset = (page - 1) * limit;
    const isArchived = archived === 'true';
    let query = `
      SELECT o.*, c.name as customer_name, c.phone as customer_phone, c.address as customer_address,
             c.email as customer_email,
             s.name as service_name, s.price as service_unit_price, s.unit as service_unit
      FROM orders o
      LEFT JOIN customers c ON c.id = o.customer_id
      LEFT JOIN services s ON s.id = o.service_id
      WHERE o.tenant_id = $1 AND ${isArchived ? 'o.archived = TRUE' : '(o.archived = FALSE OR o.archived IS NULL)'}
    `;
    const params = [req.user.tenant_id];
    if (status) { query += ` AND o.status = $${params.length + 1}`; params.push(status); }
    query += ` ORDER BY o.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);
    const { rows } = await db.query(query, params);
    res.json(rows);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

// POST archive completed orders for a given month (or auto by cron)
router.post('/archive-month', auth, async (req, res) => {
  if (!['admin','superadmin'].includes(req.user.role)) return res.status(403).json({ error: 'Forbidden' });
  const { year, month } = req.body; // month = 1-12
  if (!year || !month) return res.status(400).json({ error: 'year and month required' });
  try {
    const { rowCount } = await db.query(
      `UPDATE orders SET archived=TRUE, archived_at=NOW()
       WHERE tenant_id=$1 AND status='COMPLETED' AND archived=FALSE
         AND date_part('year', created_at)=$2 AND date_part('month', created_at)=$3`,
      [req.user.tenant_id, year, month]
    );
    res.json({ archived: rowCount });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

// PUT full booking edit — update/add/remove items, return copyable summary + payment link if needed
router.put('/booking/:ref', auth, async (req, res) => {
  const { items, custom_note, custom_price } = req.body;
  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'A booking must keep at least one item. To void it entirely, use Cancel Order instead.' });
  }
  const deletedIds = Array.isArray(req.body.deleted_ids) ? req.body.deleted_ids.filter(Boolean) : [];
  const extraAmount = Number(custom_price) || 0;

  let client;
  try {
    client = await db.pool.connect();
    await client.query('BEGIN');

    const { rows: existing } = await client.query(
      `SELECT o.*, c.name AS customer_name, c.email AS customer_email
       FROM orders o LEFT JOIN customers c ON c.id = o.customer_id
       WHERE o.booking_ref=$1 AND o.tenant_id=$2`,
      [req.params.ref, req.user.tenant_id]
    );
    if (!existing.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Booking not found' });
    }

    const first = existing[0];
    const oldTotal = existing.reduce((s, o) => s + Number(o.price), 0);
    const editStamp = `[Edited by admin — ${new Date().toLocaleDateString('en-PH', { dateStyle: 'short' })}]`;

    // Remove items the admin deleted (scoped to this booking + tenant)
    for (const delId of deletedIds) {
      await client.query(
        `DELETE FROM orders WHERE id=$1 AND booking_ref=$2 AND tenant_id=$3`,
        [delId, req.params.ref, req.user.tenant_id]
      );
    }

    for (const item of items.filter(i => i.id)) {
      const cleanNotes = (item.notes || '').replace(/\[Edited by admin[^\]]*\]/g, '').trim();
      const notesWithStamp = cleanNotes ? `${cleanNotes}\n${editStamp}` : editStamp;
      const customSelections = item.custom_fields?.length ? JSON.stringify(item.custom_fields) : null;
      await client.query(
        `UPDATE orders SET service_id=$1, price=$2, notes=$3, custom_selections=$4 WHERE id=$5 AND tenant_id=$6`,
        [item.service_id || null, Number(item.price), notesWithStamp, customSelections, item.id, req.user.tenant_id]
      );
    }

    for (const item of items.filter(i => !i.id)) {
      const cleanNotes = (item.notes || '').replace(/\[Edited by admin[^\]]*\]/g, '').trim();
      const notesWithStamp = cleanNotes ? `${cleanNotes}\n${editStamp}` : editStamp;
      await client.query(
        `INSERT INTO orders (id, tenant_id, customer_id, service_id, weight, price, pickup_date,
                             address, delivery_fee, delivery_zone, notes, status, booking_ref,
                             custom_selections, paid, delivery_date, source,
                             promo_code, promo_discount, referral_ref, is_dropoff)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)`,
        [randomUUID(), first.tenant_id, first.customer_id, item.service_id || null,
         null, Number(item.price), first.pickup_date,
         first.address, 0, null, notesWithStamp, first.status, first.booking_ref,
         item.custom_fields?.length ? JSON.stringify(item.custom_fields) : null,
         first.paid, first.delivery_date, 'admin',
         null, 0, null, first.is_dropoff || false]
      );
    }

    await client.query('COMMIT');

    const { rows: updated } = await db.query(
      `SELECT o.*, s.name AS service_name
       FROM orders o LEFT JOIN services s ON s.id = o.service_id
       WHERE o.booking_ref=$1 AND o.tenant_id=$2`,
      [req.params.ref, req.user.tenant_id]
    );
    const newTotal = updated.reduce((s, o) => s + Number(o.price), 0) + extraAmount;
    const diff = newTotal - oldTotal;

    const { rows: [tenant] } = await db.query(
      'SELECT xendit_api_key, contact_number FROM tenants WHERE id=$1', [req.user.tenant_id]
    );

    let paymentUrl = null;
    if (diff > 0 && tenant?.xendit_api_key) {
      try {
        const adjRef = `${req.params.ref}-ADJ-${Date.now()}`;
        const invoice = await createInvoice(tenant.xendit_api_key, {
          externalId: adjRef,
          amount: diff,
          payerEmail: first.customer_email || undefined,
          description: `Additional payment for ${req.params.ref}`,
        });
        paymentUrl = invoice.invoiceUrl;
      } catch (e) {
        console.warn('[booking update] xendit invoice failed:', e.message);
      }
    }

    const lines = [
      `📋 Order Update — ${req.params.ref}`,
      ``,
      `Hi ${first.customer_name || 'there'}! Here's your updated order summary.`,
      ``,
      `Services:`,
      ...updated.map(o => `• ${o.service_name || 'Service'} — ₱${Number(o.price).toLocaleString('en-PH')}`),
    ];
    if (extraAmount > 0) {
      lines.push(`• Additional charges — ₱${extraAmount.toLocaleString('en-PH')}`);
    }
    if (custom_note?.trim()) {
      lines.push(``, custom_note.trim());
    }
    lines.push(``, `Total: ₱${newTotal.toLocaleString('en-PH')}`);
    if (diff > 0) {
      lines.push(`Additional Payment: ₱${diff.toLocaleString('en-PH')}`);
      if (paymentUrl) lines.push(`💳 Pay: ${paymentUrl}`);
    } else if (diff < 0) {
      lines.push(`Price reduction: ₱${Math.abs(diff).toLocaleString('en-PH')} less than original.`);
    }
    if (tenant?.contact_number) {
      lines.push(`📞 Questions? Call/SMS: ${tenant.contact_number}`);
    }

    res.json({
      ok: true,
      old_total: oldTotal,
      new_total: newTotal,
      diff,
      payment_url: paymentUrl,
      summary_text: lines.join('\n'),
      orders: updated,
    });
  } catch (err) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    console.error('[booking update]', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    if (client) client.release();
  }
});

// GET single order
router.get('/:id', auth, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT o.*, c.name as customer_name, c.phone as customer_phone, c.fb_id, c.address as customer_address,
              s.name as service_name
       FROM orders o
       LEFT JOIN customers c ON c.id = o.customer_id
       LEFT JOIN services s ON s.id = o.service_id
       WHERE o.id = $1 AND o.tenant_id = $2`,
      [req.params.id, req.user.tenant_id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Order not found' });
    res.json(rows[0]);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

// PATCH update order status / notes / service / price
router.patch('/:id', auth, async (req, res) => {
  const { status, notes, paid, service_id, weight, price, delivery_date } = req.body;
  try {
    const fields = [];
    const params = [];
    if (status        !== undefined) { fields.push(`status = $${params.length + 1}`);        params.push(status); fields.push(`overdue_notified = FALSE`); }
    if (notes         !== undefined) { fields.push(`notes = $${params.length + 1}`);         params.push(notes); }
    if (paid          !== undefined) { fields.push(`paid = $${params.length + 1}`);          params.push(paid); }
    if (service_id    !== undefined) { fields.push(`service_id = $${params.length + 1}`);    params.push(service_id); }
    if (weight        !== undefined) { fields.push(`weight = $${params.length + 1}`);        params.push(weight || null); }
    if (price         !== undefined) { fields.push(`price = $${params.length + 1}`);         params.push(price); }
    if (delivery_date !== undefined) { fields.push(`delivery_date = $${params.length + 1}`); params.push(delivery_date || null); }
    if (!fields.length) return res.status(400).json({ error: 'Nothing to update' });
    params.push(req.params.id, req.user.tenant_id);
    const { rows } = await db.query(
      `UPDATE orders SET ${fields.join(', ')} WHERE id = $${params.length - 1} AND tenant_id = $${params.length} RETURNING *`,
      params
    );
    if (!rows[0]) return res.status(404).json({ error: 'Order not found' });
    res.json(rows[0]);

    // Fire status-change Messenger notifications (fire-and-forget)
    if (status === 'COMPLETED') {
      sendCompletionNotification(rows[0], req.user.tenant_id).catch(e =>
        console.warn('[completion-notify]', e.message)
      );
      deductInventory(rows[0], req.user.tenant_id).catch(e =>
        console.warn('[inventory-deduct]', e.message)
      );
    }
    if (status === 'PROCESSING') {
      sendStatusNotification(rows[0], req.user.tenant_id, 'PROCESSING').catch(e =>
        console.warn('[processing-notify]', e.message)
      );
    }
    if (status === 'FOR DELIVERY') {
      sendStatusNotification(rows[0], req.user.tenant_id, 'FOR DELIVERY').catch(e =>
        console.warn('[delivery-notify]', e.message)
      );
    }
  } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

async function sendCompletionNotification(updatedOrder, tenantId) {
  const bookingRef = updatedOrder.booking_ref;

  if (bookingRef) {
    // Dedupe: a multi-service booking has one row per service, and all rows are
    // completed together — each one calls this. Only the booking's lowest-id row
    // proceeds, so the customer receives exactly ONE combined message.
    const { rows: [primary] } = await db.query(
      `SELECT id FROM orders WHERE booking_ref=$1 AND tenant_id=$2 ORDER BY id LIMIT 1`,
      [bookingRef, tenantId]
    );
    if (!primary || primary.id !== updatedOrder.id) return;
  }

  // Load all sibling orders with service names (Messenger orders have no booking_ref — single row)
  const { rows: siblings } = await db.query(
    `SELECT o.weight, o.price, s.name AS service_name
     FROM orders o LEFT JOIN services s ON s.id = o.service_id
     WHERE ${bookingRef ? `o.booking_ref=$1 AND o.tenant_id=$2` : `o.id=$1`}`,
    bookingRef ? [bookingRef, tenantId] : [updatedOrder.id]
  );

  // Load customer fb_id and review state
  const { rows: [orderWithCustomer] } = await db.query(
    `SELECT c.fb_id, c.name AS customer_name, c.id AS customer_id, c.has_reviewed, c.review_last_requested_at
     FROM orders o JOIN customers c ON c.id = o.customer_id
     WHERE o.id=$1`,
    [updatedOrder.id]
  );
  if (!orderWithCustomer?.fb_id) return;

  // Load tenant details
  const { rows: [tenant] } = await db.query(
    `SELECT name, fb_page_id, fb_page_access_token, google_review_link,
            COALESCE(review_cooldown_days, 30) AS review_cooldown_days
     FROM tenants WHERE id=$1`,
    [tenantId]
  );
  if (!tenant?.fb_page_access_token) return;

  // Determine if we should include the review link
  const { has_reviewed, review_last_requested_at, customer_id } = orderWithCustomer;
  let includeReview = false;
  if (tenant.google_review_link && !has_reviewed) {
    if (!review_last_requested_at) {
      includeReview = true;
    } else {
      const daysSince = (Date.now() - new Date(review_last_requested_at).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSince >= tenant.review_cooldown_days) includeReview = true;
    }
  }

  // Build service summary line (combine all siblings)
  const totalWeight = siblings.reduce((s, o) => s + Number(o.weight || 0), 0);
  const serviceNames = [...new Set(siblings.map(o => o.service_name).filter(Boolean))].join(' & ');
  const weightLine = totalWeight > 0 ? `${totalWeight} kg ` : '';

  const displayRef = bookingRef || updatedOrder.id.slice(-8).toUpperCase();
  const lines = [
    `✅ Your order from ${tenant.name} has been delivered! 🧺✨`,
    ``,
    `Order #${displayRef} — ${weightLine}${serviceNames}`,
    ``,
    `Hope everything is fresh and perfect! ${includeReview ? `If you had a great experience, a quick Google review means the world to us 🙏\n👉 ${tenant.google_review_link}\n\n` : ''}Reply anytime to book your next pickup! 😊`,
  ];

  const customerName = orderWithCustomer.customer_name || 'there';
  await sendStatusUpdate(
    tenant.fb_page_id,
    tenant.fb_page_access_token,
    orderWithCustomer.fb_id,
    lines.join('\n'),
    customerName,
    displayRef,
    'completed and ready for pickup'
  );

  // Update review timestamp if we sent the link
  if (includeReview) {
    await db.query(
      `UPDATE customers SET review_last_requested_at=NOW() WHERE id=$1`,
      [customer_id]
    );
  }
}

async function sendStatusNotification(updatedOrder, tenantId, status) {
  const bookingRef = updatedOrder.booking_ref;

  if (bookingRef) {
    // Dedupe: only the booking's lowest-id row sends, so a multi-service booking
    // triggers exactly ONE message instead of one per service row.
    const { rows: [primary] } = await db.query(
      `SELECT id FROM orders WHERE booking_ref=$1 AND tenant_id=$2 ORDER BY id LIMIT 1`,
      [bookingRef, tenantId]
    );
    if (!primary || primary.id !== updatedOrder.id) return;
  }

  // Load customer fb_id + all service names in the booking
  const { rows: [order] } = await db.query(
    `SELECT c.fb_id, c.name AS customer_name
     FROM orders o
     JOIN customers c ON c.id = o.customer_id
     WHERE o.id = $1`,
    [updatedOrder.id]
  );
  if (!order?.fb_id) return;

  // Messenger orders have no booking_ref — single row, query by id
  const { rows: siblings } = await db.query(
    `SELECT s.name AS service_name
     FROM orders o LEFT JOIN services s ON s.id = o.service_id
     WHERE ${bookingRef ? `o.booking_ref=$1 AND o.tenant_id=$2` : `o.id=$1`}`,
    bookingRef ? [bookingRef, tenantId] : [updatedOrder.id]
  );

  const { rows: [tenant] } = await db.query(
    `SELECT name, fb_page_id, fb_page_access_token FROM tenants WHERE id=$1`,
    [tenantId]
  );
  if (!tenant?.fb_page_access_token) return;

  const name = order.customer_name || 'there';
  const svc  = [...new Set(siblings.map(o => o.service_name).filter(Boolean))].join(' & ') || 'your laundry';
  const displayRef = bookingRef || updatedOrder.id.slice(-8).toUpperCase();
  let text;
  let statusPhrase;

  if (status === 'PROCESSING') {
    statusPhrase = 'being processed';
    text = [
      `🧺 Your laundry is now being processed, ${name}!`,
      ``,
      `Order #${displayRef} — ${svc}`,
      ``,
      `We're washing, drying, and folding with care. Sit back and relax — we'll notify you when it's ready for delivery! 😊`,
      ``,
      `– ${tenant.name}`,
    ].join('\n');
  } else if (status === 'FOR DELIVERY') {
    statusPhrase = 'ready for delivery';
    text = [
      `Hi ${name}! Your laundry is all set and ready for delivery! 🚚`,
      ``,
      `Order #${displayRef} — ${svc}`,
      ``,
      `Our staff will contact you shortly to confirm your delivery. 😊`,
      ``,
      `– ${tenant.name}`,
    ].join('\n');
  }

  if (text) {
    await sendStatusUpdate(tenant.fb_page_id, tenant.fb_page_access_token, order.fb_id, text, name, displayRef, statusPhrase);
  }
}

// POST generate (or regenerate) a Xendit payment link for an existing order
router.post('/:id/payment-link', auth, async (req, res) => {
  try {
    // Fetch order + customer email
    const { rows: [order] } = await db.query(
      `SELECT o.*, c.email AS customer_email
       FROM orders o
       LEFT JOIN customers c ON c.id = o.customer_id
       WHERE o.id = $1 AND o.tenant_id = $2`,
      [req.params.id, req.user.tenant_id]
    );
    if (!order) return res.status(404).json({ error: 'Order not found' });

    // Pull all sibling orders in the same booking
    let relatedOrders = [order];
    if (order.booking_ref) {
      const { rows } = await db.query(
        `SELECT * FROM orders WHERE booking_ref = $1 AND tenant_id = $2`,
        [order.booking_ref, req.user.tenant_id]
      );
      if (rows.length) relatedOrders = rows;
    }

    // Tenant Xendit config
    const { rows: [tenant] } = await db.query(
      `SELECT xendit_api_key, name FROM tenants WHERE id = $1`,
      [req.user.tenant_id]
    );
    if (!tenant?.xendit_api_key) {
      return res.status(400).json({ error: 'Xendit is not configured for this branch. Add your API key in Settings.' });
    }

    // Total = only unpaid items (avoid double-charging already-paid services)
    const unpaidOrders = relatedOrders.filter(o => !o.paid);
    if (unpaidOrders.length === 0) {
      return res.status(400).json({ error: 'This booking is already fully paid.' });
    }
    const total = unpaidOrders.reduce((s, o) => s + Number(o.price || 0) + Number(o.delivery_fee || 0), 0);
    if (total <= 0) return res.status(400).json({ error: 'Order total is ₱0 — cannot generate a payment link.' });

    const ref = order.booking_ref || order.id;

    const invoice = await createInvoice(tenant.xendit_api_key, {
      externalId:        `${ref}-MANUAL-${Date.now()}`,
      amount:            total,
      payerEmail:        order.customer_email || undefined,
      description:       `${tenant.name} — ${ref}`,
    });

    // Persist on unpaid orders only
    const ids = unpaidOrders.map(o => o.id);
    await db.query(
      `UPDATE orders SET xendit_invoice_id = $1, xendit_invoice_url = $2
       WHERE id = ANY($3::text[]) AND tenant_id = $4`,
      [invoice.id, invoice.invoiceUrl, ids, req.user.tenant_id]
    );

    res.json({ payment_url: invoice.invoiceUrl });
  } catch (err) {
    console.error('[payment-link]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST send order-update notification to customer via Messenger
router.post('/:id/notify-update', auth, async (req, res) => {
  const { old_price, new_price, new_service_name, message_override } = req.body;
  try {
    // Load order + customer fb_id + tenant token
    const { rows: [order] } = await db.query(
      `SELECT o.*, c.name AS customer_name, c.fb_id, s.name AS service_name
       FROM orders o
       LEFT JOIN customers c ON c.id = o.customer_id
       LEFT JOIN services s ON s.id = o.service_id
       WHERE o.id=$1 AND o.tenant_id=$2`,
      [req.params.id, req.user.tenant_id]
    );
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (!order.fb_id) return res.status(400).json({ error: 'Customer has no Messenger account linked — order was placed via web form.' });

    const { rows: [tenant] } = await db.query(
      `SELECT name, fb_page_access_token FROM tenants WHERE id=$1`, [req.user.tenant_id]
    );
    if (!tenant?.fb_page_access_token) return res.status(400).json({ error: 'Messenger not configured for this branch.' });

    const diff = Number(new_price) - Number(old_price);
    const svcName = new_service_name || order.service_name;

    let text;
    if (message_override?.trim()) {
      text = message_override.trim();
    } else {
      text = `📋 Order Update — ${order.id}\n\n`;
      text += `Hi ${order.customer_name || 'there'}! Your order has been updated by our team.\n\n`;
      text += `Service: ${svcName}\n`;
      text += `Updated Price: ₱${Number(new_price).toLocaleString('en-PH')}\n`;
      if (diff > 0) {
        text += `\n⚠️ Additional amount to settle: ₱${diff.toLocaleString('en-PH')}\n`;
        text += `Please coordinate with us to process the balance.`;
      } else if (diff < 0) {
        text += `\n✅ Price adjustment: ₱${Math.abs(diff).toLocaleString('en-PH')} less than original.\n`;
        text += `We will process the difference accordingly.`;
      } else {
        text += `\nNo price difference — your total remains the same.`;
      }
    }

    await sendTaggedMessage(tenant.fb_page_access_token, order.fb_id, text);
    res.json({ ok: true, sent_to: order.fb_id });
  } catch (err) {
    console.error('[notify-update]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST cancel order (+ auto-refund if paid via Xendit)
router.post('/:id/cancel', auth, async (req, res) => {
  try {
    // Fetch the order + tenant Xendit key
    const { rows: [order] } = await db.query(
      `SELECT o.*, t.xendit_api_key FROM orders o
       JOIN tenants t ON t.id = o.tenant_id
       WHERE o.id = $1 AND o.tenant_id = $2`,
      [req.params.id, req.user.tenant_id]
    );
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.status === 'CANCELLED') return res.status(400).json({ error: 'Order is already cancelled' });

    // Find all sibling orders (same booking_ref) to cancel together
    let orderIds = [order.id];
    let invoiceId = order.xendit_invoice_id;
    let totalAmount = Number(order.price);

    if (order.booking_ref) {
      const { rows: siblings } = await db.query(
        `SELECT id, price, xendit_invoice_id FROM orders WHERE booking_ref=$1 AND tenant_id=$2`,
        [order.booking_ref, req.user.tenant_id]
      );
      if (siblings.length) {
        orderIds = siblings.map(s => s.id);
        totalAmount = siblings.reduce((sum, s) => sum + Number(s.price), 0);
        invoiceId = siblings.find(s => s.xendit_invoice_id)?.xendit_invoice_id || invoiceId;
      }
    }

    // Cancel all orders
    await db.query(
      `UPDATE orders SET status='CANCELLED' WHERE id = ANY($1::text[]) AND tenant_id=$2`,
      [orderIds, req.user.tenant_id]
    );

    // Not paid — done
    if (!order.paid) {
      return res.json({ ok: true, cancelled: true, refund_status: 'not_applicable', message: 'Order cancelled.' });
    }

    // Paid but no Xendit invoice on record
    if (!invoiceId || !order.xendit_api_key) {
      return res.json({ ok: true, cancelled: true, refund_status: 'manual', message: 'Order cancelled. No Xendit payment found — process refund manually if needed.' });
    }

    // Attempt Xendit refund
    try {
      await createRefund(order.xendit_api_key, { invoiceId, amount: totalAmount, reason: 'CANCELLATION' });
      return res.json({
        ok: true, cancelled: true, refund_status: 'success',
        message: `Refund of ₱${Number(totalAmount).toLocaleString('en-PH')} processed successfully via Xendit.`,
      });
    } catch (e) {
      const msg = e.response?.data?.message || e.message || '';
      const isMethodIssue = /not support|refundable|channel|method/i.test(msg);
      return res.json({
        ok: true, cancelled: true, refund_status: 'manual',
        message: isMethodIssue
          ? 'Manual refund required — payment method does not support auto-refund.'
          : `Manual refund required — ${msg}`,
      });
    }
  } catch (err) {
    console.error('[cancel-order]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST verify Xendit payment and mark order as paid if confirmed
router.post('/:id/verify-payment', auth, async (req, res) => {
  try {
    const { rows: [order] } = await db.query(
      `SELECT o.id, o.xendit_invoice_id, o.paid, o.booking_ref
       FROM orders o WHERE o.id=$1 AND o.tenant_id=$2`,
      [req.params.id, req.user.tenant_id]
    );
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.paid) return res.json({ ok: true, already_paid: true });
    if (!order.xendit_invoice_id) return res.status(400).json({ error: 'No payment link generated for this order.' });

    const { rows: [tenant] } = await db.query('SELECT xendit_api_key FROM tenants WHERE id=$1', [req.user.tenant_id]);
    if (!tenant?.xendit_api_key) return res.status(400).json({ error: 'Xendit not configured.' });

    const { status } = await getInvoiceStatus(tenant.xendit_api_key, order.xendit_invoice_id);
    if (status !== 'PAID') {
      return res.status(400).json({ error: `Invoice is not paid yet — current status: ${status}` });
    }

    // Confirmed paid — update all orders in the same booking
    await db.query(
      `UPDATE orders SET paid=TRUE, reminder_count=99 WHERE booking_ref=(SELECT booking_ref FROM orders WHERE id=$1) AND tenant_id=$2`,
      [req.params.id, req.user.tenant_id]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('[verify-payment]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST send invoice PDF to customer email
router.post('/:id/send-invoice', auth, async (req, res) => {
  const { pdf_base64, customer_email } = req.body;
  if (!pdf_base64 || !customer_email) {
    return res.status(400).json({ error: 'pdf_base64 and customer_email required' });
  }
  try {
    const { rows: [order] } = await db.query(
      `SELECT o.booking_ref, c.name AS customer_name
       FROM orders o LEFT JOIN customers c ON c.id = o.customer_id
       WHERE o.id=$1 AND o.tenant_id=$2`,
      [req.params.id, req.user.tenant_id]
    );
    if (!order) return res.status(404).json({ error: 'Order not found' });
    const { rows: [tenant] } = await db.query('SELECT name FROM tenants WHERE id=$1', [req.user.tenant_id]);
    await sendInvoiceEmail({
      to: customer_email,
      shopName: tenant?.name || 'Your Shop',
      invoiceId: order.booking_ref || req.params.id,
      customerName: order.customer_name || 'Customer',
      pdfBase64: pdf_base64,
    });
    res.json({ ok: true });
  } catch (err) {
    console.error('[send-invoice]', err.response?.data || err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST upload payment screenshot (public — called by customer on booking success screen)
router.post('/:id/upload-screenshot', async (req, res) => {
  const { screenshot, booking_ref } = req.body;
  if (!screenshot) return res.status(400).json({ error: 'screenshot is required' });
  if (!booking_ref) return res.status(400).json({ error: 'booking_ref is required' });
  try {
    // Validate ownership: require booking_ref matching the order
    const lookup = await db.query('SELECT id, tenant_id FROM orders WHERE id=$1 AND booking_ref=$2', [req.params.id, booking_ref]);
    if (!lookup.rows[0]) return res.status(403).json({ error: 'Forbidden' });
    const { rows: [order] } = await db.query(
      `UPDATE orders SET payment_screenshot=$1 WHERE id=$2 RETURNING id`,
      [screenshot, req.params.id]
    );
    if (!order) return res.status(404).json({ error: 'Order not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error('[upload-screenshot]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST confirm QR payment manually (admin — marks paid and notifies customer)
router.post('/:id/confirm-qr-payment', auth, async (req, res) => {
  try {
    const { rows: [order] } = await db.query(
      `SELECT o.id, o.booking_ref, o.paid, c.name AS customer_name, c.email AS customer_email, c.fb_id,
              o.address, o.price, o.tenant_id
       FROM orders o
       LEFT JOIN customers c ON c.id = o.customer_id
       WHERE o.id=$1 AND o.tenant_id=$2`,
      [req.params.id, req.user.tenant_id]
    );
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.paid) return res.json({ ok: true, already_paid: true });

    // Mark all orders in booking as paid
    const { rows: allOrders } = await db.query(
      `UPDATE orders SET paid=TRUE, reminder_count=99
       WHERE booking_ref=(SELECT booking_ref FROM orders WHERE id=$1) AND tenant_id=$2
       RETURNING id, price, booking_ref`,
      [req.params.id, req.user.tenant_id]
    );

    const bookingRef = order.booking_ref || req.params.id;
    const total = allOrders.reduce((s, o) => s + Number(o.price), 0);

    // Load service names for notifications
    const { rows: orderDetails } = await db.query(
      `SELECT s.name AS service_name FROM orders o
       LEFT JOIN services s ON s.id = o.service_id
       WHERE o.booking_ref=$1`,
      [bookingRef]
    );
    const serviceName = orderDetails.map(o => o.service_name).filter(Boolean).join(', ');

    // Email: customer payment confirmation
    sendCustomerPaymentEmail(req.user.tenant_id, {
      orderId: bookingRef,
      customerName: order.customer_name,
      customerEmail: order.customer_email,
      serviceName,
      address: order.address,
      total,
    }).catch(e => console.warn('[confirm-qr-payment] customer email failed:', e.message));

    // Email: shop owner paid notification
    sendPaidOrderEmail(req.user.tenant_id, {
      orderId: bookingRef,
      serviceName,
      customerName: order.customer_name,
      address: order.address,
      total,
    }).catch(e => console.warn('[confirm-qr-payment] owner email failed:', e.message));

    // Messenger: notify customer if they have fb_id
    if (order.fb_id) {
      try {
        const { rows: [tenant] } = await db.query(
          `SELECT name, fb_page_access_token, contact_number, notification_email FROM tenants WHERE id=$1`,
          [req.user.tenant_id]
        );
        if (tenant?.fb_page_access_token) {
          const msg = `✅ Payment Confirmed!\n\n` +
            `Hi ${order.customer_name || 'there'}! We've received your payment for booking ${bookingRef}.\n\n` +
            `💰 Amount Paid: ₱${total.toLocaleString('en-PH')}\n\n` +
            `We'll check your order for confirmation.\n\n` +
            `For concerns, reach out to us:\n` +
            `📧 Email: ${tenant.notification_email || 'hello@laundrobot.app'}\n` +
            (tenant.contact_number ? `📱 Contact: ${tenant.contact_number}` : '');
          const appUrl = process.env.APP_URL;
          const bookBtn = appUrl
            ? { type: 'web_url', title: '🛒 Book Again', url: `${appUrl}/book/${req.user.tenant_id}`, webview_height_ratio: 'full', messenger_extensions: true }
            : { type: 'postback', title: '🛒 Book Again', payload: 'BOOK' };
          await sendButtons(tenant.fb_page_access_token, order.fb_id, msg, [
            bookBtn,
            { type: 'postback', title: '📦 My Orders', payload: 'MY_ORDERS' },
          ]);
        }
      } catch (e) {
        console.warn('[confirm-qr-payment] messenger failed:', e.message);
      }
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('[confirm-qr-payment]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE order — soft delete only, never hard delete
router.delete('/:id', auth, async (req, res) => {
  if (!['admin','superadmin'].includes(req.user.role)) return res.status(403).json({ error: 'Forbidden' });
  try {
    // Fetch the order snapshot before soft-deleting
    const { rows: [order] } = await db.query(
      `SELECT o.*, c.name as customer_name, c.phone as customer_phone
       FROM orders o
       LEFT JOIN customers c ON c.id = o.customer_id
       WHERE o.id = $1 AND o.tenant_id = $2`,
      [req.params.id, req.user.tenant_id]
    );
    if (!order) return res.status(404).json({ error: 'Order not found' });

    // Soft-delete: archive + record who deleted it
    await db.query(
      `UPDATE orders SET archived = TRUE, archived_at = NOW(), deleted_by = $1
       WHERE id = $2 AND tenant_id = $3`,
      [req.user.email, req.params.id, req.user.tenant_id]
    );

    // Write audit log entry with full order snapshot
    await db.query(
      `INSERT INTO order_audit_log (order_id, booking_ref, tenant_id, action, performed_by, order_snapshot)
       VALUES ($1, $2, $3, 'deleted', $4, $5)`,
      [order.id, order.booking_ref, order.tenant_id, req.user.email, JSON.stringify(order)]
    );

    res.json({ message: 'Order deleted' });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

module.exports = router;
