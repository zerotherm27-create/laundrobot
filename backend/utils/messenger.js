const axios = require('axios');

const GRAPH_URL = 'https://graph.facebook.com/v19.0/me/messages';

async function post(token, body) {
  await axios.post(`${GRAPH_URL}?access_token=${token}`, body);
}

// Plain text message
async function sendMessage(token, recipientId, text) {
  await post(token, { recipient: { id: recipientId }, message: { text } });
}

// POST_PURCHASE_UPDATE tag — Meta-approved for order/payment updates outside 24-hr window
async function sendTaggedMessage(token, recipientId, text) {
  await post(token, {
    messaging_type: 'MESSAGE_TAG',
    tag: 'POST_PURCHASE_UPDATE',
    recipient: { id: recipientId },
    message: { text },
  });
}

// Button template (max 3 buttons)
async function sendButtons(token, recipientId, text, buttons) {
  await post(token, {
    recipient: { id: recipientId },
    message: {
      attachment: {
        type: 'template',
        payload: { template_type: 'button', text, buttons },
      },
    },
  });
}

// Quick replies — appear as tappable chips above keyboard (max 13, title max 20 chars)
async function sendQuickReplies(token, recipientId, text, replies) {
  await post(token, {
    recipient: { id: recipientId },
    message: {
      text,
      quick_replies: replies.map(r => ({
        content_type: 'text',
        title: r.title.substring(0, 20),
        payload: r.payload,
      })),
    },
  });
}

// Generic template — horizontal scrollable product cards (max 10 elements)
// Each element: { title, subtitle, imageUrl, buttons: [{title, payload}] }
async function sendCatalog(token, recipientId, elements) {
  const mapped = elements.slice(0, 10).map(el => {
    const card = {
      title: el.title.substring(0, 80),
      subtitle: (el.subtitle || '').substring(0, 80),
      buttons: (el.buttons || []).slice(0, 3).map(b => ({
        type: 'postback',
        title: b.title.substring(0, 20),
        payload: b.payload,
      })),
    };
    if (el.imageUrl) card.image_url = el.imageUrl;
    return card;
  });

  await post(token, {
    recipient: { id: recipientId },
    message: {
      attachment: {
        type: 'template',
        payload: { template_type: 'generic', elements: mapped },
      },
    },
  });
}

module.exports = { sendMessage, sendTaggedMessage, sendButtons, sendQuickReplies, sendCatalog };
