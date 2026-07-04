const router = require('express').Router();
const { randomUUID } = require('crypto');
const crypto = require('crypto');
const { signatureMatches } = require('../utils/webhookSig');
const axios = require('axios');
const db = require('../db');
const messengerUtils = require('../utils/messenger');
const { sendMessage, sendTaggedMessage, sendButtons, sendQuickReplies, sendCatalog, sendTyping } = messengerUtils;
const igUtils = require('../utils/instagram');
const { isBotOwnEcho, hasSentMid } = require('../utils/botEchoTracker');
const { createInvoice } = require('../utils/xendit');
const { askGemini } = require('../utils/gemini');

// IG sends go through the PAGE's /messages edge (Facebook-login flavor) —
// pass the fb_page_id, NOT the ig_user_id (see utils/instagram.js).
function makeSends(channel, token, pageId) {
  if (channel === 'instagram') {
    return {
      sendMessage:      (t, r, text)         => igUtils.sendMessage(t, pageId, r, text),
      sendButtons:      (t, r, text, btns)   => igUtils.sendButtons(t, pageId, r, text, btns),
      sendQuickReplies: (t, r, text, replies) => igUtils.sendQuickReplies(t, pageId, r, text, replies),
      sendCatalog:      (t, r, els)          => igUtils.sendCatalog(t, pageId, r, els),
      sendTaggedMessage:(t, r, text)         => igUtils.sendMessage(t, pageId, r, text),
    };
  }
  return { sendMessage, sendTaggedMessage, sendButtons, sendQuickReplies, sendCatalog };
}

function bookBtn(tenantId, psid = null, customDomain = null, channel = 'messenger') {
  const base = customDomain ? `https://${customDomain}` : process.env.APP_URL;
  if (!base) return { type: 'postback', title: '🛒 Book Now', payload: 'BOOK' };
  const url = psid ? `${base}/book/${tenantId}?psid=${psid}` : `${base}/book/${tenantId}`;
  // Instagram has no messenger_extensions webview — plain web_url opens the
  // booking form in the in-app browser instead.
  return channel === 'instagram'
    ? { type: 'web_url', title: '🛒 Book Now', url }
    : { type: 'web_url', title: '🛒 Book Now', url, webview_height_ratio: 'full', messenger_extensions: true };
}

// ── Webhook verification ────────────────────────────────────────────────────
router.get('/', (req, res) => {
  if (req.query['hub.verify_token'] === process.env.FB_VERIFY_TOKEN) {
    return res.send(req.query['hub.challenge']);
  }
  res.sendStatus(403);
});

// ── Incoming messages ───────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  // HMAC signature verification. IG DM webhooks can be signed by the
  // companion Instagram app (FB_IG_APP_SECRET), not just the main app —
  // verify against every configured secret (utils/webhookSig.js).
  const sig = req.headers['x-hub-signature-256'];
  if (!process.env.FB_APP_SECRET) {
    console.error('[messenger-webhook] FB_APP_SECRET not set');
    return res.sendStatus(500);
  }
  if (!sig) {
    console.warn('[messenger-webhook] Missing signature');
    return res.sendStatus(403);
  }
  const rawBody = req.body; // Buffer because express.raw() applied in server.js
  if (!signatureMatches(rawBody, sig, [process.env.FB_APP_SECRET, process.env.FB_IG_APP_SECRET])) {
    // Body preview identifies which app/payload shape is being rejected.
    console.warn('[messenger-webhook] Signature mismatch — body preview:', rawBody.toString().slice(0, 300));
    return res.sendStatus(403);
  }
  const body = JSON.parse(rawBody.toString());

  res.sendStatus(200);
  const { object, entry } = body;
  // Log full structure of every incoming event to diagnose missing echoes
  for (const e of (entry || [])) {
    for (const ev of (e.messaging || [])) {
      console.log('[webhook-raw]', JSON.stringify({
        sender: ev.sender?.id, recipient: ev.recipient?.id,
        is_echo: ev.message?.is_echo, mid: ev.message?.mid,
        has_postback: !!ev.postback, has_optin: !!ev.optin,
        text_preview: ev.message?.text?.slice(0, 30),
      }));
    }
  }
  console.log('[webhook] received object:', object, 'entries:', entry?.length);

  try {
    // ── Instagram ──
    if (object === 'instagram') {
      for (const e of entry) {
        const igId = e.id;
        console.log('[ig-webhook] entry id:', igId, '| messaging events:', e.messaging?.length ?? 0);
        const { rows: [tenant] } = await db.query(
          'SELECT * FROM tenants WHERE ig_user_id = $1 AND active = TRUE', [igId]
        );
        if (!tenant) {
          console.log('[ig-webhook] NO TENANT MATCHED for ig_user_id:', igId, '— check that this matches the ig_user_id in your tenant settings');
          continue;
        }
        console.log('[ig-webhook] matched tenant:', tenant.name);
        for (const event of (e.messaging || [])) {
          console.log('[ig-webhook] event — sender:', event.sender?.id, '| has_message:', !!event.message, '| has_postback:', !!event.postback, '| is_echo:', !!event.message?.is_echo);
          // Admin replied from Instagram — sender is the IG business account.
          // Pause the AI unless this echo is one of the bot's own outgoing
          // messages (tracked locally — Meta's app_id can't be trusted to tell
          // a human Business-Suite reply apart from our API sends).
          if (event.message?.is_echo || (event.message && event.sender.id === String(tenant.ig_user_id))) {
            const ownEcho = isBotOwnEcho(event.message);
            console.log('[ig-webhook] echo — recipient:', event.recipient.id, '| mid:', event.message.mid, '| metadata:', event.message.metadata, '| ownEcho:', ownEcho);
            if (!ownEcho) {
              console.log('[ig-webhook] HUMAN REPLY detected — pausing AI for', event.recipient.id);
              try { await pauseAiForCustomer(tenant, event.recipient.id); }
              catch (err) { console.error('[ig-webhook] echo-pause error:', err.message); }
            }
          } else if (event.message || event.postback) {
            console.log('[ig-webhook] handling message from:', event.sender.id);
            try { await handleMessage(tenant, event.sender.id, event, 'instagram'); }
            catch (err) { console.error('[ig-webhook] handleMessage error:', err.response?.data || err.message); }
          }
        }
      }
      return;
    }

    // ── Messenger ──
    if (object !== 'page') return;
    for (const e of entry) {
      const pageId = e.id;
      const { rows: [tenant] } = await db.query(
        'SELECT * FROM tenants WHERE fb_page_id = $1 AND active = TRUE', [pageId]
      );
      if (!tenant) { console.log('[webhook] no tenant for page:', pageId); continue; }
      if (!tenant.fb_page_access_token) { console.warn('[webhook] tenant has no page access token:', tenant.id); continue; }
      for (const event of (e.messaging || [])) {
        if (event.optin) {
          try { await handleOptin(tenant, event.sender.id, event.optin.ref); }
          catch (err) { console.error('[webhook] optin error:', err.message); }
        } else if (event.referral) {
          try { await handleOptin(tenant, event.sender.id, event.referral.ref); }
          catch (err) { console.error('[webhook] referral error:', err.message); }
        } else if (event.message?.is_echo) {
          // Pause AI when a human staff member replies — but NOT when the bot
          // itself sends a message. We recognise the bot's own echoes by the
          // metadata tag we stamp on every send (Meta round-trips it); humans'
          // inbox replies have none. Never use app_id (see isBotOwnEcho).
          const ownEcho = isBotOwnEcho(event.message);
          console.log('[webhook] echo — recipient:', event.recipient.id, '| mid:', event.message.mid, '| metadata:', event.message.metadata, '| ownEcho:', ownEcho);
          if (!ownEcho) {
            console.log('[webhook] HUMAN REPLY detected — pausing AI for', event.recipient.id);
            try { await pauseAiForCustomer(tenant, event.recipient.id); }
            catch (err) { console.error('[webhook] echo-pause error:', err.message); }
          }
        } else if (event.message || event.postback) {
          console.log('[webhook] msg from:', event.sender.id);
          // Handle GET_STARTED postback that carries an m.me ref param
          if (event.postback?.payload === 'GET_STARTED' && event.postback?.referral?.ref) {
            try { await handleOptin(tenant, event.sender.id, event.postback.referral.ref); }
            catch (err) { console.error('[webhook] referral optin error:', err.message); }
          } else {
            try { await handleMessage(tenant, event.sender.id, event, 'messenger'); }
            catch (err) { console.error('[webhook] error:', err.response?.data || err.message); }
          }
        }
      }
    }
  } catch (err) {
    console.error('[webhook] unhandled error in post handler:', err.message);
  }
});

