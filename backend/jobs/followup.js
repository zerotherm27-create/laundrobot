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

// `order` here is a BOOKING group (all unpaid rows sharing a booking_ref, or a
// single ref-less row). The invoice covers the booking's grand total and its
// external_id is the booking ref, so the Xendit webhook's BKG- branch marks
// every row in the booking paid at once.
async function getOrCreatePaymentUrl(order) {
  if (order.xendit_invoice_url) return order.xendit_invoice_url;
  if (!order.xendit_api_key) return null;
  try {
    const invoice = await createInvoice(order.xendit_api_key, {
      externalId: order.ref,
      amount: parseFloat(order.total),
      description: `${order.service_name || 'Laundry'} - Order ${order.ref}`,
      successRedirectUrl: `https://m.me/${order.fb_id}`,
    });
    await db.query(
      `UPDATE orders SET xendit_invoice_url = $1
       WHERE tenant_id = $2 AND COALESCE(booking_ref, id::text) = $3`,
      [invoice.invoiceUrl, order.tenant_id, order.ref]
    );
    return invoice.invoiceUrl;
  } catch (e) {
    console.warn('[follow-up] xendit invoice failed:', e.message);
    return null;
  }
}

function buildMessage(reminderNum, order, paymentUrl) {
  const name = order.customer_name || 'there';
  const amount = `₱${parseFloat(order.total).toFixed(2)}`;
  const orderId = order.ref;
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
    // Grouped by booking: a multi-item booking is cancelled as one unit and
    // the customer gets ONE message showing the booking ref, not a message
    // per row with a raw UUID.
    const { rows: toCancel } = await db.query(`
      SELECT COALESCE(o.booking_ref, o.id::text) AS ref,
             c.fb_id, c.name as customer_name,
             t.id as tenant_id, t.fb_page_access_token
      FROM orders o
      JOIN customers c ON c.id = o.customer_id
      JOIN tenants  t ON t.id = o.tenant_id
      WHERE o.paid = FALSE
        AND o.status != 'CANCELLED'
        AND (o.source IS NULL OR o.source != 'admin')
        AND o.created_at < NOW() - make_interval(mins => $1::int)
        AND t.plan IN ('growth', 'pro')
        -- Partially-paid bookings (ledger has money but rows stay paid=FALSE
        -- after an edit raised the total) must never be auto-cancelled.
        AND NOT EXISTS (
          SELECT 1 FROM booking_payments bp
          WHERE bp.tenant_id = o.tenant_id
            AND (bp.booking_ref = o.booking_ref OR bp.order_id = o.id::text)
        )
        -- Bookings staff have already picked up (an admin-added or already-paid
        -- sibling row on the same booking_ref) are live, not abandoned — cancelling
        -- just the unpaid web/messenger rows sends a misleading "cancelled" message
        -- for a booking that's still being fulfilled (BKG-000123 incident, 2026-07-17).
        AND NOT EXISTS (
          SELECT 1 FROM orders o2
          WHERE o2.tenant_id = o.tenant_id
            AND o2.booking_ref = o.booking_ref
            AND o2.id != o.id
            AND o2.status != 'CANCELLED'
            AND (o2.source = 'admin' OR o2.paid = TRUE)
        )
      GROUP BY COALESCE(o.booking_ref, o.id::text), c.id, t.id
    `, [CANCEL_AFTER_MINUTES]);

    for (const order of toCancel) {
      try {
        await db.query(
          `UPDATE orders SET status = 'CANCELLED'
           WHERE tenant_id = $1 AND COALESCE(booking_ref, id::text) = $2
             AND paid = FALSE AND status != 'CANCELLED'
             AND (source IS NULL OR source != 'admin')
             AND NOT EXISTS (
               SELECT 1 FROM booking_payments bp
               WHERE bp.tenant_id = orders.tenant_id
                 AND (bp.booking_ref = orders.booking_ref OR bp.order_id = orders.id::text)
             )
             AND NOT EXISTS (
               SELECT 1 FROM orders o2
               WHERE o2.tenant_id = orders.tenant_id
                 AND o2.booking_ref = orders.booking_ref
                 AND o2.id != orders.id
                 AND o2.status != 'CANCELLED'
                 AND (o2.source = 'admin' OR o2.paid = TRUE)
             )`,
          [order.tenant_id, order.ref]
        );
        if (order.fb_id) {
          await sendTaggedMessage(
            order.fb_page_access_token,
            order.fb_id,
            `Hi ${order.customer_name || 'there'}, your order ${order.ref} has been automatically cancelled due to non-payment.\n\n` +
            `If this was a mistake, type "hi" to place a new order. Sorry for the inconvenience! 🙏`
          );
        }
        console.log(`[follow-up] auto-cancelled order ${order.ref}`);
      } catch (err) {
        console.error(`[follow-up] cancel failed for ${order.ref}:`, err.message);
      }
    }

    // ── 2. Send reminders based on schedule ──────────────────────────────
    // One reminder per BOOKING (all rows sharing a booking_ref), not per order
    // row. `total` is the booking grand total: SUM(price) + delivery_fee −
    // promo_discount across the unpaid rows. Booking refs are only unique per
    // tenant, so every ref-keyed UPDATE below is also tenant-scoped.
    for (const { reminder, afterMinutes } of SCHEDULE) {
      const { rows: orders } = await db.query(`
        SELECT
          COALESCE(o.booking_ref, o.id::text) AS ref,
          SUM(o.price) + SUM(COALESCE(o.delivery_fee, 0)) - SUM(COALESCE(o.promo_discount, 0)) AS total,
          BOOL_OR(o.is_dropoff) AS is_dropoff,
          MIN(o.pickup_date) AS pickup_date,
          MAX(o.xendit_invoice_url) AS xendit_invoice_url,
          STRING_AGG(DISTINCT s.name, ', ') AS service_name,
          c.fb_id, c.name as customer_name, c.email as customer_email,
          t.id as tenant_id, t.fb_page_access_token, t.xendit_api_key
        FROM orders o
        JOIN customers c ON c.id = o.customer_id
        JOIN tenants  t ON t.id = o.tenant_id
        LEFT JOIN services s ON s.id = o.service_id
        WHERE o.paid = FALSE
          AND o.status != 'CANCELLED'
          AND (c.fb_id IS NOT NULL OR c.email IS NOT NULL)
          AND o.created_at < NOW() - make_interval(mins => $2::int)
          AND t.plan IN ('growth', 'pro')
          -- Skip partially-paid bookings: the reminder quotes the FULL grand
          -- total and getOrCreatePaymentUrl invoices it, which re-bills money
          -- already in the ledger. Staff handle these via the edit flow's
          -- balance link instead.
          AND NOT EXISTS (
            SELECT 1 FROM booking_payments bp
            WHERE bp.tenant_id = o.tenant_id
              AND (bp.booking_ref = o.booking_ref OR bp.order_id = o.id::text)
          )
        GROUP BY COALESCE(o.booking_ref, o.id::text), c.id, t.id
        HAVING MIN(o.reminder_count) = $1
      `, [reminder - 1, afterMinutes]);

      for (const order of orders) {
        try {
          const paymentUrl = await getOrCreatePaymentUrl(order);

          if (order.fb_id) {
            const message = buildMessage(reminder, order, paymentUrl);
            if (!message) continue;
            await sendTaggedMessage(order.fb_page_access_token, order.fb_id, message);
          } else {
            await sendPaymentReminderEmail(order.tenant_id, {
              orderId: order.ref,
              customerName: order.customer_name,
              customerEmail: order.customer_email,
              serviceName: order.service_name,
              pickupDate: order.pickup_date,
              total: order.total,
              paymentUrl,
              reminderNum: reminder,
            });
          }

          await db.query(
            `UPDATE orders SET reminder_count = $1, last_reminded_at = NOW()
             WHERE tenant_id = $2 AND COALESCE(booking_ref, id::text) = $3
               AND paid = FALSE AND status != 'CANCELLED'`,
            [reminder, order.tenant_id, order.ref]
          );
          console.log(`[follow-up] sent reminder #${reminder} for order ${order.ref} to ${order.customer_name} via ${order.fb_id ? 'messenger' : 'email'}`);
        } catch (err) {
          const errData = err.response?.data || {};
          const errCode = errData.error?.code;
          console.error(`[follow-up] reminder #${reminder} failed for ${order.ref}:`, errData || err.message);
          const nextCount = [100, 200, 551].includes(errCode) ? 99 : reminder;
          await db.query(
            `UPDATE orders SET reminder_count = $1
             WHERE tenant_id = $2 AND COALESCE(booking_ref, id::text) = $3
               AND paid = FALSE AND status != 'CANCELLED'`,
            [nextCount, order.tenant_id, order.ref]
          ).catch(() => {});
        }
      }
    }

    console.log('[follow-up] job done');
  } catch (err) {
    console.error('[follow-up] job error:', err.message);
  }
}

module.exports = runFollowUp;
module.exports.buildMessage = buildMessage;
