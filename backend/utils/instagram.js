const axios = require('axios');
const { BOT_METADATA_TAG } = require('./botEchoTracker');

// Instagram Messaging API — endpoint uses ig_user_id, not 'me'
function graphUrl(igUserId) {
  return `https://graph.facebook.com/v19.0/${igUserId}/messages`;
}

async function post(token, igUserId, body) {
  // Stamp with our metadata tag so echoes are recognised as the bot's own without
  // relying on app_id (see utils/botEchoTracker.js). This assumes Meta round-trips
  // message.metadata on IG echoes; verify when the IG bot goes live (currently
  // blocked on App Review). If it does not, the bot would read its own echoes as
  // human and pause itself — the safe direction, but retest before launch.
  if (body?.message && body.message.metadata === undefined) {
    body.message.metadata = BOT_METADATA_TAG;
  }
  await axios.post(`${graphUrl(igUserId)}?access_token=${token}`, body);
}

// Split long text at paragraph/sentence boundaries (IG limit: 1000 chars)
function chunkText(text, maxLen = 990) {
  if (text.length <= maxLen) return [text];
  const chunks = [];
  let remaining = text;
  while (remaining.length > maxLen) {
    let cut = remaining.lastIndexOf('\n\n', maxLen);
    if (cut < 200) cut = remaining.lastIndexOf('\n', maxLen);
    if (cut < 200) cut = remaining.lastIndexOf('. ', maxLen);
    if (cut < 200) cut = maxLen;
    else cut = cut + (remaining[cut] === '.' ? 2 : 1);
    chunks.push(remaining.slice(0, cut).trimEnd());
    remaining = remaining.slice(cut).trimStart();
  }
  if (remaining.length) chunks.push(remaining);
  return chunks;
}

async function sendMessage(token, igUserId, recipientId, text) {
  const chunks = chunkText(text);
  for (const chunk of chunks) {
    await post(token, igUserId, {
      recipient: { id: recipientId },
      message: { text: chunk },
    });
  }
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
