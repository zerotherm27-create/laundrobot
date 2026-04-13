const axios = require('axios');

const GRAPH_URL = 'https://graph.facebook.com/v19.0/me/messages';

async function sendMessage(token, recipientId, text) {
  await axios.post(`${GRAPH_URL}?access_token=${token}`, {
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

module.exports = { sendMessage, sendButtons };
