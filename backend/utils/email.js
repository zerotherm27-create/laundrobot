const axios = require('axios');
const db = require('../db');

const RESEND_API = 'https://api.resend.com/emails';

function getFrom() {
  return process.env.RESEND_FROM || 'LaundroBot <noreply@laundrobot.app>';
}

async function sendEmail({ to, subject, html }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn('[email] RESEND_API_KEY not set — skipping email');
    return;
  }
  await axios.post(RESEND_API, { from: getFrom(), to, subject, html }, {
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
  });
}

async function getNotificationEmails(tenantId) {
  const { rows: [tenant] } = await db.query(
    `SELECT notification_email FROM tenants WHERE id=$1`, [tenantId]
  );
  if (tenant?.notification_email) return [tenant.notification_email];
  const { rows } = await db.query(
    `SELECT email FROM users WHERE tenant_id=$1 AND email IS NOT NULL LIMIT 3`, [tenantId]
  );
  return rows.map(r => r.email).filter(Boolean);
}

function emailWrapper(shopName, bodyHtml) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F4F6F9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:560px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08);">
    <div style="background:#38a9c2;padding:24px 28px;">
      <div style="color:#fff;font-size:20px;font-weight:700;">🧺 ${shopName}</div>
      <div style="color:rgba(255,255,255,.8);font-size:13px;margin-top:2px;">LaundroBot Notification</div>
    </div>
    <div style="padding:24px 28px;">${bodyHtml}</div>
    <div style="padding:16px 28px;background:#F4F6F9;text-align:center;font-size:12px;color:#6B7280;">
      Powered by <strong>LaundroBot</strong> · This is an automated notification
    </div>
  </div>