// ── Helpers ─────────────────────────────────────────────────────────────────
async function getFBFirstName(token, senderId) {
  try {
    const { data } = await axios.get(
      `https://graph.facebook.com/v19.0/${senderId}?fields=first_name&access_token=${token}`,
      { timeout: 4000 }
    );
    return data.first_name || null;
  } catch { return null; }
}

async function getOrCreateCustomer(tenantId, senderId, token) {
  // Fetch name upfront so we can use it in the upsert.
  // COALESCE(customers.name, EXCLUDED.name) keeps an existing name and only fills it in if blank.
  const firstName = token ? await getFBFirstName(token, senderId) : null;
  const { rows: [customer] } = await db.query(
    `INSERT INTO customers (tenant_id, fb_id, name) VALUES ($1,$2,$3)
     ON CONFLICT (tenant_id, fb_id) DO UPDATE
       SET name = COALESCE(customers.name, EXCLUDED.name)
     RETURNING *`,
    [tenantId, senderId, firstName]
  );
  return customer;
}

async function getConv(tenantId, senderId) {
  let { rows: [conv] } = await db.query(
    'SELECT * FROM conversations WHERE tenant_id=$1 AND fb_user_id=$2', [tenantId, senderId]
  );
  if (!conv) {
    await db.query(
      'INSERT INTO conversations (tenant_id, fb_user_id, step, data) VALUES ($1,$2,$3,$4)',
      [tenantId, senderId, 'START', '{}']
    );
    conv = { step: 'START', data: {}, needs_human: false };
  }
  return conv;
}

const HUMAN_TRIGGERS = ['human', 'agent', 'live agent', 'representative', 'talk to someone',
  'real person', 'tao', 'operator', 'speak to someone', 'customer service'];

function wantsHuman(text) {
  const lc = text.toLowerCase().trim();
  return HUMAN_TRIGGERS.some(t => lc.includes(t));
}

function makeSetState(tenantId, senderId) {
  return async (newStep, newData, existingData) => {
    await db.query(
      'UPDATE conversations SET step=$1, data=$2, updated_at=NOW() WHERE tenant_id=$3 AND fb_user_id=$4',
      [newStep, JSON.stringify({ ...(existingData || {}), ...(newData || {}) }), tenantId, senderId]
    );
  };
}

// ── Phone number validation ─────────────────────────────────────────────────
// Accepts PH numbers: 09XXXXXXXXX, +639XXXXXXXXX, 639XXXXXXXXX
// Also accepts international WhatsApp numbers (7–15 digits)
function isValidPHNumber(raw) {
  const n = raw.replace(/[\s\-().]/g, '');
  return /^(\+63|63)?9\d{9}$/.test(n) || /^09\d{9}$/.test(n);
}

function isValidIntlNumber(raw) {
  const n = raw.replace(/[\s\-().+]/g, '');
  return /^\d{7,15}$/.test(n);
}

function normalizePhone(raw) {
  const n = raw.replace(/[\s\-().]/g, '');
  if (/^09\d{9}$/.test(n)) return '+63' + n.slice(1);
  if (/^639\d{9}$/.test(n)) return '+' + n;
  if (/^\+639\d{9}$/.test(n)) return n;
  return n; // international / WhatsApp — keep as-is
}

// ── Determine next booking step after quantity ──────────────────────────────
// Returns the step name for whatever info is still missing
function nextInfoStep(customer) {
  if (!customer.phone)   return 'ASK_PHONE';
  if (!customer.address) return 'ASK_ADDRESS';
  if (!customer.email)   return 'ASK_EMAIL';
  if (!customer.name)    return 'ASK_NAME';
  return 'ASK_DATETIME';
}

// ── Catalog helpers ─────────────────────────────────────────────────────────
async function showCategoryMenu(sends, token, senderId, tenantId, channel, customDomain = null) {
  // Only categories with at least one bookable-online service — walk-in-only
  // categories (available_online=FALSE) belong to the POS, not the bot.
  const { rows: cats } = await db.query(
    `SELECT * FROM service_categories c WHERE c.tenant_id=$1 AND c.active=TRUE
       AND EXISTS (SELECT 1 FROM services s WHERE s.category_id=c.id AND s.active=TRUE AND s.available_online=TRUE)
     ORDER BY c.sort_order ASC`,
    [tenantId]
  );

  if (cats.length === 0) return showServiceCatalog(sends, token, senderId, tenantId, null, channel, customDomain);
  if (cats.length === 1) return showServiceCatalog(sends, token, senderId, tenantId, cats[0].id, channel, customDomain);

  const replies = cats.map(c => ({ title: c.name, payload: `CAT:${c.id}:${c.name}` }));
  replies.push({ title: '🛍 All Services', payload: 'CAT:ALL:All Services' });
  await sends.sendQuickReplies(token, senderId, '🧺 What type of laundry service are you looking for?', replies);
}

