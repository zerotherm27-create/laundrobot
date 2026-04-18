const axios = require('axios');

// Instagram Messaging API — endpoint uses ig_user_id, not 'me'
function graphUrl(igUserId) {
  return `https://graph.facebook.com/v19.0/${igUserId}/messages`;
}

async function post(token, igUserId, body) {
  await axios.post(`${graphUrl(igUserId)}?access_token=${token}`, body);
}

async function sendMessage(token, igUserId, recipientId, text) {
  await post(token, igUserId, {
    recipient: { id: recipientId },
    message: { text },
  });
}

// Instagram supports button template with postback buttons (same format as Messenger)
async function sendButtons(token, igUserId, recipientId, text, buttons) {
  await post(token, igUserId, {
    recipient: { id: recipientId },
    message: {
      attachment: {
        type: 'template',
        payload: { template_type: 'button', text, buttons },
      },
    },
  });
}

// Quick replies work the same as Messenger
async function sendQuickReplies(token, igUserId, recipientId, text, replies) {
  await post(token, igUserId, {
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

// Instagram does not support generic template (product cards).
// Fall back to a numbered text list followed by quick-reply buttons for the first 10 items.
async function sendCatalog(token, igUserId, recipientId, elements) {
  const items = elements.slice(0, 10);
  const lines = items.map((el, i) => `${i + 1}. ${el.title} — ${el.subtitle || ''}`);
  const text = lines.join('\n');
  await sendMessage(token, igUserId, recipientId, text);

  // Send quick-reply chips so customer can tap to book (max 13 chips)
  const replies = items.slice(0, 13).map((el, i) => {
    const btn = (el.buttons || [])[0];
    return { title: `${i + 1}. Book`, payload: btn?.payload || `SVC_SELECT:${i}` };
  });
  if (replies.length) {
    await sendQuickReplies(token, igUserId, recipientId, 'Tap to book a service 👆', replies);
  }
}

module.exports = { sendMessage, sendButtons, sendQuickReplies, sendCatalog };
