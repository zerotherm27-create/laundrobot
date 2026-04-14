const axios = require('axios');

const BASE = 'https://graph.facebook.com/v19.0/me/messenger_profile';

/**
 * Sets up the Messenger profile for a page:
 * - Get Started button  → triggers GET_STARTED postback on first open
 * - Greeting text       → shown before customer starts chatting
 * - Persistent menu     → always-visible menu in the chat composer
 */
async function setupMessengerProfile(pageToken, tenantName) {
  const name = tenantName || 'us';

  // Set Get Started button + greeting in one call
  await axios.post(`${BASE}?access_token=${pageToken}`, {
    get_started: { payload: 'GET_STARTED' },
    greeting: [
      {
        locale: 'default',
        text: `👋 Hi {{user_first_name}}! Welcome to ${name}.\n\nTap "Get Started" to book your laundry pickup or browse our services.`,
      },
    ],
  });

  // Persistent menu — requires app to be primary receiver on the page.
  // Try to set it; skip silently if the page hasn't granted that permission.
  try {
    await axios.post(`${BASE}?access_token=${pageToken}`, {
      persistent_menu: [
        {
          locale: 'default',
          composer_input_disabled: false,
          call_to_actions: [
            { type: 'postback', title: '🛒 Book Now',      payload: 'BOOK'      },
            { type: 'postback', title: '📋 View Services', payload: 'SERVICES'  },
            { type: 'postback', title: '📦 My Orders',     payload: 'MY_ORDERS' },
          ],
        },
      ],
    });
    console.log(`[messenger-profile] persistent menu set for ${name}`);
  } catch (e) {
    console.warn(`[messenger-profile] persistent menu skipped for ${name} (app not primary receiver):`, e.response?.data?.error?.message || e.message);
  }

  console.log(`[messenger-profile] setup complete for ${name}`);
}

module.exports = { setupMessengerProfile };