async function showServiceCatalog(sends, token, senderId, tenantId, categoryId, channel, customDomain = null) {
  let query, params;
  if (!categoryId || categoryId === 'ALL') {
    query = `SELECT s.*, c.name AS category_name FROM services s
             LEFT JOIN service_categories c ON c.id = s.category_id
             WHERE s.tenant_id=$1 AND s.active=TRUE AND s.available_online=TRUE
             ORDER BY c.sort_order ASC NULLS LAST, s.sort_order ASC, s.name ASC`;
    params = [tenantId];
  } else {
    query = `SELECT s.*, c.name AS category_name FROM services s
             LEFT JOIN service_categories c ON c.id = s.category_id
             WHERE s.tenant_id=$1 AND s.category_id=$2 AND s.active=TRUE AND s.available_online=TRUE
             ORDER BY s.sort_order ASC, s.name ASC`;
    params = [tenantId, categoryId];
  }

  const { rows: services } = await db.query(query, params);
  if (services.length === 0) {
    await sends.sendMessage(token, senderId, 'No services available in this category yet. Type "hi" to go back.');
    return;
  }

  // Fetch minimum variation price for services priced at ₱0 (pricing done via select field options)
  const serviceIds = services.map(s => s.id);
  const { rows: minPriceRows } = await db.query(
    `SELECT scf.service_id, MIN((opt->>'price')::numeric) AS min_price
     FROM service_custom_fields scf, jsonb_array_elements(scf.options) AS opt
     WHERE scf.service_id = ANY($1)
       AND scf.field_type = 'select'
       AND COALESCE(opt->>'price_type', 'fixed') != 'copy_base'
       AND (opt->>'price')::numeric > 0
     GROUP BY scf.service_id`,
    [serviceIds]
  );
  const minPriceMap = Object.fromEntries(minPriceRows.map(r => [r.service_id, Number(r.min_price)]));

  // Messenger: "Book Now" opens webform. Instagram: "Book This" starts bot flow.
  const appUrl = process.env.APP_URL;
  const backendUrl = process.env.BACKEND_URL;
  // Use custom domain for Pro tenants; fall back to APP_URL
  const baseUrl = customDomain ? `https://${customDomain}` : appUrl;
  const useWebform = channel === 'messenger' && !!baseUrl;
  const bookUrl = baseUrl ? `${baseUrl}/book/${tenantId}?psid=${senderId}` : null;

  const elements = services.map(s => {
    const basePrice = Number(s.price);
    const minOpt = minPriceMap[s.id];
    let priceStr;
    if (basePrice > 0) {
      priceStr = `₱${basePrice.toLocaleString()} ${s.unit}`;
    } else if (minOpt) {
      priceStr = `Starts at ₱${minOpt.toLocaleString()} ${s.unit}`;
    } else {
      priceStr = `₱0 ${s.unit}`;
    }
    let imageUrl = null;
    if (s.image_url) {
      if (s.image_url.startsWith('data:') && backendUrl) {
        imageUrl = `${backendUrl}/public/image/${s.id}`;
      } else if (!s.image_url.startsWith('data:')) {
        imageUrl = s.image_url;
      }
    }
    return {
      title: s.name,
      subtitle: priceStr + (s.description ? `\n${s.description}` : ''),
      imageUrl,
      buttons: useWebform
        ? [{ type: 'web_url', title: '🛒 Book Now', url: bookUrl, webview_height_ratio: 'full', messenger_extensions: true }]
        : [{ title: '🛒 Book This', payload: `SVC:${s.id}:${s.name}:${s.price}:${s.unit}` }],
    };
  });

  const catName = services[0]?.category_name;
  const intro = catName && categoryId !== 'ALL'
    ? `Here are our ${catName} services 👇 Tap "Book Now" to order:`
    : `Here are all our services 👇 Tap "Book Now" to order:`;

  await sends.sendMessage(token, senderId, intro);
  await sends.sendCatalog(token, senderId, elements);
}

// ── Send to Messenger optin handler ─────────────────────────────────────────
async function handleOptin(tenant, senderId, ref) {
  const token = tenant.fb_page_access_token;
  if (!token) return;
  const sends = makeSends('messenger', token, null);

  // Track referral click + store ref on conversation for order attribution
  if (ref) {
    const { rows: [link] } = await db.query(
      `SELECT id FROM referral_links WHERE tenant_id=$1 AND ref=$2`,
      [tenant.id, ref]
    );
    if (link) {
      await db.query(`UPDATE referral_links SET click_count = click_count + 1 WHERE id=$1`, [link.id]);
      await db.query(
        `INSERT INTO conversations (tenant_id, fb_user_id, step, data, referral_ref, updated_at)
         VALUES ($1, $2, 'MENU', '{}', $3, NOW())
         ON CONFLICT (tenant_id, fb_user_id)
         DO UPDATE SET referral_ref = $3, updated_at = NOW()`,
        [tenant.id, senderId, ref]
      );
      // Referral link — drop into booking menu
      await sends.sendButtons(token, senderId,
        `👋 Hi! Welcome to ${tenant.name}!\n\nWhat would you like to do?`,
        [
          bookBtn(tenant.id, channel === 'messenger' ? senderId : null, tenant.custom_domain, channel),
          { type: 'postback', title: '📦 My Orders', payload: 'MY_ORDERS' },
          { type: 'postback', title: '❓ FAQs',       payload: 'FAQS'      },
        ]
      );
      return;
    }
  }

  // Link this PSID to customer via booking_ref in data-ref
  let customerName = null;
  if (ref) {
    const { rows: [row] } = await db.query(
      `SELECT c.id, c.name FROM orders o
       JOIN customers c ON c.id = o.customer_id
       WHERE o.booking_ref=$1 AND o.tenant_id=$2 LIMIT 1`,
      [ref, tenant.id]
    );
    if (row) {
      await db.query(
        `UPDATE customers SET fb_id=$1 WHERE id=$2 AND tenant_id=$3`,
        [senderId, row.id, tenant.id]
      );
      customerName = row.name;
    }
  }

  await sends.sendMessage(token, senderId,
    `✅ Hi ${customerName || 'there'}! You're now connected. We'll send your order updates right here in Messenger.`
  );
  await sends.sendButtons(token, senderId,
    `🎁 Want to also receive exclusive promos and updates from us? Tap Get Updates!`,
    [
      { type: 'postback', title: '✅ Get Updates', payload: 'SUBSCRIBE_PROMO' },
      { type: 'postback', title: 'No thanks',   payload: 'NO_SUBSCRIBE'    },
    ]
  );
}

