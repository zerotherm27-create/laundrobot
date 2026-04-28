/**
 * Unpaid Order Follow-Up Job
 *
 * Meta Messaging Compliance:
 * - All reminders use the POST_PURCHASE_UPDATE message tag.
 * - This tag is permitted by Meta for sending order/payment updates
 *   even outside the standard 24-hour messaging window.
 * - Ref: https://developers.facebook.com/docs/messenger-platform/send-messages/message-tags
 *
 * Reminder schedule (from order creation):
 *   #1 → after  1 hour   "Friendly reminder"
 *   #2 → after  3 hours  "Still waiting for payment"
 *   #3 → after  6 hours  "Don't forget"
 *   #4 → after 23 hours  "Last chance — within 24-hr window"
 *   Auto-cancel → after 24 hours if still unpaid
 */

const db = require('../db');
const { sendTaggedMessage } = require('../utils/messenger');
const { sendPaymentReminderEmail } = require('../utils/email');
const { createInvoice } = require('../utils/xendit');

// Minutes from order creation when each reminder fires
const SCHEDULE = [
  { reminder: 1, afterMinutes: 60  },
  { reminder: 2, afterMinutes: 180 },
  { reminder: 3, afterMinutes: 360 },
  { reminder: 4, afterMinutes: 1380 }, // 23 hours — last chance within 24-hr window
];
const CANCEL_AFTER_MINUTES = 1440; // 24 hours

async function getOrCreatePaymentUrl(order) {
  if (order.xendit_invoice_url) return order.xendit_invoice_url;
  if (!order.xendit_api_key) return null;
  try {
    const invoice = await createInvoice(order.xendit_api_key, {
      externalId: order.id,
      amount: parseFloat(order.price),
      description: `${order.service_name || 'Laundry'} - Order ${order.id}`,
      successRedirectUrl: `https://m.me/${order.fb_id}`,
    });
    await db.query(
      `UPDATE orders SET xendit_invoice_url = $1 WHERE id = $2`,
      [invoice.invoiceUrl, order.id]
    );
    return invoice.invoiceUrl;
  } catch (e) {
    console.warn('[follow-up] xendit invoice failed:', e.message);
    return null;
  }
}

function buildMessage(reminderNum, order, paymentUrl) {
  const name = order.customer_name || 'there';
  const amount = `₱${parseFloat(order.price).toFixed(2)}`;
  const orderId = order.id;
  const payLine = paymentUrl ? `\n\n💳 Pay now: ${paymentUrl}` : '';
  const cancelLine = `\n\nReply CANCEL if you want to cancel your order.`;
  const isDropoff = order.is_dropoff;

  if (isDropoff) {
    switch (reminderNum) {
      case 1:
        return (
          `Hi ${name}! 👋 Just a reminder about your drop-off booking.\n\n` +
          `📋 Order: ${orderId}\n` +
          `🧺 Service: ${order.service_name || 'Laundry'}\n` +
          `💰 Amount due: ${amount}\n` +
          `📅 Drop-off: ${order.pickup_date || 'As scheduled'}\n\n` +
          `⚠️ Please complete your payment BEFORE dropping off. Your slot is not confirmed until payment is received.` +
          payLine + cancelLine
        );
      case 2:
        return (
          `Hi ${name}! ⏰ Your drop-off booking ${orderId} is still awaiting payment of ${amount}.\n\n` +
          `Please pay first before coming to the shop — we can only accept your laundry once payment is confirmed.` +
          payLine + cancelLine
        );
      case 3:
        return (
          `Hi ${name}, your drop-off booking ${orderId} (${amount}) is still unpaid.\n\n` +
          `Don't forget — payment is required before drop-off. Complete your payment to secure your slot!` +
          payLine + cancelLine
        );
      case 4:
        return (
          `Hi ${name}, LAST REMINDER for your drop-off booking ${orderId}.\n\n` +
          `💰 Amount: ${amount}\n\n` +
          `Your booking will be automatically cancelled in 1 hour if payment is not received.` +
          payLine + cancelLine
        );
      default:
        return '';
    }
  }

  switch (reminderNum) {
    case 1:
      return (
        `Hi ${name}! 👋 Just a friendly reminder about your laundry order.\n\n` +
        `📋 Order: ${orderId}\n` +
        `🧺 Service: ${order.service_name || 'Laundry'}\n` +
        `💰 Amount due: ${amount}\n` +
        `📍 Pickup: ${order.pickup_date || 'As scheduled'}` +
        payLine + cancelLine
      );
    case 2:
      return (
        `Hi ${name}! ⏰ Your order ${orderId} is still awaiting payment of ${amount}.\n\n` +
        `We're holding your slot — please complete your payment to confirm your pickup.` +
        payLine + cancelLine
      );
    case 3:
      return (
        `Hi ${name}, we noticed your order ${orderId} (${amount}) hasn't been paid yet.\n\n` +
        `Don't worry — you still have time! Complete your payment and we'll be there for your pickup.` +
        payLine + cancelLine
      );
    case 4:
      return (
        `Hi ${name}, this is your LAST REMINDER for order ${orderId}.\n\n` +
        `💰 Amount: ${amount}\n\n` +
        `Your order will be automatically cancelled in 1 hour if payment is not received.` +
        payLine + cancelLine
      );
    default:
      return '';
  }
}

