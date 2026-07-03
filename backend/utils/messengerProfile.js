const axios = require('axios');

const GRAPH = 'https://graph.facebook.com/v19.0';

/**
 * Sets up the Messenger profile for a page + optional Instagram account:
 * - Webhook subscription, whitelisted domains, Get Started, greeting, persistent menu
 * - If igUserId is provided, also sets the Instagram persistent menu
 */
async function setupMessengerProfile(pageToken, tenantName, tenantId, appUrl, igUserId, customDomain = null) {
  const name = tenantName || 'us';
  const fbBase = `${GRAPH}/me/messenger_profile`;

  // ── 0. Subscribe page to webhook events ─────────────────────────────────
  try {
    const pageInfo = await axios.get(`${GRAPH}/me?fields=id&access_token=${pageToken}`);
    const pageId = pageInfo.data.id;
    const messengerFields = 'messages,messaging_postbacks,messaging_optins,messaging_referrals,message_echoes';
    // subscribed_fields must be a comma-separated string in the URL — Facebook's
    // subscribed_apps endpoint ignores JSON-body arrays and returns success anyway,
    // which is why message_echoes was silently never registered.
    try {
      await axios.post(
        `${GRAPH}/${pageId}/subscribed_apps?access_token=${pageToken}&subscribed_fields=${messengerFields},instagram_manage_messages`
      );
      console.log(`[messenger-profile] webhook subscribed with Instagram for page ${pageId}`);
    } catch (igErr) {
      await axios.post(
        `${GRAPH}/${pageId}/subscribed_apps?access_token=${pageToken}&subscribed_fields=${messengerFields}`
      );
      console.log(`[messenger-profile] webhook subscribed (Messenger only) for page ${pageId} — instagram_manage_messages not yet approved`);
    }
  } catch (e) {
    console.warn(`[messenger-profile] webhook subscription failed for ${name}:`, e.response?.data?.error?.message || e.message);
  }

  // ── 1. Whitelist domain (required for messenger_extensions webview) ──────
  if (appUrl) {
    try {
      const domains = [appUrl];
      if (customDomain) domains.push(`https://${customDomain}`);
      await axios.post(`${fbBase}?access_token=${pageToken}`, {
        whitelisted_domains: domains,
      });
      console.log(`[messenger-profile] whitelisted domains: ${domains.join(', ')}`);
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

  // ── 4. Instagram persistent menu + ice breakers ──────────────────────────
  // Works with the ordinary page token via ?platform=instagram (verified live
  // 2026-07-03). The old claim that this needs special permissions came from
  // the wrong-endpoint era — do not reintroduce the skip.
  let igError = null;
  if (igUserId) {
    const igBase = `${fbBase}?platform=instagram&access_token=${pageToken}`;
    // No messenger_extensions webview on Instagram — plain web_url only.
    const igBookAction = appUrl && tenantId
      ? { type: 'web_url', title: '🛒 Book Now', url: `${customDomain ? `https://${customDomain}` : appUrl}/book/${tenantId}` }
      : { type: 'postback', title: '🛒 Book Now', payload: 'BOOK' };

    try {
      await axios.post(igBase, {
        persistent_menu: [{ locale: 'default', composer_input_disabled: false, call_to_actions: [
          igBookAction,
          { type: 'postback', title: '📦 My Orders', payload: 'MY_ORDERS' },
          { type: 'postback', title: '❓ FAQs',       payload: 'FAQS'      },
        ]}],
      });
      console.log(`[messenger-profile] Instagram persistent menu set for ${name}`);
    } catch (e) {
      igError = e.response?.data?.error?.message || e.message;
      console.warn(`[messenger-profile] Instagram persistent menu failed for ${name}:`, igError);
    }

    // Ice breakers: tappable question chips shown when a customer opens a new
    // conversation — payloads route through the same postback handlers.
    try {
      await axios.post(igBase, {
        ice_breakers: [{ locale: 'default', call_to_actions: [
          { question: 'How do I book a pickup?',     payload: 'BOOK'      },
          { question: 'How much are your services?', payload: 'FAQS'      },
          { question: 'Where is my order?',          payload: 'MY_ORDERS' },
        ]}],
      });
      console.log(`[messenger-profile] Instagram ice breakers set for ${name}`);
    } catch (e) {
      console.warn(`[messenger-profile] Instagram ice breakers failed for ${name}:`, e.response?.data?.error?.message || e.message);
    }
  }

  console.log(`[messenger-profile] setup complete for ${name}`);
  return { fbError, igError };
}

module.exports = { setupMessengerProfile };