// ── Subscribe prompt (shown after natural interactions) ──────────────────────
async function showSubscribePrompt(sends, token, senderId, customer) {
  if (customer?.promo_subscribed) return;
  await sends.sendButtons(token, senderId,
    `🎁 Want to receive our latest promos and updates? Tap Get Updates to stay in the loop!`,
    [
      { type: 'postback', title: '✅ Get Updates', payload: 'SUBSCRIBE_PROMO' },
      { type: 'postback', title: 'No thanks',   payload: 'NO_SUBSCRIBE'    },
    ]
  );
}

// ── Graph API fallback: detect human reply without message_echoes ────────────
// When message_echoes subscription is not delivering, we query the conversation
// thread directly. If any recent message FROM the page has a mid we never sent
// (not in botEchoTracker._sentMids), a human staff member replied → pause AI.
const GRAPH_BASE = 'https://graph.facebook.com/v19.0';
async function checkForHumanReply(pageToken, userId, tenant) {
  try {
    const pauseHours = tenant.ai_pause_hours ?? 2;
    const { data } = await axios.get(`${GRAPH_BASE}/me/conversations`, {
      params: {
        user_id: userId,
        access_token: pageToken,
        fields: 'messages.limit(5){from,id,created_time}',
      },
      timeout: 3000,
    });
    const messages = data?.data?.[0]?.messages?.data || [];
    const cutoffMs = Date.now() - pauseHours * 3_600_000;
    for (const msg of messages) {
      if (msg.from?.id === userId) continue;                          // customer's own message
      if (new Date(msg.created_time).getTime() < cutoffMs) continue; // too old to matter
      if (hasSentMid(msg.id)) continue;                              // in-memory: bot's own send
      // Not in memory (possible after restart) — check DB before concluding it's human
      const { rows } = await db.query(
        "SELECT 1 FROM bot_sends WHERE mid=$1 AND created_at > NOW() - INTERVAL '5 hours'",
        [msg.id]
      );
      if (rows.length > 0) continue; // DB confirms it's a bot send
      console.log('[human-check] human reply detected via Graph API mid:', msg.id);
      return true;
    }
    return false;
  } catch (err) {
    // Fail open — let AI reply rather than silently blocking it
    console.warn('[human-check] Graph API check failed:', err.response?.data?.error?.message || err.message);
    return false;
  }
}

// ── Pause AI for a customer (called on admin echo) ───────────────────────────
async function pauseAiForCustomer(tenant, customerId) {
  const pauseHours = tenant.ai_pause_hours ?? 2;
  if (!pauseHours) return; // 0 = disabled
  const pauseUntil = new Date(Date.now() + pauseHours * 60 * 60 * 1000).toISOString();
  await db.query(
    `INSERT INTO conversations (tenant_id, fb_user_id, step, data, ai_paused_until, updated_at)
     VALUES ($1, $2, 'AI', '{}', $3, NOW())
     ON CONFLICT (tenant_id, fb_user_id)
     DO UPDATE SET ai_paused_until=$3, updated_at=NOW()`,
    [tenant.id, customerId, pauseUntil]
  );
  console.log(`[ai-pause] paused for ${customerId} until ${pauseUntil}`);
}

