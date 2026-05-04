const router = require('express').Router();
const db = require('../db');
const { sendPaidOrderEmail, sendCustomerPaymentEmail, sendEmail } = require('../utils/email');
const { sendMessage, sendButtons } = require('../utils/messenger');

router.post('/', async (req, res) => {
  const callbackToken = req.headers['x-callback-token'];
  console.log('[xendit] received token:', callbackToken, '| expected:', process.env.XENDIT_CALLBACK_TOKEN);
  if (process.env.XENDIT_CALLBACK_TOKEN && callbackToken !== process.env.XENDIT_CALLBACK_TOKEN) {
    return res.status(403).json({ error: 'Invalid callback token' });
  }

  const { external_id, status, id: xenditInvoiceId } = req.body;

  if (status !== 'PAID') return res.sendStatus(200);

  try {
    // Subscription payment for a LaundroBot tenant (external_id starts with "sub-")
    if (String(external_id).startsWith('sub-')) {
      const tenantId = String(external_id).split('-')[1];
      const desc = req.body.description || '';
      const isAnnual = desc.includes('Annual');
      const isPro    = desc.includes('Pro');
      const subPlan  = isAnnual ? (isPro ? 'pro_annual' : 'starter_annual') : (isPro ? 'pro_monthly' : 'starter_monthly');
      const tier     = isPro ? 'pro' : 'starter';
      const paidUntil = new Date();
      paidUntil.setMonth(paidUntil.getMonth() + (isAnnual ? 12 : 1));
      await db.query(
        `UPDATE tenants
         SET subscription_status = 'active',
             subscription_plan = $1,
             subscription_paid_until = $2,
             plan = $3
         WHERE id = $4`,
        [subPlan, paidUntil.toISOString(), tier, tenantId]
      );
      console.log(`[xendit] subscription activated for tenant ${tenantId} (${subPlan})`);

      // Notify you (the platform owner) of the new subscription
      const { rows: [newTenant] } = await db.query(
        `SELECT t.name, u.email FROM tenants t LEFT JOIN users u ON u.tenant_id = t.id AND u.role = 'admin' WHERE t.id = $1 LIMIT 1`,
        [tenantId]
      );
      const amount = req.body.amount || (isPro ? (isAnnual ? 54990 : 5499) : (isAnnual ? 9990 : 999));
      sendEmail({
        to: [process.env.PLATFORM_NOTIFY_EMAIL || 'hello@laundrobot.app'],
        subject: `💰 New Subscription — ${newTenant?.name || tenantId} (${isPro ? 'Pro' : 'Starter'} ${isAnnual ? 'Annual' : 'Monthly'})`,
        html: `<!DOCTYPE html><html><body style="font-family:sans-serif;padding:24px;background:#f4f6f9;">
          <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:12px;padding:28px;box-shadow:0 2px 12px rgba(0,0,0,.08);">
            <div style="font-size:28px;margin-bottom:8px;">💰</div>
            <h2 style="margin:0 0 16px;color:#111827;">New Subscription Payment</h2>
            <table style="width:100%;border-collapse:collapse;font-size:14px;">
              <tr><td style="padding:8px 0;color:#6B7280;width:130px;">Tenant</td><td style="color:#111827;font-weight:600;">${newTenant?.name || tenantId}</td></tr>
              <tr><td style="padding:8px 0;color:#6B7280;">Email</td><td style="color:#111827;">${newTenant?.email || '—'}</td></tr>
              <tr><td style="padding:8px 0;color:#6B7280;">Plan</td><td style="color:#7C3AED;font-weight:700;">${isPro ? 'Pro' : 'Starter'} ${isAnnual ? 'Annual' : 'Monthly'}</td></tr>
              <tr><td style="padding:8px 0;color:#6B7280;">Amount</td><td style="color:#059669;font-weight:700;">₱${Number(amount).toLocaleString()}</td></tr>
              <tr><td style="padding:8px 0;color:#6B7280;">Date</td><td style="color:#111827;">${new Date().toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })}</td></tr>
            </table>
          </div>
        </body></html>`,
      }).catch(e => console.warn('[xendit] subscription notify email failed:', e.message));

      return res.sendStatus(200);
    }

    // Strip the "-MANUAL-<timestamp>" suffix added by admin-generated payment links
    const refId = String(external_id).replace(/-MANUAL-\d+$/, '');
    const isBkgRef = refId.startsWith('BKG-');

    if (isBkgRef) {
      await db.query(
        `UPDATE orders SET paid=TRUE, xendit_invoice_id=$1 WHERE booking_ref=$2`,
        [xenditInvoiceId, refId]
      );
    } else {
      await db.query(
        `UPDATE orders SET paid=TRUE, xendit_invoice_id=$1 WHERE id=$2`,
        [xenditInvoiceId, refId]
      );
    }

    // Load order + customer + tenant for notifications
    try {
      console.log('[xendit] looking up refId:', refId, '| isBkgRef:', isBkgRef);
      const { rows: orders } = await db.query(
        `SELECT o.id, o.tenant_id, o.price, o.address, o.booking_ref, o.pickup_date, o.is_dropoff,
                s.name AS service_name,
                c.name AS customer_name, c.phone AS customer_phone, c.fb_id, c.email AS customer_email
         FROM orders o
         LEFT JOIN services s ON s.id = o.service_id
         LEFT JOIN customers c ON c.id = o.customer_id
         WHERE ${isBkgRef ? 'o.booking_ref=$1' : 'o.id=$1'}`,
        [refId]
      );
      console.log('[xendit] orders found:', orders.length, '| fb_id:', orders[0]?.fb_id, '| customer_email:', orders[0]?.customer_email);

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
            const isDropoff = orders.some(o => o.is_dropoff);
            let msg = isDropoff
              ? `✅ Payment Confirmed! You're all set.\n\n` +
                `Hi ${first.customer_name || 'there'}! We've received your payment for booking ${first.booking_ref || first.id}.\n\n` +
                `💰 Amount Paid: ₱${totalPaid.toLocaleString('en-PH')}\n\n` +
                `You can now drop off your laundry at our shop on your scheduled date. See you soon! 🧺\n\n` +
                (tenant.contact_number ? `📱 Questions? Contact us: ${tenant.contact_number}` : '')
              : `✅ Payment Received!\n\n` +
                `Hi ${first.customer_name || 'there'}! We've received your payment for booking ${first.booking_ref || first.id}.\n\n` +
                `💰 Amount Paid: ₱${totalPaid.toLocaleString('en-PH')}\n\n` +
                `We'll check your order for confirmation.\n\n` +
                `For concerns, reach out to us using the following contact details:\n` +
                `📧 Email: ${tenant.notification_email || 'hello@laundrobot.app'}\n` +
                (tenant.contact_number ? `📱 Contact: ${tenant.contact_number} (WhatsApp & Viber)` : '');
            const appUrl = process.env.APP_URL;
            const bookBtn = appUrl
              ? { type: 'web_url', title: '🛒 Book Again', url: `${appUrl}/book/${first.tenant_id}`, webview_height_ratio: 'full', messenger_extensions: true }
              : { type: 'postback', title: '🛒 Book Again', payload: 'BOOK' };
            sendButtons(tenant.fb_page_access_token, first.fb_id, msg, [
              bookBtn,
              { type: 'postback', title: '📦 My Orders', payload: 'MY_ORDERS' },
            ]).catch(e => {
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
