const db = require('../db');
const { sendMessage } = require('../utils/messenger');
const { createInvoice } = require('../utils/xendit');

const MAX_REMINDERS = 3;          // stop after 3 reminders
const REMINDER_INTERVAL_HOURS = 1; // remind every 1 hour
const UNPAID_THRESHOLD_MINUTES = 60; // start reminding after 60 min

async function runFollowUp() {
  console.log('[follow-up] running job at', new Date().toISOString());
  try {
    // Find confirmed but unpaid orders that need a reminder
    const { rows: orders } = await db.query(`
      SELECT
        o.*,
        c.fb_id, c.name as customer_name,
        t.fb_page_access_token, t.name as tenant_name,
        t.xendit_api_key,
        s.name as service_name
      FROM orders o
      JOIN customers c ON c.id = o.customer_id
      JOIN tenants t ON t.id = o.tenant_id
      LEFT JOIN services s ON s.id = o.service_id
      WHERE o.paid = FALSE
        AND o.status != 'CANCELLED'
        AND o.created_at < NOW() - INTERVAL '${UNPAID_THRESHOLD_MINUTES} minutes'
        AND o.reminder_count < ${MAX_REMINDERS}
        AND (
          o.last_reminded_at IS NULL
          OR o.last_reminded_at < NOW() - INTERVAL '${REMINDER_INTERVAL_HOURS} hours'
        )
    `);

    console.log('[follow-up] found', orders.length, 'unpaid orders to remind');

    for (const order of orders) {
      try {
        const name = order.customer_name || 'there';
        let message = '';

        // Try to generate a Xendit payment link if API key exists
        let paymentUrl = null;
        if (order.xendit_api_key) {
          try {
            const invoice = await createInvoice(order.xendit_api_key, {
              externalId: order.id,
              amount: parseFloat(order.price),
              payerEmail: undefined,
              description: `${order.service_name || 'Laundry'} - ${order.id}`,
              successRedirectUrl: `https://m.me/${order.fb_id}`,
            });
            paymentUrl = invoice.invoiceUrl;

            // Save invoice URL to order
            await db.query(
              `UPDATE orders SET xendit_invoice_url=$1 WHERE id=$2`,
              [paymentUrl, order.id]
            );
          } catch (e) {
            console.warn('[follow-up] xendit invoice failed:', e.message);
          }
        }

        const reminderNum = order.reminder_count + 1;

        if (reminderNum === 1) {
          message = `Hi ${name}! 👋 Just a friendly reminder that your laundry order is waiting for payment.\n\n` +
            `📋 Order ID: ${order.id}\n` +
            `🧺 Service: ${order.service_name || 'Laundry'}\n` +
            `💰 Amount: ₱${parseFloat(order.price).toFixed(2)}\n` +
            (paymentUrl ? `\n💳 Pay here: ${paymentUrl}` : '') +
            `\n\nReply CANCEL to cancel your order.`;
        } else if (reminderNum === 2) {
          message = `Hi ${name}! ⏰ Your order ${order.id} is still unpaid (₱${parseFloat(order.price).toFixed(2)}).` +
            (paymentUrl ? `\n\nComplete your payment here: ${paymentUrl}` : '') +
            `\n\nReply CANCEL to cancel.`;
        } else {
          message = `Hi ${name}, this is our last reminder for order ${order.id} (₱${parseFloat(order.price).toFixed(2)}).` +
            ` If we don't hear from you, the order may be cancelled.` +
            (paymentUrl ? `\n\nPay here: ${paymentUrl}` : '');
        }

        await sendMessage(order.fb_page_access_token, order.fb_id, message);

        // Update reminder tracking
        await db.query(
          `UPDATE orders SET reminder_count = reminder_count + 1, last_reminded_at = NOW() WHERE id = $1`,
          [order.id]
        );

        console.log(`[follow-up] reminded ${name} for order ${order.id} (reminder #${reminderNum})`);
      } catch (err) {
        console.error(`[follow-up] failed for order ${order.id}:`, err.message);
      }
    }

    console.log('[follow-up] job complete');
  } catch (err) {
    console.error('[follow-up] job error:', err.message);
  }
}

module.exports = runFollowUp;