</body>
</html>`;
}

function orderTable(rows) {
  const cells = rows.map(([label, value]) => `
    <tr>
      <td style="padding:8px 0;font-size:13px;color:#6B7280;width:140px;">${label}</td>
      <td style="padding:8px 0;font-size:13px;color:#111827;font-weight:500;">${value || '—'}</td>
    </tr>`).join('');
  return `<table style="width:100%;border-collapse:collapse;">${cells}</table>`;
}

async function sendNewOrderEmail(tenantId, { orderId, serviceName, customerName, customerPhone, address, pickupDate, deliveryZone, total, paymentUrl }) {
  try {
    const { rows: [tenant] } = await db.query('SELECT name FROM tenants WHERE id=$1', [tenantId]);
    const shopName = tenant?.name || 'Your Shop';
    const recipients = await getNotificationEmails(tenantId);
    if (!recipients.length) {
      console.warn('[email] no recipients for tenant', tenantId);
      return;
    }

    const formattedDate = pickupDate
      ? new Date(pickupDate).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })
      : '—';

    const tableRows = [
      ['Order ID', orderId],
      ['Service', serviceName],
      ['Customer', customerName],
      ['Phone', customerPhone],
      ['Pickup Address', address],
      ['Pickup Date', formattedDate],
      ...(deliveryZone ? [['Delivery Zone', deliveryZone]] : []),
      ['Total Amount', `₱${Number(total).toLocaleString()}`],
    ];

    const payBtn = paymentUrl
      ? `<a href="${paymentUrl}" style="display:inline-block;margin-top:16px;padding:10px 20px;background:#38a9c2;color:#fff;border-radius:8px;font-size:13px;font-weight:600;text-decoration:none;">View Payment Link</a>`
      : '';

    const body = `
      <div style="margin-bottom:20px;">
        <div style="font-size:22px;font-weight:700;color:#111827;margin-bottom:4px;">📦 New Order Received!</div>
        <div style="font-size:14px;color:#6B7280;">A customer just placed an order on your booking form.</div>
      </div>
      <div style="background:#F9FAFB;border-radius:8px;padding:16px 20px;margin-bottom:20px;">
        ${orderTable(tableRows)}
      </div>
      ${payBtn}`;

    await sendEmail({
      to: recipients,
      subject: `📦 New Order ${orderId} — ${customerName}`,
      html: emailWrapper(shopName, body),
    });
    console.log(`[email] new order ${orderId} sent to ${recipients.join(', ')}`);
  } catch (err) {
    console.warn('[email] sendNewOrderEmail failed:', err.response?.data || err.message);
  }
}

async function sendPaidOrderEmail(tenantId, { orderId, serviceName, customerName, customerPhone, address, total }) {
  try {
    const { rows: [tenant] } = await db.query('SELECT name FROM tenants WHERE id=$1', [tenantId]);
    const shopName = tenant?.name || 'Your Shop';
    const recipients = await getNotificationEmails(tenantId);
    if (!recipients.length) return;

    const tableRows = [
      ['Order ID', orderId],
      ['Service', serviceName],
      ['Customer', customerName],
      ['Phone', customerPhone],
      ['Pickup Address', address],
      ['Amount Paid', `₱${Number(total).toLocaleString()}`],
    ];

    const body = `
      <div style="margin-bottom:20px;">
        <div style="font-size:22px;font-weight:700;color:#111827;margin-bottom:4px;">💰 Payment Received!</div>
        <div style="font-size:14px;color:#6B7280;">An order has been paid via Xendit.</div>
      </div>
      <div style="background:#EAF7EC;border-radius:8px;padding:16px 20px;margin-bottom:20px;border:1px solid #C3E6CB;">
        ${orderTable(tableRows)}
      </div>
      <div style="font-size:13px;color:#374151;background:#F0FDF4;padding:12px 16px;border-radius:8px;border-left:4px solid #22C55E;">
        ✅ This order has been marked as <strong>PAID</strong> in your dashboard.
      </div>`;

    await sendEmail({
      to: recipients,
      subject: `💰 Payment Confirmed — Order ${orderId}`,
      html: emailWrapper(shopName, body),
    });
    console.log(`[email] paid order ${orderId} sent to ${recipients.join(', ')}`);
  } catch (err) {
    console.warn('[email] sendPaidOrderEmail failed:', err.response?.data || err.message);
  }
}

async function sendCustomerOrderEmail(tenantId, { orderId, customerName, customerEmail, serviceName, pickupDate, address, total, paymentUrl }) {
  if (!customerEmail) return;
  try {
    const { rows: [tenant] } = await db.query('SELECT name, contact_number FROM tenants WHERE id=$1', [tenantId]);
    const shopName = tenant?.name || 'Your Shop';

    const formattedDate = pickupDate
      ? new Date(pickupDate).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })
      : '—';

    const tableRows = [
      ['Booking Ref',    orderId],
      ['Service',        serviceName],
      ['Pickup Address', address],
      ['Pickup Date',    formattedDate],
      ['Total Amount',   `₱${Number(total).toLocaleString()}`],
    ];

    const payBtn = paymentUrl
      ? `<a href="${paymentUrl}" style="display:inline-block;margin-top:16px;padding:10px 24px;background:#38a9c2;color:#fff;border-radius:8px;font-size:14px;font-weight:600;text-decoration:none;">Pay Now</a>`
      : '';

    const contactLine = tenant?.contact_number
      ? `<p style="font-size:13px;color:#374151;margin-top:16px;">Questions? Contact us at <strong>${tenant.contact_number}</strong></p>`
      : '';

    const body = `
      <div style="margin-bottom:20px;">
        <div style="font-size:22px;font-weight:700;color:#111827;margin-bottom:4px;">✅ Booking Confirmed!</div>
        <div style="font-size:14px;color:#6B7280;">Hi ${customerName}, your laundry booking has been received. Here's your summary:</div>
      </div>
      <div style="background:#F9FAFB;border-radius:8px;padding:16px 20px;margin-bottom:20px;">
        ${orderTable(tableRows)}
      </div>
      ${payBtn}
      ${contactLine}`;

    await sendEmail({
      to: [customerEmail],
      subject: `✅ Booking Confirmed — ${orderId} | ${shopName}`,
      html: emailWrapper(shopName, body),
    });
    console.log(`[email] customer confirmation ${orderId} sent to ${customerEmail}`);
  } catch (err) {
    console.warn('[email] sendCustomerOrderEmail failed:', err.response?.data || err.message);
  }
}

async function sendCustomerPaymentEmail(tenantId, { orderId, customerName, customerEmail, serviceName, address, total }) {
  if (!customerEmail) return;
  try {
    const { rows: [tenant] } = await db.query('SELECT name, contact_number FROM tenants WHERE id=$1', [tenantId]);
    const shopName = tenant?.name || 'Your Shop';

    const tableRows = [
      ['Booking Ref',  orderId],
      ['Service',      serviceName],
      ['Pickup Address', address],
      ['Amount Paid',  `₱${Number(total).toLocaleString()}`],
    ];

    const contactLine = tenant?.contact_number
      ? `<p style="font-size:13px;color:#374151;margin-top:16px;">Questions? Reach us at <strong>${tenant.contact_number}</strong></p>`
      : '';

    const body = `
      <div style="margin-bottom:20px;">
        <div style="font-size:22px;font-weight:700;color:#111827;margin-bottom:4px;">💚 Payment Confirmed!</div>
        <div style="font-size:14px;color:#6B7280;">Hi ${customerName}, we're excited to be of service to you! Your payment has been received and your order is all set.</div>
      </div>
      <div style="background:#F0FDF4;border-radius:8px;padding:16px 20px;margin-bottom:20px;border:1px solid #BBF7D0;">
        ${orderTable(tableRows)}
      </div>
      <div style="font-size:13px;color:#374151;background:#F9FAFB;padding:12px 16px;border-radius:8px;border-left:4px solid #38a9c2;">
        🧺 Sit back and relax — we'll take care of the rest. Thank you for trusting <strong>${shopName}</strong>!
      </div>
      ${contactLine}`;

    await sendEmail({
      to: [customerEmail],
      subject: `💚 Payment Confirmed — ${orderId} | ${shopName}`,
      html: emailWrapper(shopName, body),
    });
    console.log(`[email] customer payment confirmation ${orderId} sent to ${customerEmail}`);
  } catch (err) {
    console.warn('[email] sendCustomerPaymentEmail failed:', err.response?.data || err.message);
  }
}

module.exports = { sendNewOrderEmail, sendPaidOrderEmail, sendCustomerOrderEmail, sendCustomerPaymentEmail };
