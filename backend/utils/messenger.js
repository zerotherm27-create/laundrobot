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

// Staff reply from the dashboard (human takeover). The HUMAN_AGENT tag lets a
// human respond up to 7 days after the customer's last message. Meta REJECTS
// this tag outright pre-App-Review-approval — confirmed live 2026-07-04:
// "(#100) Cannot tag messages with 'HUMAN_AGENT' without prior approval."
// (code 100, subcode 2018276) — even for app admins/testers, so there is no
// pre-approval bypass for this specific tag (unlike some other permissions).
// Fall back to a plain RESPONSE send (works within the standard 24h window)
// so staff replies aren't silently broken while approval is pending — same
// two-step shape as sendStatusUpdate's RESPONSE -> utility-template fallback.
async function sendHumanAgentMessage(token, recipientId, text) {
  const chunks = chunkText(text);
  const mids = [];
  for (const chunk of chunks) {
    let resp;
    try {
      resp = await post(token, {
        messaging_type: 'MESSAGE_TAG',
        tag: 'HUMAN_AGENT',
        recipient: { id: recipientId },
        message: { text: chunk },
      });
    } catch (err) {
      const e = err.response?.data?.error;
      if (e?.error_subcode === 2018276 || /without prior approval/.test(e?.message || '')) {
        console.log(`[sendHumanAgentMessage] HUMAN_AGENT tag not yet approved by Meta for ${recipientId}; falling back to RESPONSE`);
        resp = await post(token, {
          messaging_type: 'RESPONSE',
          recipient: { id: recipientId },
          message: { text: chunk },
        });
      } else {
        throw err;
      }
    }
    mids.push(resp.data?.message_id);
  }
  return mids;
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
//
// Utility Messages are a distinct Send API messaging_type ('UTILITY'), NOT a
// MESSAGE_TAG variant — there is no top-level `tag` field. The previous
// implementation probed 3 candidate shapes all using messaging_type:
// 'MESSAGE_TAG' + tag: 'UTILITY', which Meta rejects with "(#100) Invalid tag."
// (confirmed live in Railway logs across every PROCESSING/FOR DELIVERY/COMPLETED
// send outside the 24h RESPONSE window, root-caused 2026-07-26). Per Meta's
// Utility Messages docs (developers.facebook.com/docs/messenger-platform/
// send-messages/utility-messages), the correct shape is messaging_type:
// 'UTILITY' with message.template — no tag, no attachment wrapper.
async function sendUtilityTemplate(pageId, token, recipientId, customerName, orderRef, statusPhrase) {
  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${pageId}/messages`;
  const params_list = [customerName, orderRef, statusPhrase].map(t => ({ type: 'text', text: t }));

  const body = {
    messaging_type: 'UTILITY',
    recipient: { id: recipientId },
    message: {
      template: {
        name: UTILITY_TEMPLATE,
        language: { code: 'en_US' },
        components: [{ type: 'body', parameters: params_list }],
      },
    },
  };

  const resp = await axios.post(url, body, { params: { access_token: token } });
  const mid = resp.data?.message_id;
  noteBotSend(mid);
  if (mid) db.query('INSERT INTO bot_sends (mid) VALUES ($1) ON CONFLICT DO NOTHING', [mid]).catch(() => {});
  console.log(`[utility-template] sent to ${recipientId} mid=${mid}`);
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

/**
 * Chat-formatted "where to drop off" block for drop-off bookings.
 *
 * A drop-off customer brings the laundry to the shop, so they need the SHOP's
 * address and contact details — the address on the order is their own. Shared by
 * the booking confirmation (routes/public.js) and the payment confirmation
 * (webhooks/xendit.js) so both read the same.
 *
 * Expects a tenant row selected with `shop_address, contact_number`. Address and
 * mobile number only — no support email here. Returns '' when the tenant has
 * filled in neither (Settings → Shop Info), so callers can concatenate it
 * unconditionally.
 */
function shopLocationText(tenant) {
  const lines = [];
  if (tenant?.shop_address)   lines.push(`📍 ${tenant.shop_address}`);
  if (tenant?.contact_number) lines.push(`📱 ${tenant.contact_number}`);
  if (!lines.length) return '';
  return `🏪 Where to drop off:\n${lines.join('\n')}\n\n`;
}

module.exports = { sendMessage, sendTaggedMessage, sendHumanAgentMessage, sendStatusUpdate, sendUtilityTemplate, sendButtons, sendQuickReplies, sendCatalog, sendTyping, shopLocationText };
