const axios = require('axios');

const GRAPH = 'https://graph.facebook.com/v19.0';

/**
 * Sets up the Messenger profile for a page + optional Instagram account:
 * - Webhook subscription, whitelisted domains, Get Started, greeting, persistent menu
 * - If igUserId is provided, also sets the Instagram persistent menu
 */
async function setupMessengerProfile(pageToken, tenantName, tenantId, appUrl, igUserId) {
  const name = tenantName || 'us';
  const fbBase = `${GRAPH}/me/messenger_profile`;

  // ── 0. Subscribe page to webhook events ─────────────────────────────────
  try {
    const pageInfo = await axios.get(`${GRAPH}/me?fields=id&access_token=${pageToken}`);
    const pageId = pageInfo.data.id;
    await axios.post(
      `${GRAPH}/${pageId}/subscribed_apps?access_token=${pageToken}`,
      { subscribed_fields: ['messages', 'messaging_postbacks', 'messaging_optins', 'messaging_referrals', 'message_echoes'] }
    );
    console.log(`[messenger-profile] webhook subscribed for page ${pageId}`);
  } catch (e) {
    console.warn(`[messenger-profile] webhook subscription failed for ${name}:`, e.response?.data?.error?.message || e.message);
  }

  // ── 1. Whitelist domain (required for messenger_extensions webview) ──────
  if (appUrl) {
    try {
      await axios.post(`${fbBase}?access_token=${pageToken}`, {
        whitelisted_domains: [appUrl],
      });
      console.log(`[messenger-profile] whitelisted domain: ${appUrl}`);
    } catch (e) {
      console.warn(`[messenger-profile] domain whitelist failed for ${name}:`, e.response?.data?.error?.message || e.message);
    }
  }

  // ── 2. Get Started + greeting ────────────────────────────────────────────
  let fbError = null;
  try {
    await axios.post(`${fbBase}?access_token=${pageToken}`, {
      get_started: { payload: 'GET_STARTED' },
      greeting: [{ locale: 'default', text: `👋 Hi {{user_first_name}}! Welcome to ${name}.\n\nTap "Get Started" to book your laundry pickup!` }],
    });
  } catch (e) {
    fbError = e.response?.data?.error?.message || e.message;
    console.warn(`[messenger-profile] get_started/greeting failed for ${name}:`, fbError);
  }

  // ── 3. Facebook persistent menu (supports webview) ───────────────────────
  const fbBookAction = appUrl && tenantId
    ? { type: 'web_url', title: '🛒 Book Now', url: `${appUrl}/book/${tenantId}`, webview_height_ratio: 'full', messenger_extensions: true }
    : { type: 'postback', title: '🛒 Book Now', payload: 'BOOK' };

  try {
    await axios.post(`${fbBase}?access_token=${pageToken}`, {
      persistent_menu: [{ locale: 'default', composer_input_disabled: false, call_to_actions: [
        fbBookAction,
        { type: 'postback', title: '📦 My Orders', payload: 'MY_ORDERS' },
        { type: 'postback', title: '❓ FAQs',       payload: 'FAQS'      },
      ]}],
    });
    console.log(`[messenger-profile] Facebook persistent menu set for ${name}`);
  } catch (e) {
    fbError = e.response?.data?.error?.message || e.message;
    console.warn(`[messenger-profile] Facebook persistent menu failed for ${name}:`, fbError);
  }

  // Instagram persistent menu API requires elevated permissions not available via standard page token.
  // Instead, new Instagram users are greeted with a welcome menu on their first message (in the webhook).
  const igError = null;

  console.log(`[messenger-profile] setup complete for ${name}`);
  return { fbError, igError };
}

module.exports = { setupMessengerProfile };
