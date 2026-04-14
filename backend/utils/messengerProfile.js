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

  // 1. Get Started button
  await axios.post(`${BASE}?access_token=${pageToken}`, {
    get_started: { payload: 'GET_STARTED' },
  });

  // 2. Greeting text (shown to new users before they message)
  await axios.post(`${BASE}?access_token=${pageToken}`, {
    greeting: [
      {
        locale: 'default',
        text: `👋 Hi {{user_first_name}}! Welcome to ${name}.\n\nTap "Get Started" to book your laundry pickup or browse our services.`,
      },
    ],
  });

  // 3. Persistent menu (hamburger icon always visible in chat)
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

  console.log(`[messenger-profile] setup complete for ${name}`);
}

module.exports = { setupMessengerProfile };
