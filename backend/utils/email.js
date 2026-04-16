const nodemailer = require('nodemailer');
const db = require('../db');

// ── Transporter ─────────────────────────────────────────────────────────────
function getTransporter() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT) || 587,
    secure: Number(SMTP_PORT) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
}

// ── Get notification email for a tenant ──────────────────────────────────────
async function getNotificationEmails(tenantId) {
  const { rows: [tenant] } = await db.query(
    `SELECT notification_email FROM tenants WHERE id=$1`,
    [tenantId]
  );
  if (tenant?.notification_email) return [tenant.notification_email];
  // Fallback: any admin user email for this tenant
  const { rows } = await db.query(
    `SELECT email FROM users WHERE tenant_id=$1 AND email IS NOT NULL LIMIT 3`,
    [tenantId]
  );
  return rows.map(r => r.email).filter(Boolean);
}

// ── Shared HTML wrapper ──────────────────────────────────────────────────────
function emailWrapper(shopName, bodyHtml) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F4F6F9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:560px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08);">
    <!-- Header -->
    <div style="background:#378ADD;padding:24px 28px;">
      <div style="color:#fff;font-size:20px;font-weight:700;">🧺 ${shopName}</div>
      <div style="color:rgba(255,255,255,.8);font-size:13px;margin-top:2px;">LaundroBot Notification</div>
    </div>
    <!-- Body -->
    <div style="padding:24px 28px;">
      ${bodyHtml}
    </div>
    <!-- Footer -->
    <div style="padding:16px 28px;background:#F4F6F9;text-align:center;font-size:12px;color:#6B7280;">
      Powered by <strong>LaundroBot</strong> · This is an automated notification
    </div>
  </div>
</body>
</html>`;
}

// ── Order details table ──────────────────────────────────────────────────────
function orderTable(rows) {
  const cells = rows.map(([label, value]) => `
    <tr>
      <td style="padding:8px 0;font-size:13px;color:#6B7280;width:140px;">${label}</td>
      <td style="padding:8px 0;font-size:13px;color:#111827;font-weight:500;">${value}</td>
    </tr>`).join('');
  return `<table style="width:100%;border-collapse:collapse;">${cells}</table>`;
}

// ── NEW ORDER notification ───────────────────────────────────────────────────
async function sendNewOrderEmail(tenantId, { orderId, serviceName, customerName, customerPhone, address, pickupDate, deliveryZone, total, paymentUrl }) {
  try {
    const transporter = getTransporter();
    if (!transporter) return;

    const { rows: [tenant] } = await db.query('SELECT name FROM tenants WHERE id=$1', [tenantId]);
    const shopName = tenant?.name || 'Your Shop';
    const recipients = await getNotificationEmails(tenantId);
    if (!recipients.length) return;

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
      ? `<a href="${paymentUrl}" style="display:inline-block;margin-top:16px;padding:10px 20px;background:#378ADD;color:#fff;border-radius:8px;font-size:13px;font-weight:600;text-decoration:none;">View Payment Link</a>`
      : '';

    const body = `
      <div style="margin-bottom:20px;">
        <div style="font-size:22px;font-weight:700;color:#111827;margin-bottom:4px;">📦 New Order Received!</div>
        <div style="font-size:14px;color:#6B7280;">A customer just placed an order on your booking form.</div>
      </div>
      <div style="background:#F9FAFB;border-radius:8px;padding:16px 20px;margin-bottom:20px;">
        ${orderTable(tableRows)}
      </div>
      ${payBtn}
    `;

    await transporter.sendMail({
      from: `"${shopName} via LaundroBot" <${process.env.SMTP_USER}>`,
      to: recipients.join(', '),
      subject: `📦 New Order ${orderId} — ${customerName}`,
      html: emailWrapper(shopName, body),
    });

    console.log(`[email] new order ${orderId} sent to ${recipients.join(', ')}`);
  } catch (err) {
    console.warn('[email] sendNewOrderEmail failed:', err.message);
  }
}

// ── PAID ORDER notification ──────────────────────────────────────────────────
async function sendPaidOrderEmail(tenantId, { orderId, serviceName, customerName, customerPhone, address, total }) {
  try {
    const transporter = getTransporter();
    if (!transporter) return;

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
      </div>
    `;

    await transporter.sendMail({
      from: `"${shopName} via LaundroBot" <${process.env.SMTP_USER}>`,
      to: recipients.join(', '),
      subject: `💰 Payment Confirmed — Order ${orderId}`,
      html: emailWrapper(shopName, body),
    });

    console.log(`[email] paid order ${orderId} sent to ${recipients.join(', ')}`);
  } catch (err) {
    console.warn('[email] sendPaidOrderEmail failed:', err.message);
  }
}

module.exports = { sendNewOrderEmail, sendPaidOrderEmail };
