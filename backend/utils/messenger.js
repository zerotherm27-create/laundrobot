const axios = require('axios');
const db = require('../db');
const { BOT_METADATA_TAG, noteBotSend } = require('./botEchoTracker');

const GRAPH_URL = 'https://graph.facebook.com/v19.0/me/messages';
const GRAPH_VERSION = 'v21.0';
const UTILITY_TEMPLATE = 'order_status_update_v2';

async function post(token, body) {
  // Still stamp metadata as a secondary fallback for environments where mid
  // isn't available (see utils/botEchoTracker.js for the full reasoning).
  if (body?.message && body.message.metadata === undefined) {
    body.message.metadata = BOT_METADATA_TAG;
  }
  const resp = await axios.post(`${GRAPH_URL}?access_token=${token}`, body);
  const mid = resp.data?.message_id;
  noteBotSend(mid);
  // Persist to DB so the human-takeover check survives process restarts.
  if (mid) db.query('INSERT INTO bot_sends (mid) VALUES ($1) ON CONFLICT DO NOTHING', [mid]).catch(() => {});
  return resp;
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
// Tries RESPONSE (works within the 24h messaging window), then falls back to the
// approved UTILITY template `order_status_update_v2` for customers outside that window.
// The old POST_PURCHASE_UPDATE tag was deprecated by Meta on 2026-04-27 (error 100).
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
      console.warn(`[sendTaggedMessage] outside 24h window for ${recipientId}; needs UTILITY template. ${e.message}`);
    }
    throw err;
  }
}

// Send the approved utility template `order_status_update_v2`.
// Template body params: {{1}} customerName, {{2}} orderRef, {{3}} statusPhrase.
// pageId is the FB page id (not the token) — utility templates require /{pageId}/messages.
// Meta's exact Send API shape for utility templates is undocumented so we try candidates
// in order (same as scripts/send-utility-template.js) and use the first accepted one.
async function sendUtilityTemplate(pageId, token, recipientId, customerName, orderRef, statusPhrase) {
  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${pageId}/messages`;
  const params_list = [customerName, orderRef, statusPhrase].map(t => ({ type: 'text', text: t }));

  const candidates = [
    {
      label: 'A',
      message: {
        attachment: {
          type: 'template',
          payload: {
            template_type: 'utility',
            name: UTILITY_TEMPLATE,
            language: 'en_US',
            components: [{ type: 'body', parameters: params_list }],
          },
        },
      },
    },
    {
      label: 'B',
      message: {
        template: {
          name: UTILITY_TEMPLATE,
          language: { code: 'en_US' },
          components: [{ type: 'body', parameters: params_list }],
        },
      },
    },
    {
      label: 'C',
      message: {
        attachment: {
          type: 'template',
          payload: {
            template_type: 'customer_information',
            name: UTILITY_TEMPLATE,
            language: 'en_US',
            body_parameters: [customerName, orderRef, statusPhrase],
          },
        },
      },
    },
  ];

  let lastErr;
  for (const c of candidates) {
    const body = { messaging_type: 'MESSAGE_TAG', recipient: { id: recipientId }, ...c };
    try {
      const resp = await axios.post(url, body, { params: { access_token: token } });
      const mid = resp.data?.message_id;
      noteBotSend(mid);
      if (mid) db.query('INSERT INTO bot_sends (mid) VALUES ($1) ON CONFLICT DO NOTHING', [mid]).catch(() => {});
      console.log(`[utility-template] sent via candidate ${c.label} to ${recipientId} mid=${mid}`);
      return;
    } catch (err) {
      const e = err.response?.data?.error;
      console.warn(`[utility-template] candidate ${c.label} failed: (#${e?.code}/${e?.error_subcode}) ${e?.message || err.message}`);
      lastErr = err;
    }
  }
  throw lastErr;
}

// Sends a status notification: tries RESPONSE first (within 24h window),
// falls back to utility template for customers outside the window.
// pageId required for the utility template endpoint.
async function sendStatusUpdate(pageId, token, recipientId, text, customerName, orderRef, statusPhrase) {
  try {
    await post(token, {
      messaging_type: 'RESPONSE',
      recipient: { id: recipientId },
      message: { text },
    });
  } catch (err) {
    const e = err.response?.data?.error;
    if (e?.code === 10 && pageId) {
      console.log(`[sendStatusUpdate] outside 24h window for ${recipientId}; trying utility template`);
      await sendUtilityTemplate(pageId, token, recipientId, customerName, orderRef, statusPhrase);
    } else {
      throw err;
    }
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

module.exports = { sendMessage, sendTaggedMessage, sendStatusUpdate, sendUtilityTemplate, sendButtons, sendQuickReplies, sendCatalog, sendTyping };