async function runFollowUp() {
  console.log('[follow-up] running at', new Date().toISOString());
  try {

    // ── 1. Auto-cancel orders unpaid after 24 hours ──────────────────────
    const { rows: toCancel } = await db.query(`
      SELECT o.id, c.fb_id, c.name as customer_name,
             t.fb_page_access_token, o.price, o.service_id
      FROM orders o
      JOIN customers c ON c.id = o.customer_id
      JOIN tenants  t ON t.id = o.tenant_id
      WHERE o.paid = FALSE
        AND o.status != 'CANCELLED'
        AND (o.source IS NULL OR o.source != 'admin')
        AND o.created_at < NOW() - INTERVAL '${CANCEL_AFTER_MINUTES} minutes'
    `);

    for (const order of toCancel) {
      try {
        await db.query(
          `UPDATE orders SET status = 'CANCELLED' WHERE id = $1`,
          [order.id]
        );
        if (order.fb_id) {
          await sendTaggedMessage(
            order.fb_page_access_token,
            order.fb_id,
            `Hi ${order.customer_name || 'there'}, your order ${order.id} has been automatically cancelled due to non-payment.\n\n` +
            `If this was a mistake, type "hi" to place a new order. Sorry for the inconvenience! 🙏`
          );
        }
        console.log(`[follow-up] auto-cancelled order ${order.id}`);
      } catch (err) {
        console.error(`[follow-up] cancel failed for ${order.id}:`, err.message);
      }
    }

    // ── 2. Send reminders based on schedule ──────────────────────────────
    for (const { reminder, afterMinutes } of SCHEDULE) {
      const { rows: orders } = await db.query(`
        SELECT
          o.*, o.is_dropoff,
          c.fb_id, c.name as customer_name, c.email as customer_email,
          t.id as tenant_id, t.fb_page_access_token, t.xendit_api_key,
          s.name as service_name
        FROM orders o
        JOIN customers c ON c.id = o.customer_id
        JOIN tenants  t ON t.id = o.tenant_id
        LEFT JOIN services s ON s.id = o.service_id
        WHERE o.paid = FALSE
          AND o.status != 'CANCELLED'
          AND o.reminder_count = $1
          AND (c.fb_id IS NOT NULL OR c.email IS NOT NULL)
          AND o.created_at < NOW() - INTERVAL '${afterMinutes} minutes'
      `, [reminder - 1]);

      for (const order of orders) {
        try {
          const paymentUrl = await getOrCreatePaymentUrl(order);

          if (order.fb_id) {
            const message = buildMessage(reminder, order, paymentUrl);
            if (!message) continue;
            await sendTaggedMessage(order.fb_page_access_token, order.fb_id, message);
          } else {
            await sendPaymentReminderEmail(order.tenant_id, {
              orderId: order.id,
              customerName: order.customer_name,
              customerEmail: order.customer_email,
              serviceName: order.service_name,
              pickupDate: order.pickup_date,
              total: order.price,
              paymentUrl,
              reminderNum: reminder,
            });
          }

          await db.query(
            `UPDATE orders SET reminder_count = $1, last_reminded_at = NOW() WHERE id = $2`,
            [reminder, order.id]
          );
          console.log(`[follow-up] sent reminder #${reminder} for order ${order.id} to ${order.customer_name} via ${order.fb_id ? 'messenger' : 'email'}`);
        } catch (err) {
          const errData = err.response?.data || {};
          const errCode = errData.error?.code;
          console.error(`[follow-up] reminder #${reminder} failed for ${order.id}:`, errData || err.message);
          const nextCount = [100, 200, 551].includes(errCode) ? 99 : reminder;
          await db.query(`UPDATE orders SET reminder_count = $1 WHERE id = $2`, [nextCount, order.id]).catch(() => {});
        }
      }
    }

    console.log('[follow-up] job done');
  } catch (err) {
    console.error('[follow-up] job error:', err.message);
  }
}

module.exports = runFollowUp;
