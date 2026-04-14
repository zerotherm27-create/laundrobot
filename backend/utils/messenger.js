const axios = require('axios');

const GRAPH_URL = 'https://graph.facebook.com/v19.0/me/messages';

async function sendMessage(token, recipientId, text) {
  await axios.post(`${GRAPH_URL}?access_token=${token}`, {
    recipient: { id: recipientId },
    message: { text },
  });
}

// POST_PURCHASE_UPDATE tag — Meta-approved for order/payment updates.
// Required when sending outside the 24-hour standard messaging window,
// and recommended for all order-related follow-ups per Meta guidelines.
async function sendTaggedMessage(token, recipientId, text) {
  await axios.post(`${GRAPH_URL}?access_token=${token}`, {
    messaging_type: 'MESSAGE_TAG',
    tag: 'POST_PURCHASE_UPDATE',
    recipient: { id: recipientId },
    message: { text },
  });
}

async function sendButtons(token, recipientId, text, buttons) {
  await axios.post(`${GRAPH_URL}?access_token=${token}`, {
    recipient: { id: recipientId },
    message: {
      attachment: {
        type: 'template',
        payload: {
          template_type: 'button',
          text,
          buttons,
        },
      },
    },
  });
}

module.exports = { sendMessage, sendTaggedMessage, sendButtons };
