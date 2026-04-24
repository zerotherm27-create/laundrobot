const router = require('express').Router();
const db = require('../db');
const { sendPaidOrderEmail, sendCustomerPaymentEmail } = require('../utils/email');
const { sendMessage } = require('../utils/messenger');

router.post('/', async (req, res) => {
  const callbackToken = req.headers['x-callback-token'];
  console.log('[xendit] received token:', callbackToken, '| expected:', process.env.XENDIT_CALLBACK_TOKEN);
  if (process.env.XENDIT_CALLBACK_TOKEN && callbackToken !== process.env.XENDIT_CALLBACK_TOKEN) {
    return res.status(403).json({ error: 'Invalid callback token' });
  }

  const { external_id, status, id: xenditInvoiceId } = req.body;

  if (status !== 'PAID') return res.sendStatus(200);

  try {
    // Strip the "-MANUAL-<timestamp>" suffix added by admin-generated payment links
    const refId = String(external_id).replace(/-MANUAL-\d+$/, '');
    const isBkgRef = refId.startsWith('BKG-');

    if (isBkgRef) {
      await db.query(
        `UPDATE orders SET paid=TRUE, status='PAID', xendit_invoice_id=$1 WHERE booking_ref=$2`,
        [xenditInvoiceId, refId]
      );
    } else {
      await db.query(
        `UPDATE orders SET paid=TRUE, status='PAID', xendit_invoice_id=$1 WHERE id=$2`,
        [xenditInvoiceId, refId]
      );
    }

    // Load order + customer + tenant for notifications
    try {
      const { rows: orders } = await db.query(
        `SELECT o.id, o.tenant_id, o.price, o.address, o.booking_ref,
                s.name AS service_name,
                c.name AS customer_name, c.phone AS customer_phone, c.fb_id, c.email AS customer_email
         FROM orders o
         LEFT JOIN services s ON s.id = o.service_id
         LEFT JOIN customers c ON c.id = o.customer_id
         WHERE ${isBkgRef ? 'o.booking_ref=$1' : 'o.id=$1'}`,
        [refId]
      );

      if (orders.length > 0) {
        const first = orders[0];

        // Email notifications (non-blocking)
        sendCustomerPaymentEmail(first.tenant_id, {
          orderId: first.booking_ref || first.id,
          customerName: first.customer_name,
          customerEmail: first.customer_email,
          serviceName: orders.map(o => o.service_name).join(', '),
          address: first.address,
          total: orders.reduce((s, o) => s + Number(o.price), 0),
        }).catch(e => console.warn('[xendit] customer payment email failed:', e.message));

        sendPaidOrderEmail(first.tenant_id, {
          orderId: first.booking_ref || first.id,
          serviceName: orders.map(o => o.service_name).join(', '),
          customerName: first.customer_name,
          customerPhone: first.customer_phone,
          address: first.address,
          total: orders.reduce((s, o) => s + Number(o.price), 0),
        }).catch(() => {});

        // Messenger confirmation to customer (if they have fb_id)
        if (first.fb_id) {
          const { rows: [tenant] } = await db.query(
            `SELECT name, fb_page_access_token, contact_number FROM tenants WHERE id=$1`,
            [first.tenant_id]
          );
          if (tenant?.fb_page_access_token) {
            const totalPaid = orders.reduce((s, o) => s + Number(o.price), 0);
            let msg =
              `✅ Payment Received!\n\n` +
              `Hi ${first.customer_name || 'there'}! We've received your payment for booking ${first.booking_ref || first.id}.\n\n` +
              `💰 Amount Paid: ₱${totalPaid.toLocaleString('en-PH')}\n\n` +
              `We'll check your order for confirmation.\n\n` +
              `For concerns, reach out to us using the following contact details:\n` +
              `📧 Email: washup@thelaundryproject.ph\n` +
              (tenant.contact_number ? `📱 Contact: ${tenant.contact_number} (WhatsApp & Viber)` : '');
            sendMessage(tenant.fb_page_access_token, first.fb_id, msg).catch(e => {
              console.warn('[xendit webhook] messenger notify failed:', e.response?.data?.error?.message || e.message);
            });
          }
        }
      }
    } catch (e) {
      console.warn('[xendit webhook] post-payment notifications failed:', e.message);
    }

    res.sendStatus(200);
  } catch (err) {
    console.error('Xendit webhook error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
