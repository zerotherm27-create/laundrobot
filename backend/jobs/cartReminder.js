const db = require('../db');
const { sendMessage, sendButtons } = require('../utils/messenger');

// Hours to wait before each reminder (index = reminder_count at time of send)
const INTERVALS_HOURS = [2, 4, 8, 24, 48];
const MAX_REMINDERS = INTERVALS_HOURS.length; // 5

async function runCartReminder() {
  console.log('[cart-reminder] running at', new Date().toISOString());
  try {
    const { rows: carts } = await db.query(`
      SELECT ca.id, ca.fb_user_id, ca.items, ca.reminder_count,
             t.fb_page_access_token, t.id AS tenant_id, t.name AS shop_name
      FROM carts ca
      JOIN tenants t ON t.id = ca.tenant_id
      WHERE ca.converted = FALSE
        AND ca.reminder_count < ${MAX_REMINDERS}
        AND ca.fb_user_id IS NOT NULL
        AND t.active = TRUE
        AND (
          (ca.reminder_count = 0 AND ca.created_at  < NOW() - INTERVAL '2 hours')  OR
          (ca.reminder_count = 1 AND ca.reminded_at < NOW() - INTERVAL '4 hours')  OR
          (ca.reminder_count = 2 AND ca.reminded_at < NOW() - INTERVAL '8 hours')  OR
          (ca.reminder_count = 3 AND ca.reminded_at < NOW() - INTERVAL '24 hours') OR
          (ca.reminder_count = 4 AND ca.reminded_at < NOW() - INTERVAL '48 hours')
        )
    `);

    for (const cart of carts) {
      try {
        const items = Array.isArray(cart.items) ? cart.items : [];
        const serviceNames = [...new Set(items.map(i => i.service_name).filter(Boolean))];
        const listLine = serviceNames.length
          ? `\n\n🧺 ${serviceNames.join(', ')}`
          : '';

        const appUrl = process.env.APP_URL;
        const bookUrl = appUrl ? `${appUrl}/book/${cart.tenant_id}` : null;

        const message = `Hi! 👋 We noticed you started booking with ${cart.shop_name} but didn't finish.${listLine}\n\nYour selections are gone but it only takes a minute to book again!`;

        if (bookUrl) {
          await sendButtons(cart.fb_page_access_token, cart.fb_user_id, message, [{
            type: 'web_url',
            url: bookUrl,
            title: '🛒 Complete Booking',
            webview_height_ratio: 'full',
            messenger_extensions: true,
          }]);
        } else {
          await sendMessage(cart.fb_page_access_token, cart.fb_user_id, message + '\n\nType "book" to get started!');
        }

        await db.query(
          `UPDATE carts SET reminder_count = reminder_count + 1, reminded_at = NOW() WHERE id = $1`,
          [cart.id]
        );
        console.log(`[cart-reminder] #${cart.reminder_count + 1} sent to ${cart.fb_user_id} for tenant ${cart.tenant_id}`);
      } catch (err) {
        console.error(`[cart-reminder] failed for cart ${cart.id}:`, err.response?.data || err.message);
        // Advance count even on failure so we don't retry the same slot endlessly
        await db.query(
          `UPDATE carts SET reminder_count = reminder_count + 1, reminded_at = NOW() WHERE id = $1`,
          [cart.id]
        ).catch(() => {});
      }
    }

    // Clean up old converted/fully-reminded carts (older than 7 days)
    await db.query(`DELETE FROM carts WHERE created_at < NOW() - INTERVAL '7 days'`);

    console.log('[cart-reminder] done');
  } catch (err) {
    console.error('[cart-reminder] job error:', err.message);
  }
}

module.exports = runCartReminder;
