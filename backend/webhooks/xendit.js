const router = require('express').Router();
const db = require('../db');
const { sendPaidOrderEmail } = require('../utils/email');

router.post('/', async (req, res) => {
  const callbackToken = req.headers['x-callback-token'];
  if (callbackToken !== process.env.XENDIT_CALLBACK_TOKEN) {
    return res.status(403).json({ error: 'Invalid callback token' });
  }

  const { external_id, status, id: xenditInvoiceId } = req.body;

  if (status !== 'PAID') return res.sendStatus(200);

  try {
    await db.query(
      `UPDATE orders SET paid=TRUE, status='PAID', xendit_invoice_id=$1
       WHERE id=$2`,
      [xenditInvoiceId, external_id]
    );

    // Send paid order email notification (non-blocking)
    try {
      const { rows: [order] } = await db.query(
        `SELECT o.id, o.tenant_id, o.price, o.address,
                s.name AS service_name,
                c.name AS customer_name, c.phone AS customer_phone
         FROM orders o
         LEFT JOIN services s ON s.id = o.service_id
         LEFT JOIN customers c ON c.id = o.customer_id
         WHERE o.id=$1`,
        [external_id]
      );
      if (order) {
        sendPaidOrderEmail(order.tenant_id, {
          orderId: order.id,
          serviceName: order.service_name,
          customerName: order.customer_name,
          customerPhone: order.customer_phone,
          address: order.address,
          total: order.price,
        }).catch(() => {});
      }
    } catch (e) {
      console.warn('[xendit webhook] email lookup failed:', e.message);
    }

    res.sendStatus(200);
  } catch (err) {
    console.error('Xendit webhook error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