// ── Main message handler ────────────────────────────────────────────────────
async function handleMessage(tenant, senderId, event, channel = 'messenger') {
  const token    = tenant.fb_page_access_token;
  const sends    = makeSends(channel, token, tenant.fb_page_id);
  // Shadow module-level send imports so all existing call sites below work unchanged
  const sendMessage      = sends.sendMessage.bind(sends);
  const sendButtons      = sends.sendButtons.bind(sends);
  const sendQuickReplies = sends.sendQuickReplies.bind(sends);
  const sendCatalog      = sends.sendCatalog.bind(sends);
  const sendTaggedMessage= sends.sendTaggedMessage.bind(sends);
  const text     = event.message?.quick_reply?.payload || event.postback?.payload || event.message?.text || '';
  const lc       = text.toLowerCase().trim();
  const conv     = await getConv(tenant.id, senderId);
  const step     = conv.step;
  const data     = conv.data || {};
  const setState = makeSetState(tenant.id, senderId);
  const customer = await getOrCreateCustomer(tenant.id, senderId, token);

  // ── Needs human — bot stays silent unless customer resets ────────────
  if (conv.needs_human) {
    if (lc === 'hi' || lc === 'hello' || lc === 'start' || text === 'GET_STARTED' || lc === 'bot' || lc === 'menu') {
      // Customer explicitly resets — hand back to bot
      await db.query(
        'UPDATE conversations SET needs_human=FALSE, needs_human_at=NULL, step=$1, data=$2 WHERE tenant_id=$3 AND fb_user_id=$4',
        ['START', '{}', tenant.id, senderId]
      );
      // Show welcome menu and return — do NOT fall through.
      // (step is already read as a const above and still holds the old value,
      //  so falling through would skip the welcome check and hit the AI fallback.)
      const greeting = customer.name
        ? `👋 Hi, ${customer.name.split(' ')[0]}! Welcome back to ${tenant.name}!`
        : `👋 Hi! Welcome to ${tenant.name}!`;
      await sendButtons(token, senderId,
        `${greeting}\n\nWhat would you like to do?`,
        [
          bookBtn(tenant.id, channel === 'messenger' ? senderId : null, tenant.custom_domain, channel),
          { type: 'postback', title: '📦 My Orders', payload: 'MY_ORDERS' },
          { type: 'postback', title: '❓ FAQs',       payload: 'FAQS'      },
        ]
      );
      await setState('MENU', {}, {});
      return;
    } else {
      // Still waiting for human — stay silent
      return;
    }
  }

  // ── Human request ────────────────────────────────────────────────────
  if (wantsHuman(text) && !event.postback) {
    await db.query(
      'UPDATE conversations SET needs_human=TRUE, needs_human_at=NOW(), needs_human_text=$3 WHERE tenant_id=$1 AND fb_user_id=$2',
      [tenant.id, senderId, event.message?.text || null]
    );
    await sendMessage(token, senderId,
      `Got it! I've notified our team and someone will reply to you shortly. 🙏\n\nIf you change your mind and want to chat with the bot again, just type "hi".`
    );
    return;
  }

  // ── Welcome menu on first message — only shown when AI is OFF ───────
  // When AI is enabled, the AI handles the first message naturally and
  // recommends typing "book" when the customer is ready. The menu still
  // appears if the customer explicitly types "hi", "menu", etc. (below).
  if (step === 'START' && !event.postback && !tenant.ai_enabled) {
    const greeting = customer.name
      ? `👋 Hi, ${customer.name.split(' ')[0]}! Welcome to ${tenant.name}!`
      : `👋 Hi! Welcome to ${tenant.name}!`;
    await sendButtons(token, senderId,
      `${greeting}\n\nWhat would you like to do?`,
      [
        bookBtn(tenant.id, channel === 'messenger' ? senderId : null, tenant.custom_domain, channel),
        { type: 'postback', title: '📦 My Orders', payload: 'MY_ORDERS' },
        { type: 'postback', title: '❓ FAQs',       payload: 'FAQS'      },
      ]
    );
    await setState('MENU', {}, {});
    return;
  }

  // ── Global commands ──────────────────────────────────────────────────
  if (lc === 'hi' || lc === 'hello' || lc === 'start' || lc === 'get started' || lc === 'menu' || text === 'GET_STARTED') {
    const greeting = customer.name ? `👋 Hi, ${customer.name.split(' ')[0]}! Welcome to ${tenant.name}!` : `👋 Hi! Welcome to ${tenant.name}!`;
    await sendButtons(token, senderId,
      `${greeting}\n\nWhat would you like to do?`,
      [
        bookBtn(tenant.id, channel === 'messenger' ? senderId : null, tenant.custom_domain, channel),
        { type: 'postback', title: '📦 My Orders', payload: 'MY_ORDERS' },
        { type: 'postback', title: '❓ FAQs',       payload: 'FAQS'      },
      ]
    );
    await setState('MENU', {}, {});
    return;
  }

  if (lc === 'book' || text === 'BOOK') {
    // Both channels get the WEB booking form — the in-chat flow is only the
    // fallback when no APP_URL is configured.
    if ((channel === 'messenger' || channel === 'instagram') && process.env.APP_URL) {
      await sendButtons(token, senderId, `Ready to book? Tap below to get started! 👇`,
        [bookBtn(tenant.id, channel === 'messenger' ? senderId : null, tenant.custom_domain, channel)]);
    } else {
      await setState('SELECT_CATEGORY', {}, {});
      await showCategoryMenu(sends, token, senderId, tenant.id, channel, tenant.custom_domain);
    }
    return;
  }

  if (lc === 'services' || text === 'SERVICES') {
    await setState('SELECT_CATEGORY', {}, {});
    await showCategoryMenu(sends, token, senderId, tenant.id, channel, tenant.custom_domain);
    return;
  }

  // ── FAQs ─────────────────────────────────────────────────────────────
  if (text === 'FAQS' || lc === 'faq' || lc === 'faqs') {
    const { rows: faqs } = await db.query(
      `SELECT * FROM faqs WHERE tenant_id=$1 AND active=TRUE ORDER BY sort_order ASC, id ASC LIMIT 11`,
      [tenant.id]
    );
    if (!faqs.length) {
      await sendMessage(token, senderId, "We don't have any FAQs set up yet. Type \"hi\" to go back.");
      return;
    }
    const replies = faqs.map(f => ({ title: f.question.length > 20 ? f.question.slice(0, 19) + '…' : f.question, payload: `FAQ:${f.id}` }));
    replies.push({ title: '🏠 Main Menu', payload: 'MAIN_MENU' });
    await sendQuickReplies(token, senderId, '❓ What would you like to know?', replies);
    await setState('FAQ_LIST', {}, {});
    return;
  }

  if (text.startsWith('FAQ:')) {
    const faqId = text.split(':')[1];
    const { rows: [faq] } = await db.query(
      `SELECT * FROM faqs WHERE id=$1 AND tenant_id=$2 AND active=TRUE`, [faqId, tenant.id]
    );
    if (!faq) { await sendMessage(token, senderId, 'FAQ not found. Type "hi" to go back.'); return; }
    await sendMessage(token, senderId, `❓ *${faq.question}*\n\n${faq.answer}`);
    await sendQuickReplies(token, senderId, 'Was that helpful?', [
      { title: '❓ More FAQs', payload: 'FAQS' },
      { title: '🏠 Main Menu', payload: 'MAIN_MENU' },
    ]);
    await showSubscribePrompt(sends, token, senderId, customer);
    return;
  }

  if (text === 'MAIN_MENU') {
    await sendButtons(token, senderId, `What would you like to do?`,
      [
        bookBtn(tenant.id, channel === 'messenger' ? senderId : null, tenant.custom_domain, channel),
        { type: 'postback', title: '📋 View Services', payload: 'SERVICES' },
        { type: 'postback', title: '❓ FAQs',          payload: 'FAQS'     },
      ]
    );
    await setState('MENU', {}, {});
    return;
  }

  if (text === 'MY_ORDERS') {
    const { rows: orders } = await db.query(
      `SELECT o.id, o.booking_ref, o.status, o.price, o.created_at, s.name as service_name
       FROM orders o LEFT JOIN services s ON s.id=o.service_id
       WHERE o.customer_id=$1 ORDER BY o.created_at DESC LIMIT 3`,
      [customer.id]
    );
    if (!orders.length) {
      await sendMessage(token, senderId, "You don't have any orders yet. Type \"book\" to get started!");
    } else {
      await sendMessage(token, senderId, `Here are your recent orders:`);
      for (const o of orders) {
        const ref = o.booking_ref || o.id.slice(-8).toUpperCase();
        const label = `📦 ${ref}\n${o.service_name || 'Service'} — ₱${Number(o.price).toLocaleString()}\nStatus: ${o.status}`;
        await sendButtons(token, senderId, label, [
          { type: 'postback', title: '🔄 Reorder', payload: `REORDER:${o.id}` },
        ]);
      }
    }
    await showSubscribePrompt(sends, token, senderId, customer);
    return;
  }

  // ── Reorder — prefill booking form from a previous order ────────────────
  if (text.startsWith('REORDER:')) {
    const orderId = text.split(':')[1];
    const { rows: [order] } = await db.query(
      `SELECT o.id, o.booking_ref, o.address, o.notes, s.name as service_name
       FROM orders o LEFT JOIN services s ON s.id=o.service_id
       WHERE o.id=$1 AND o.tenant_id=$2`,
      [orderId, tenant.id]
    );
    if (!order) {
      await sendMessage(token, senderId, "Sorry, we couldn't find that order. Type \"book\" to start a new one.");
      return;
    }
    const summary = [
      `Here's your previous order:`,
      `🧺 ${order.service_name || 'Service'}`,
      `📍 ${order.address}`,
      order.notes ? `📝 ${order.notes}` : null,
      `\nWant to book again with these details?`,
    ].filter(Boolean).join('\n');

    const base = tenant.custom_domain ? `https://${tenant.custom_domain}` : process.env.APP_URL;
    const reorderUrl = `${base}/book/${tenant.id}?psid=${senderId}&reorder=${orderId}`;
    const freshUrl   = `${base}/book/${tenant.id}?psid=${senderId}`;

    if (base) {
      await sendButtons(token, senderId, summary, [
        { type: 'web_url', title: '✅ Book Again', url: reorderUrl, webview_height_ratio: 'full', messenger_extensions: true },
        { type: 'web_url', title: '✏️ Change Details', url: freshUrl, webview_height_ratio: 'full', messenger_extensions: true },
      ]);
    } else {
      await sendMessage(token, senderId, `${summary}\n\nType "book" to proceed.`);
    }
    return;
  }

  // ── Category selected ────────────────────────────────────────────────
  if (text.startsWith('CAT:')) {
    const parts = text.split(':');
    const catId = parts[1];
    await setState('SELECT_SERVICE', {}, {});
    await showServiceCatalog(sends, token, senderId, tenant.id, catId === 'ALL' ? null : catId, channel, tenant.custom_domain);
    return;
  }

  // ── Service selected — both channels redirect to the webform. The in-chat
  // ASK_WEIGHT→CONFIRM flow below never asks for a delivery zone or adds
  // delivery_fee to the total (it silently booked/charged customers for the
  // service price only), while the webform (routes/public.js) computes
  // delivery_fee from the tenant's delivery zones. Redirect instead of
  // maintaining pricing logic in two places. ──
  if (text.startsWith('SVC:')) {
    if (process.env.APP_URL) {
      await sendButtons(token, senderId, `Tap below to complete your booking! 👇`, [bookBtn(tenant.id, channel === 'messenger' ? senderId : null, tenant.custom_domain, channel)]);
      return;
    }
    const parts   = text.split(':');
    const svcId   = parts[1];
    const svcName = parts[2];
    const price   = parts[3];
    const unit    = parts[4] || 'per kg';

    const qtyLabel = unit.includes('kg')    ? 'How many kg of laundry? (e.g. 5)' :
                     unit.includes('piece') ? 'How many pieces? (e.g. 10)' :
                     unit.includes('set')   ? 'How many sets? (e.g. 2)' : 'Quantity? (e.g. 3)';

    await sendMessage(token, senderId,
      `✅ Great choice! You selected:\n\n🧺 *${svcName}*\n💰 ₱${Number(price).toLocaleString()} ${unit}\n\n⚖️ ${qtyLabel}`
    );
    await setState('ASK_WEIGHT', { service_id: svcId, service_name: svcName, price_per_kg: price, unit }, {});
    return;
  }

  // ── Booking flow fallback (only reachable when APP_URL is unset) ─────────
  // Guard: if a user has a stale in-flight booking step from before this
  // redirect existed, or APP_URL got set after they entered the flow,
  // redirect them to the webform rather than letting them reach CONFIRM
  // with a total that's missing delivery_fee.
  if (process.env.APP_URL && ['ASK_WEIGHT','ASK_PHONE','ASK_ADDRESS','ASK_EMAIL','ASK_DATETIME','ASK_NAME','CONFIRM'].includes(step)) {
    await sendButtons(token, senderId, `Let's complete your booking using our form! 👇`, [bookBtn(tenant.id, channel === 'messenger' ? senderId : null, tenant.custom_domain, channel)]);
    await setState('MENU', {}, {});
    return;
  }

  // Step: quantity / weight
  if (step === 'ASK_WEIGHT') {
    const w = parseFloat(text);
    if (isNaN(w) || w <= 0) {
      await sendMessage(token, senderId, 'Please enter a valid number (e.g. 5)');
      return;
    }
    const total   = (w * parseFloat(data.price_per_kg)).toFixed(2);
    const unit    = data.unit || 'per kg';
    const qtyUnit = unit.includes('kg') ? 'kg' : unit.includes('piece') ? 'pcs' : unit.includes('set') ? 'sets' : 'units';
    const newData = { ...data, weight: w, total, qty_unit: qtyUnit };

    // Determine what to ask next based on what we already have on file
    const next = nextInfoStep(customer);

    if (next === 'ASK_PHONE') {
      await sendMessage(token, senderId,
        `📱 *Mobile number*\nPlease share your Philippine mobile number (e.g. 09171234567) or WhatsApp number so we can contact you about your order.`
      );
      await setState('ASK_PHONE', {}, newData);
    } else if (next === 'ASK_ADDRESS') {
      await sendMessage(token, senderId, `📍 *Pickup address*\nWhat is the address where we should pick up your laundry?`);
      await setState('ASK_ADDRESS', {}, newData);
    } else if (next === 'ASK_EMAIL') {
      await sendMessage(token, senderId,
        `📧 *Email address*\nPlease enter your email so we can send you order updates and receipts.`
      );
      await setState('ASK_EMAIL', {}, newData);
    } else if (next === 'ASK_NAME') {
      await sendMessage(token, senderId, `👤 What is your name?`);
      await setState('ASK_NAME', {}, newData);
    } else {
      await sendMessage(token, senderId, `🗓 *Pickup schedule*\nWhat date and time for pickup?\n(e.g. April 20 10:00 AM)`);
      await setState('ASK_DATETIME', {}, newData);
    }
    return;
  }

  // Step: phone number
  if (step === 'ASK_PHONE') {
    const raw = text.trim();
    if (!isValidPHNumber(raw) && !isValidIntlNumber(raw)) {
      await sendMessage(token, senderId,
        `❌ That doesn't look like a valid number.\n\nPlease enter your Philippine mobile number (e.g. *09171234567*) or WhatsApp number with country code (e.g. *+6591234567*).`
      );
      return;
    }
    const phone = normalizePhone(raw);
    // Save immediately
    await db.query('UPDATE customers SET phone=$1 WHERE tenant_id=$2 AND fb_id=$3', [phone, tenant.id, senderId]);
    customer.phone = phone;

    // Next missing step
    if (!customer.address) {
      await sendMessage(token, senderId, `📍 *Pickup address*\nWhat is the address where we should pick up your laundry?`);
      await setState('ASK_ADDRESS', {}, data);
    } else if (!customer.email) {
      await sendMessage(token, senderId,
        `📧 *Email address*\nPlease enter your email so we can send you order updates and receipts.`
      );
      await setState('ASK_EMAIL', {}, data);
    } else if (!customer.name) {
      await sendMessage(token, senderId, `👤 What is your name?`);
      await setState('ASK_NAME', {}, data);
    } else {
      await sendMessage(token, senderId, `🗓 *Pickup schedule*\nWhat date and time for pickup?\n(e.g. April 20 10:00 AM)`);
      await setState('ASK_DATETIME', {}, data);
    }
    return;
  }

  // Step: pickup address
  if (step === 'ASK_ADDRESS') {
    if (text.trim().length < 5) {
      await sendMessage(token, senderId, `Please enter your full pickup address (street, barangay, city).`);
      return;
    }
    await db.query('UPDATE customers SET address=$1 WHERE tenant_id=$2 AND fb_id=$3', [text.trim(), tenant.id, senderId]);
    customer.address = text.trim();

    if (!customer.email) {
      await sendMessage(token, senderId,
        `📧 *Email address*\nPlease enter your email so we can send you order updates and receipts.`
      );
      await setState('ASK_EMAIL', { address: text.trim() }, data);
    } else if (!customer.name) {
      await sendMessage(token, senderId, `👤 What is your name?`);
      await setState('ASK_NAME', { address: text.trim() }, data);
    } else {
      await sendMessage(token, senderId, `🗓 *Pickup schedule*\nWhat date and time for pickup?\n(e.g. April 20 10:00 AM)`);
      await setState('ASK_DATETIME', { address: text.trim() }, data);
    }
    return;
  }

  // Step: email
  if (step === 'ASK_EMAIL') {
    const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRx.test(text.trim())) {
      await sendMessage(token, senderId, `❌ That doesn't look like a valid email.\n\nPlease enter your email address (e.g. *maria@gmail.com*).`);
      return;
    }
    await db.query('UPDATE customers SET email=$1 WHERE tenant_id=$2 AND fb_id=$3', [text.trim().toLowerCase(), tenant.id, senderId]);
    customer.email = text.trim().toLowerCase();

    if (!customer.name) {
      await sendMessage(token, senderId, `👤 What is your name?`);
      await setState('ASK_NAME', { email: customer.email }, data);
    } else {
      await sendMessage(token, senderId, `🗓 *Pickup schedule*\nWhat date and time for pickup?\n(e.g. April 20 10:00 AM)`);
      await setState('ASK_DATETIME', { email: customer.email }, data);
    }
    return;
  }

  // Step: pickup datetime
  if (step === 'ASK_DATETIME') {
    if (text.trim().length < 3) {
      await sendMessage(token, senderId, 'Please enter a pickup date and time (e.g. *April 20 10:00 AM*).');
      return;
    }
    if (!customer.name) {
      await sendMessage(token, senderId, `👤 What is your name?`);
      await setState('ASK_NAME', { pickup_date: text.trim() }, data);
    } else {
      // All info collected — go straight to confirmation
      const newData = { ...data, pickup_date: text.trim() };
      await showSummary(token, senderId, tenant.id, customer, newData);
    }
    return;
  }

  // Step: name
  if (step === 'ASK_NAME') {
    if (text.trim().length < 2) {
      await sendMessage(token, senderId, 'Please enter your full name.');
      return;
    }
    const address = data.address || customer.address;
    await db.query(
      'UPDATE customers SET name=$1, address=$2 WHERE tenant_id=$3 AND fb_id=$4',
      [text.trim(), address, tenant.id, senderId]
    );
    const newData = { ...data, name: text.trim(), address };
    if (!newData.pickup_date) {
      await sendMessage(token, senderId, `🗓 *Pickup schedule*\nWhat date and time for pickup?\n(e.g. April 20 10:00 AM)`);
      await setState('ASK_DATETIME', {}, newData);
    } else {
      await showSummary(token, senderId, tenant.id, { ...customer, name: text.trim() }, newData);
    }
    return;
  }

  // Step: confirm
  if (step === 'CONFIRM' && (text === 'CONFIRM_YES' || lc === 'confirm')) {
    const address = data.address || customer.address;
    await db.query(
      `INSERT INTO orders (id,tenant_id,customer_id,service_id,weight,price,pickup_date,address,status,source)
       VALUES ($1,$2,$3,$4,$5,$6,$7::timestamp AT TIME ZONE 'Asia/Manila',$8,$9,$10)`,
      [data.order_id, tenant.id, customer.id, data.service_id, data.weight, data.total, data.pickup_date, address, 'NEW ORDER', channel]
    );

    // Generate Xendit payment link immediately
    let paymentUrl = null;
    try {
      const { rows: [t] } = await db.query('SELECT xendit_api_key FROM tenants WHERE id=$1', [tenant.id]);
      if (t?.xendit_api_key) {
        const invoice = await createInvoice(t.xendit_api_key, {
          externalId: data.order_id,
          amount: parseFloat(data.total),
          payerEmail: customer.email || undefined,
          description: `${data.service_name || 'Laundry'} - Order ${data.order_id}`,
          successRedirectUrl: `https://m.me/${tenant.fb_page_id}`,
        });
        await db.query('UPDATE orders SET xendit_invoice_url=$1 WHERE id=$2', [invoice.invoiceUrl, data.order_id]);
        paymentUrl = invoice.invoiceUrl;
      }
    } catch (e) {
      console.warn('[messenger] xendit invoice failed:', e.message);
    }

    const confirmButtons = paymentUrl
      ? [
          { type: 'web_url', url: paymentUrl, title: '💳 Pay Now' },
          { type: 'postback', title: '📦 My Orders', payload: 'MY_ORDERS' },
          { ...bookBtn(tenant.id, null, tenant.custom_domain, channel), title: '🛒 Book Again' },
        ]
      : [
          { type: 'postback', title: '📦 My Orders', payload: 'MY_ORDERS' },
          { ...bookBtn(tenant.id, null, tenant.custom_domain, channel), title: '🛒 Book Again' },
        ];

    await sendButtons(token, senderId,
      `🎉 Booking confirmed!\n\n` +
      `🆔 Order ID: ${data.order_id}\n` +
      `🧺 ${data.service_name}\n` +
      `🗓 Pickup: ${data.pickup_date}\n` +
      `💰 Total: ₱${data.total}\n\n` +
      `Tap "Pay Now" to complete your payment. Thank you! 🙏`,
      confirmButtons
    );
    await setState('DONE', {}, {});
    await showSubscribePrompt(sends, token, senderId, customer);
    return;
  }

  if (text === 'HUMAN_REQUEST' || wantsHuman(text)) {
    await db.query(
      'UPDATE conversations SET needs_human=TRUE, needs_human_at=NOW(), needs_human_text=$3 WHERE tenant_id=$1 AND fb_user_id=$2',
      [tenant.id, senderId, event.message?.text || null]
    );
    await sendMessage(token, senderId,
      `Got it! I've notified our team and someone will reply to you shortly. 🙏\n\nIf you change your mind and want to chat with the bot again, just type "hi".`
    );
    return;
  }

  if (text === 'CONFIRM_NO' || lc === 'cancel') {
    const { rows: activeOrders } = await db.query(
      `UPDATE orders SET status='CANCELLED'
       WHERE customer_id=$1 AND paid=FALSE AND status!='CANCELLED' AND tenant_id=$2 RETURNING id`,
      [customer.id, tenant.id]
    );
    await setState('START', {}, {});
    await sendButtons(token, senderId,
      activeOrders.length > 0
        ? `Your order has been cancelled. No worries! 😊`
        : `Okay, no problem! What would you like to do?`,
      [
        bookBtn(tenant.id, channel === 'messenger' ? senderId : null, tenant.custom_domain, channel),
        { type: 'postback', title: '📋 View Services', payload: 'SERVICES' },
      ]
    );
    return;
  }

  // ── Cart "Get Updates" — resets 24h window for reminders 4-5 ────────
  if (text.startsWith('CART_SUBSCRIBE_')) {
    const cartId = text.replace('CART_SUBSCRIBE_', '');
    await db.query(
      `UPDATE carts SET window_reset_at = NOW() WHERE id = $1 AND converted = FALSE AND tenant_id = $2`,
      [cartId, tenant.id]
    );
    await sendMessage(token, senderId, `Got it! 🔔 We'll send you one more reminder so you don't miss out.`);
    return;
  }

  // ── Promo subscription ───────────────────────────────────────────────
  if (text === 'SUBSCRIBE_PROMO') {
    await db.query(
      `UPDATE customers SET promo_subscribed=TRUE WHERE tenant_id=$1 AND fb_id=$2`,
      [tenant.id, senderId]
    );
    await sendMessage(token, senderId,
      `🎉 You're subscribed! We'll send you our latest promos and updates. You can type "unsubscribe" anytime to opt out.`
    );
    return;
  }

  if (text === 'NO_SUBSCRIBE' || lc === 'unsubscribe') {
    await db.query(
      `UPDATE customers SET promo_subscribed=FALSE WHERE tenant_id=$1 AND fb_id=$2`,
      [tenant.id, senderId]
    );
    if (lc === 'unsubscribe') {
      await sendMessage(token, senderId, `✅ You've been unsubscribed from promos. You'll still receive your order updates.`);
    }
    return;
  }

  // ── Fallback — try AI first, then default menu ───────────────────────
  console.log('[ai-check] ai_enabled:', tenant.ai_enabled, '| has text:', !!event.message?.text, '| step:', step, '| text:', text);
  if (tenant.ai_enabled && event.message?.text) {
    // Skip AI if human is engaged or replied recently
    const { rows: [pauseRow] } = await db.query(
      `SELECT ai_paused_until, needs_human FROM conversations WHERE tenant_id=$1 AND fb_user_id=$2`,
      [tenant.id, senderId]
    );
    if (pauseRow?.needs_human) return; // human takeover — stay silent
    if (pauseRow?.ai_paused_until && new Date(pauseRow.ai_paused_until) > new Date()) {
      return; // human replied recently — stay silent
    }
    // Fallback human-takeover detection: message_echoes subscription is unreliable,
    // so we query the Graph API conversation thread and look for any recent page
    // message we didn't send (not in botEchoTracker._sentMids) → human replied.
    const humanReplied = await checkForHumanReply(token, senderId, tenant);
    if (humanReplied) {
      await pauseAiForCustomer(tenant, senderId);
      return;
    }
    // Check daily cap — reset counter if day has changed
    const today = new Date().toISOString().slice(0, 10);
    const { rows: [capRow] } = await db.query(
      `SELECT ai_daily_cap, ai_daily_used, ai_daily_reset FROM tenants WHERE id=$1`, [tenant.id]
    );
    const cap = capRow?.ai_daily_cap ?? 500;
    let used = capRow?.ai_daily_used ?? 0;
    const resetDate = capRow?.ai_daily_reset ? String(capRow.ai_daily_reset).slice(0, 10) : null;
    if (resetDate !== today) {
      used = 0;
      await db.query(`UPDATE tenants SET ai_daily_used=0, ai_daily_reset=$1 WHERE id=$2`, [today, tenant.id]);
    }
    if (used >= cap) {
      console.log(`[ai-cap] tenant ${tenant.id} hit daily cap (${cap}), falling back to menu`);
    } else {
      sendTyping(token, senderId, true).catch(() => {});
      const aiReply = await askGemini(tenant.id, text, senderId);
      sendTyping(token, senderId, false).catch(() => {});
      if (aiReply) {
        await db.query(`UPDATE tenants SET ai_daily_used=ai_daily_used+1 WHERE id=$1`, [tenant.id]);
        await sendMessage(token, senderId, aiReply);
        return;
      }
    }
  }

  // Don't send fallback menu if a human is engaged or replied recently
  const { rows: [fallbackPauseRow] } = await db.query(
    `SELECT ai_paused_until, needs_human FROM conversations WHERE tenant_id=$1 AND fb_user_id=$2`,
    [tenant.id, senderId]
  );
  if (fallbackPauseRow?.needs_human) return;
  if (fallbackPauseRow?.ai_paused_until && new Date(fallbackPauseRow.ai_paused_until) > new Date()) return;

  await sendButtons(token, senderId,
    `I didn't quite get that. 😊 What would you like to do?`,
    [
      bookBtn(tenant.id, channel === 'messenger' ? senderId : null, tenant.custom_domain, channel),
      { type: 'postback', title: '📦 My Orders',     payload: 'MY_ORDERS'},
      { type: 'postback', title: '❓ FAQs',          payload: 'FAQS'     },
    ]
  );
}

