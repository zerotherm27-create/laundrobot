const db = require('../db');
const { sendMessage, sendButtons } = require('../utils/messenger');

const ABANDON_AFTER_MINUTES = 120; // 2 hours

async function runCartReminder() {
  console.log('[cart-reminder] running at', new Date().toISOString());
  try {
    const { rows: carts } = await db.query(`
      SELECT ca.id, ca.fb_user_id, ca.items,
             t.fb_page_access_token, t.id AS tenant_id, t.name AS shop_name
      FROM carts ca
      JOIN tenants t ON t.id = ca.tenant_id
      WHERE ca.converted = FALSE
        AND ca.reminded_at IS NULL
        AND ca.fb_user_id IS NOT NULL
        AND ca.created_at < NOW() - INTERVAL '${ABANDON_AFTER_MINUTES} minutes'
        AND t.active = TRUE
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

        await db.query(`UPDATE carts SET reminded_at = NOW() WHERE id = $1`, [cart.id]);
        console.log(`[cart-reminder] sent to ${cart.fb_user_id} for tenant ${cart.tenant_id}`);
      } catch (err) {
        console.error(`[cart-reminder] failed for cart ${cart.id}:`, err.response?.data || err.message);
        await db.query(`UPDATE carts SET reminded_at = NOW() WHERE id = $1`, [cart.id]).catch(() => {});
      }
    }

    // Clean up old converted/reminded carts (older than 7 days)
    await db.query(`DELETE FROM carts WHERE created_at < NOW() - INTERVAL '7 days'`);

    console.log('[cart-reminder] done');
  } catch (err) {
    console.error('[cart-reminder] job error:', err.message);
  }
}

module.exports = runCartReminder;
