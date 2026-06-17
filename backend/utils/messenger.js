const axios = require('axios');
const { BOT_METADATA_TAG } = require('./botEchoTracker');

const GRAPH_URL = 'https://graph.facebook.com/v19.0/me/messages';

async function post(token, body) {
  // Stamp every real message (not typing/sender_action) with our metadata tag.
  // Meta echoes this string back at message.metadata, which is how the webhook
  // tells the bot's own echoes apart from a human staff reply WITHOUT using
  // app_id (see utils/botEchoTracker.js). Every outbound message MUST go through
  // here so it gets stamped.
  if (body?.message && body.message.metadata === undefined) {
    body.message.metadata = BOT_METADATA_TAG;
  }
  await axios.post(`${GRAPH_URL}?access_token=${token}`, body);
}

// Typing indicator
async function sendTyping(token, recipientId, on = true) {
  await post(token, { recipient: { id: recipientId }, sender_action: on ? 'typing_on' : 'typing_off' });
}

// Split long text at paragraph/sentence boundaries (FB limit: 2000 chars)
function chunkText(text, maxLen = 1990) {
  if (text.length <= maxLen) return [text];
  const chunks = [];
  let remaining = text;
  while (remaining.length > maxLen) {
    let cut = remaining.lastIndexOf('\n\n', maxLen);
    if (cut < 500) cut = remaining.lastIndexOf('\n', maxLen);
    if (cut < 500) cut = remaining.lastIndexOf('. ', maxLen);
    if (cut < 500) cut = maxLen;
    else cut = cut + (remaining[cut] === '.' ? 2 : 1); // include the period/newline
    chunks.push(remaining.slice(0, cut).trimEnd());
    remaining = remaining.slice(cut).trimStart();
  }
  if (remaining.length) chunks.push(remaining);
  return chunks;
}

// Plain text message — auto-chunks if over FB's 2000-char limit
async function sendMessage(token, recipientId, text) {
  const chunks = chunkText(text);
  for (const chunk of chunks) {
    await post(token, { recipient: { id: recipientId }, message: { text: chunk } });
  }
}

// Order / status update message.
//
// The POST_PURCHASE_UPDATE message tag this used to send was DEPRECATED by Meta
// on 2026-04-27 — it now returns error code 100, so every status notification was
// silently failing. We send a normal RESPONSE message instead, which Meta delivers
// to any customer within the 24-hour messaging window (i.e. who has messaged the
// shop recently).
//
// Customers OUTSIDE the 24h window will get error #10 here (caught/logged by the
// fire-and-forget callers). Reaching them requires sending the approved UTILITY
// template `order_status_update_v2` via sendUtilityTemplate() — TODO: wire that in
// once its Send API payload is verified against the live Graph API (see
// scripts/send-utility-template.js).
async function sendTaggedMessage(token, recipientId, text) {
  try {
    await post(token, {
      messaging_type: 'RESPONSE',
      recipient: { id: recipientId },
      message: { text },
    });
  } catch (err) {
    const e = err.response?.data?.error;
    if (e?.code === 10) {
      // Outside the 24h window — expected until the UTILITY template path is wired.
      console.warn(`[sendTaggedMessage] outside 24h window for ${recipientId}; needs UTILITY template (order_status_update_v2). ${e.message}`);
    }
    throw err; // preserve existing fire-and-forget .catch() behaviour in callers
  }
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
// Each element: { title, subtitle, imageUrl, buttons: [{type, title, payload} | {type:'web_url', title, url, ...}] }
async function sendCatalog(token, recipientId, elements) {
  const mapped = elements.slice(0, 10).map(el => {
    const card = {
      title: el.title.substring(0, 80),
      subtitle: (el.subtitle || '').substring(0, 80),
      buttons: (el.buttons || []).slice(0, 3).map(b => {
        if (b.type === 'web_url') {
          const btn = { type: 'web_url', title: b.title.substring(0, 20), url: b.url };
          if (b.webview_height_ratio) btn.webview_height_ratio = b.webview_height_ratio;
          if (b.messenger_extensions) btn.messenger_extensions = b.messenger_extensions;
          return btn;
        }
        return { type: 'postback', title: b.title.substring(0, 20), payload: b.payload };
      }),
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

module.exports = { sendMessage, sendTaggedMessage, sendButtons, sendQuickReplies, sendCatalog, sendTyping };
