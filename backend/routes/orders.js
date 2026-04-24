const router = require('express').Router();
const auth = require('../middleware/auth');
const db = require('../db');
const { sendTaggedMessage } = require('../utils/messenger');
const { createInvoice, createRefund, getInvoiceStatus } = require('../utils/xendit');
const { sendInvoiceEmail } = require('../utils/email');

// GET all orders for tenant (archived=true to fetch archives)
router.get('/', auth, async (req, res) => {
  try {
    const { status, page = 1, limit = 200, archived = 'false' } = req.query;
    const offset = (page - 1) * limit;
    const isArchived = archived === 'true';
    let query = `
      SELECT o.*, c.name as customer_name, c.phone as customer_phone, c.address as customer_address,
             s.name as service_name, s.price as service_unit_price, s.unit as service_unit
      FROM orders o
      LEFT JOIN customers c ON c.id = o.customer_id
      LEFT JOIN services s ON s.id = o.service_id
      WHERE o.tenant_id = $1 AND o.archived = $2
    `;
    const params = [req.user.tenant_id, isArchived];
    if (status) { query += ` AND o.status = $${params.length + 1}`; params.push(status); }
    query += ` ORDER BY o.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);
    const { rows } = await db.query(query, params);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST archive completed orders for a given month (or auto by cron)
router.post('/archive-month', auth, async (req, res) => {
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
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT full booking edit — update/add/remove items, return copyable summary + payment link if needed
router.put('/booking/:ref', auth, async (req, res) => {
  const { items, custom_note, custom_price } = req.body;
  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'items array required' });
  }
  const extraAmount = Number(custom_price) || 0;

  const client = await db.pool.connect();
  try {
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

    // Only update existing orders — no inserts, no deletes
    for (const item of items.filter(i => i.id)) {
      const cleanNotes = (item.notes || '').replace(/\[Edited by admin[^\]]*\]/g, '').trim();
      const notesWithStamp = cleanNotes ? `${cleanNotes}\n${editStamp}` : editStamp;
      await client.query(
        `UPDATE orders SET service_id=$1, price=$2, notes=$3 WHERE id=$4 AND tenant_id=$5`,
        [item.service_id || null, Number(item.price), notesWithStamp, item.id, req.user.tenant_id]
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
    await client.query('ROLLBACK').catch(() => {});
    console.error('[booking update]', err.message);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
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
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH update order status / notes / service / price
router.patch('/:id', auth, async (req, res) => {
  const { status, notes, paid, service_id, weight, price, delivery_date } = req.body;
  try {
    const fields = [];
    const params = [];
    if (status        !== undefined) { fields.push(`status = $${params.length + 1}`);        params.push(status); }
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
  } catch (err) { res.status(500).json({ error: err.message }); }
});

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

    // Total = all service prices + delivery fee on first order
    const servicesTotal = relatedOrders.reduce((s, o) => s + Number(o.price || 0), 0);
    const deliveryFee   = Number(order.delivery_fee || 0);
    const total = servicesTotal + deliveryFee;
    if (total <= 0) return res.status(400).json({ error: 'Order total is ₱0 — cannot generate a payment link.' });

    const ref = order.booking_ref || order.id;

    const invoice = await createInvoice(tenant.xendit_api_key, {
      externalId:        `${ref}-MANUAL-${Date.now()}`,
      amount:            total,
      payerEmail:        order.customer_email || undefined,
      description:       `${tenant.name} — ${ref}`,
    });

    // Persist on all related orders
    const ids = relatedOrders.map(o => o.id);
    await db.query(
      `UPDATE orders SET xendit_invoice_id = $1, xendit_invoice_url = $2
       WHERE id = ANY($3::text[]) AND tenant_id = $4`,
      [invoice.id, invoice.invoiceUrl, ids, req.user.tenant_id]
    );

    res.json({ payment_url: invoice.invoiceUrl });
  } catch (err) {
    console.error('[payment-link]', err.message);
    res.status(500).json({ error: err.response?.data?.message || err.message });
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
    console.error('[notify-update]', err.response?.data || err.message);
    res.status(500).json({ error: err.response?.data?.error?.message || err.message });
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
    console.error('[cancel-order]', err.message);
    res.status(500).json({ error: err.message });
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
      `UPDATE orders SET paid=TRUE WHERE booking_ref=(SELECT booking_ref FROM orders WHERE id=$1) AND tenant_id=$2`,
      [req.params.id, req.user.tenant_id]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('[verify-payment]', err.response?.data || err.message);
    res.status(500).json({ error: err.response?.data?.message || err.message });
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
    console.error('[send-invoice]', err.response?.data || err.message);
    res.status(500).json({ error: err.message });
  }
});

// DELETE order
router.delete('/:id', auth, async (req, res) => {
  try {
    await db.query(
      `DELETE FROM orders WHERE id = $1 AND tenant_id = $2`,
      [req.params.id, req.user.tenant_id]
    );
    res.json({ message: 'Order deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