// ── Show order summary with confirm buttons ──────────────────────────────────
async function showSummary(token, senderId, tenantId, customer, data) {
  const orderId  = randomUUID();
  const unit     = data.unit || 'per kg';
  const qtyUnit  = data.qty_unit || (unit.includes('kg') ? 'kg' : unit.includes('piece') ? 'pcs' : 'units');
  const address  = data.address || customer.address;
  const name     = data.name || customer.name;
  const phone    = customer.phone;
  const email    = customer.email;

  // Store order ID in conversation data
  await db.query(
    'UPDATE conversations SET data=$1, step=$2, updated_at=NOW() WHERE tenant_id=$3 AND fb_user_id=$4',
    [JSON.stringify({ ...data, order_id: orderId }), 'CONFIRM', tenantId, senderId]
  );

  await sendButtons(token, senderId,
    `📋 *Order Summary*\n\n` +
    `🆔 Order ID: ${orderId}\n` +
    `🧺 Service: ${data.service_name || 'N/A'}\n` +
    `⚖️ Quantity: ${data.weight} ${qtyUnit}\n` +
    `📍 Address: ${address || 'Not set'}\n` +
    `🗓 Pickup: ${data.pickup_date || 'Not set'}\n` +
    `👤 Name: ${name || 'Not set'}\n` +
    `📱 Phone: ${phone || 'Not set'}\n` +
    `📧 Email: ${email || 'Not set'}\n` +
    `💰 Total: ₱${data.total}\n\n` +
    `Ready to confirm?`,
    [
      { type: 'postback', title: '✅ Confirm Booking', payload: 'CONFIRM_YES' },
      { type: 'postback', title: '❌ Cancel',          payload: 'CONFIRM_NO'  },
    ]
  );
}

module.exports = router;
