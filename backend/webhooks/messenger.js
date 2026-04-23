const router = require('express').Router();
const axios = require('axios');
const db = require('../db');
const messengerUtils = require('../utils/messenger');
const { sendMessage, sendTaggedMessage, sendButtons, sendQuickReplies, sendCatalog, sendTyping } = messengerUtils;
const igUtils = require('../utils/instagram');
const { createInvoice } = require('../utils/xendit');
const { askGemini } = require('../utils/gemini');

function makeSends(channel, token, igUserId) {
  if (channel === 'instagram') {
    return {
      sendMessage:      (t, r, text)         => igUtils.sendMessage(t, igUserId, r, text),
      sendButtons:      (t, r, text, btns)   => igUtils.sendButtons(t, igUserId, r, text, btns),
      sendQuickReplies: (t, r, text, replies) => igUtils.sendQuickReplies(t, igUserId, r, text, replies),
      sendCatalog:      (t, r, els)          => igUtils.sendCatalog(t, igUserId, r, els),
      sendTaggedMessage:(t, r, text)         => igUtils.sendMessage(t, igUserId, r, text),
    };
  }
  return { sendMessage, sendTaggedMessage, sendButtons, sendQuickReplies, sendCatalog };
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
  res.sendStatus(200);
  const { object, entry } = req.body;
  console.log('[webhook] received object:', object, 'entries:', entry?.length);

  // ── Instagram ──
  if (object === 'instagram') {
    for (const e of entry) {
      const igId = e.id;
      const { rows: [tenant] } = await db.query(
        'SELECT * FROM tenants WHERE ig_user_id = $1 AND active = TRUE', [igId]
      );
      if (!tenant) { console.log('[ig-webhook] no tenant for ig_user_id:', igId); continue; }
      for (const event of (e.messaging || [])) {
        // Admin replied from Instagram — sender is the IG business account
        if (event.message && event.sender.id === String(tenant.ig_user_id)) {
          try { await pauseAiForCustomer(tenant, event.recipient.id); }
          catch (err) { console.error('[ig-webhook] echo-pause error:', err.message); }
        } else if (event.message || event.postback) {
          console.log('[ig-webhook] msg from:', event.sender.id);
          try { await handleMessage(tenant, event.sender.id, event, 'instagram'); }
          catch (err) { console.error('[ig-webhook] error:', err.response?.data || err.message); }
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
    for (const event of (e.messaging || [])) {
      if (event.optin) {
        try { await handleOptin(tenant, event.sender.id, event.optin.ref); }
        catch (err) { console.error('[webhook] optin error:', err.message); }
      } else if (event.referral) {
        try { await handleOptin(tenant, event.sender.id, event.referral.ref); }
        catch (err) { console.error('[webhook] referral error:', err.message); }
      } else if (event.message?.is_echo) {
        // Admin replied from Facebook Page Inbox — pause AI for this customer
        try { await pauseAiForCustomer(tenant, event.recipient.id); }
        catch (err) { console.error('[webhook] echo-pause error:', err.message); }
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
  let { rows: [customer] } = await db.query(
    'SELECT * FROM customers WHERE tenant_id=$1 AND fb_id=$2', [tenantId, senderId]
  );
  if (!customer) {
    const firstName = token ? await getFBFirstName(token, senderId) : null;
    const { rows: [c] } = await db.query(
      'INSERT INTO customers (tenant_id, fb_id, name) VALUES ($1,$2,$3) RETURNING *',
      [tenantId, senderId, firstName]
    );
    customer = c;
  } else if (!customer.name && token) {
    const firstName = await getFBFirstName(token, senderId);
    if (firstName) {
      await db.query('UPDATE customers SET name=$1 WHERE id=$2', [firstName, customer.id]);
      customer.name = firstName;
    }
  }
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
async function showCategoryMenu(sends, token, senderId, tenantId) {
  const { rows: cats } = await db.query(
    `SELECT * FROM service_categories WHERE tenant_id=$1 AND active=TRUE ORDER BY sort_order ASC`,
    [tenantId]
  );

  if (cats.length === 0) return showServiceCatalog(sends, token, senderId, tenantId, null);
  if (cats.length === 1) return showServiceCatalog(sends, token, senderId, tenantId, cats[0].id);

  const replies = cats.map(c => ({ title: c.name, payload: `CAT:${c.id}:${c.name}` }));
  replies.push({ title: '🛍 All Services', payload: 'CAT:ALL:All Services' });
  await sends.sendQuickReplies(token, senderId, '🧺 What type of laundry service are you looking for?', replies);
}

async function showServiceCatalog(sends, token, senderId, tenantId, categoryId) {
  let query, params;
  if (!categoryId || categoryId === 'ALL') {
    query = `SELECT s.*, c.name AS category_name FROM services s
             LEFT JOIN service_categories c ON c.id = s.category_id
             WHERE s.tenant_id=$1 AND s.active=TRUE
             ORDER BY c.sort_order ASC NULLS LAST, s.sort_order ASC, s.name ASC`;
    params = [tenantId];
  } else {
    query = `SELECT s.*, c.name AS category_name FROM services s
             LEFT JOIN service_categories c ON c.id = s.category_id
             WHERE s.tenant_id=$1 AND s.category_id=$2 AND s.active=TRUE
             ORDER BY s.sort_order ASC, s.name ASC`;
    params = [tenantId, categoryId];
  }

  const { rows: services } = await db.query(query, params);
  if (services.length === 0) {
    await sends.sendMessage(token, senderId, 'No services available in this category yet. Type "hi" to go back.');
    return;
  }

  const elements = services.map(s => ({
    title: s.name,
    subtitle: `₱${Number(s.price).toLocaleString()} ${s.unit}` + (s.description ? `\n${s.description}` : ''),
    imageUrl: (s.image_url && !s.image_url.startsWith('data:')) ? s.image_url : null,
    buttons: [{ title: '🛒 Book This', payload: `SVC:${s.id}:${s.name}:${s.price}:${s.unit}` }],
  }));

  const catName = services[0]?.category_name;
  const intro = catName && categoryId !== 'ALL'
    ? `Here are our ${catName} services 👇 Tap "Book This" to order:`
    : `Here are all our services 👇 Tap "Book This" to order:`;

  await sends.sendMessage(token, senderId, intro);
  await sends.sendCatalog(token, senderId, elements);
}

// ── Send to Messenger optin handler ─────────────────────────────────────────
async function handleOptin(tenant, senderId, ref) {
  const token = tenant.fb_page_access_token;
  if (!token) return;
  const sends = makeSends('messenger', token, null);

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
    `🎁 Want to also receive exclusive promos and updates from us? Tap Subscribe!`,
    [
      { type: 'postback', title: '✅ Subscribe', payload: 'SUBSCRIBE_PROMO' },
      { type: 'postback', title: 'No thanks',   payload: 'NO_SUBSCRIBE'    },
    ]
  );
}

// ── Subscribe prompt (shown after natural interactions) ──────────────────────
async function showSubscribePrompt(sends, token, senderId, customer) {
  if (customer?.promo_subscribed) return;
  await sends.sendButtons(token, senderId,
    `🎁 Want to receive our latest promos and updates? Subscribe to stay in the loop!`,
    [
      { type: 'postback', title: '✅ Subscribe', payload: 'SUBSCRIBE_PROMO' },
      { type: 'postback', title: 'No thanks',   payload: 'NO_SUBSCRIBE'    },
    ]
  );
}

// ── Pause AI for a customer (called on admin echo) ───────────────────────────
async function pauseAiForCustomer(tenant, customerId) {
  const pauseHours = tenant.ai_pause_hours || 2;
  if (!pauseHours) return; // 0 = disabled
  const pauseUntil = new Date(Date.now() + pauseHours * 60 * 60 * 1000).toISOString();
  await db.query(
    `INSERT INTO conversations (tenant_id, fb_user_id, step, data, updated_at)
     VALUES ($1, $2, 'AI', jsonb_build_object('ai_paused_until', $3), NOW())
     ON CONFLICT (tenant_id, fb_user_id)
     DO UPDATE SET data = conversations.data || jsonb_build_object('ai_paused_until', $3::text), updated_at=NOW()`,
    [tenant.id, customerId, pauseUntil]
  );
  console.log(`[ai-pause] paused for ${customerId} until ${pauseUntil}`);
}

// ── Main message handler ────────────────────────────────────────────────────
async function handleMessage(tenant, senderId, event, channel = 'messenger') {
  const token    = tenant.fb_page_access_token;
  const sends    = makeSends(channel, token, tenant.ig_user_id);
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
      // Fall through to normal START handling below
    } else {
      // Still waiting for human — stay silent
      return;
    }
  }

  // ── Human request ────────────────────────────────────────────────────
  if (wantsHuman(text) && !event.postback) {
    await db.query(
      'UPDATE conversations SET needs_human=TRUE, needs_human_at=NOW() WHERE tenant_id=$1 AND fb_user_id=$2',
      [tenant.id, senderId]
    );
    await sendMessage(token, senderId,
      `Got it! I've notified our team and someone will reply to you shortly. 🙏\n\nIf you change your mind and want to chat with the bot again, just type "hi".`
    );
    return;
  }

  // ── Global commands ──────────────────────────────────────────────────
  if (lc === 'hi' || lc === 'hello' || lc === 'start' || text === 'GET_STARTED') {
    const appUrl = process.env.APP_URL;
    const bookButton = appUrl
      ? { type: 'web_url', title: '🛒 Book Now', url: `${appUrl}/book/${tenant.id}`, webview_height_ratio: 'full', messenger_extensions: true }
      : { type: 'postback', title: '🛒 Book Now', payload: 'BOOK' };
    const greeting = customer.name ? `👋 Hi, ${customer.name.split(' ')[0]}! Welcome to ${tenant.name}!` : `👋 Hi! Welcome to ${tenant.name}!`;
    await sendButtons(token, senderId,
      `${greeting}\n\nWhat would you like to do?`,
      [
        bookButton,
        { type: 'postback', title: '📦 My Orders', payload: 'MY_ORDERS' },
        { type: 'postback', title: '❓ FAQs',       payload: 'FAQS'      },
      ]
    );
    await setState('MENU', {}, {});
    return;
  }

  if (lc === 'book' || text === 'BOOK' || lc === 'menu') {
    const appUrl = process.env.APP_URL;
    if (appUrl) {
      await sendButtons(token, senderId,
        `📱 Tap below to open our booking form — it opens right here inside Messenger!`,
        [{
          type: 'web_url',
          title: '🧺 Open Booking Form',
          url: `${appUrl}/book/${tenant.id}`,
          webview_height_ratio: 'full',
          messenger_extensions: true,
        }]
      );
      await setState('MENU', {}, {});
    } else {
      await setState('SELECT_CATEGORY', {}, {});
      await showCategoryMenu(sends, token, senderId, tenant.id);
    }
    return;
  }

  if (lc === 'services' || text === 'SERVICES') {
    await setState('SELECT_CATEGORY', {}, {});
    await showCategoryMenu(sends, token, senderId, tenant.id);
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
        { type: 'postback', title: '🛒 Book Now',      payload: 'BOOK'     },
        { type: 'postback', title: '📋 View Services', payload: 'SERVICES' },
        { type: 'postback', title: '❓ FAQs',          payload: 'FAQS'     },
      ]
    );
    await setState('MENU', {}, {});
    return;
  }

  if (text === 'MY_ORDERS') {
    const { rows: orders } = await db.query(
      `SELECT o.id, o.status, o.price, o.created_at, s.name as service_name
       FROM orders o LEFT JOIN services s ON s.id=o.service_id
       WHERE o.customer_id=$1 ORDER BY o.created_at DESC LIMIT 5`,
      [customer.id]
    );
    if (!orders.length) {
      await sendMessage(token, senderId, "You don't have any orders yet. Type \"book\" to get started!");
    } else {
      const list = orders.map(o =>
        `📦 ${o.id}\n   ${o.service_name || 'Service'} — ₱${Number(o.price).toLocaleString()}\n   Status: ${o.status}`
      ).join('\n\n');
      await sendMessage(token, senderId, `Your recent orders:\n\n${list}\n\nType "book" to place a new order.`);
    }
    await showSubscribePrompt(sends, token, senderId, customer);
    return;
  }

  // ── Category selected ────────────────────────────────────────────────
  if (text.startsWith('CAT:')) {
    const parts = text.split(':');
    const catId = parts[1];
    await setState('SELECT_SERVICE', {}, {});
    await showServiceCatalog(sends, token, senderId, tenant.id, catId === 'ALL' ? null : catId);
    return;
  }

  // ── Service selected ─────────────────────────────────────────────────
  if (text.startsWith('SVC:')) {
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

  // ── Booking flow ─────────────────────────────────────────────────────

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
      `INSERT INTO orders (id,tenant_id,customer_id,service_id,weight,price,pickup_date,address,status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [data.order_id, tenant.id, customer.id, data.service_id, data.weight, data.total, data.pickup_date, address, 'NEW ORDER']
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
          { type: 'postback', title: '🛒 Book Again', payload: 'BOOK' },
        ]
      : [
          { type: 'postback', title: '📦 My Orders', payload: 'MY_ORDERS' },
          { type: 'postback', title: '🛒 Book Again', payload: 'BOOK' },
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
      'UPDATE conversations SET needs_human=TRUE, needs_human_at=NOW() WHERE tenant_id=$1 AND fb_user_id=$2',
      [tenant.id, senderId]
    );
    await sendMessage(token, senderId,
      `Got it! I've notified our team and someone will reply to you shortly. 🙏\n\nIf you change your mind and want to chat with the bot again, just type "hi".`
    );
    return;
  }

  if (text === 'CONFIRM_NO' || lc === 'cancel') {
    const { rows: activeOrders } = await db.query(
      `UPDATE orders SET status='CANCELLED'
       WHERE customer_id=$1 AND paid=FALSE AND status!='CANCELLED' RETURNING id`,
      [customer.id]
    );
    await setState('START', {}, {});
    await sendButtons(token, senderId,
      activeOrders.length > 0
        ? `Your order has been cancelled. No worries! 😊`
        : `Okay, no problem! What would you like to do?`,
      [
        { type: 'postback', title: '🛒 Book Now',      payload: 'BOOK' },
        { type: 'postback', title: '📋 View Services', payload: 'SERVICES' },
      ]
    );
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
    // Skip AI if human replied recently (pause window active)
    const { rows: [conv] } = await db.query(
      `SELECT data FROM conversations WHERE tenant_id=$1 AND fb_user_id=$2`,
      [tenant.id, senderId]
    );
    const pausedUntil = conv?.data?.ai_paused_until;
    if (pausedUntil && new Date(pausedUntil) > new Date()) {
      return; // human takeover active — stay silent
    }
    sendTyping(token, senderId, true).catch(() => {});
    const aiReply = await askGemini(tenant.id, text, senderId);
    sendTyping(token, senderId, false).catch(() => {});
    if (aiReply) {
      await sendMessage(token, senderId, aiReply);
      return;
    }
  }

  await sendButtons(token, senderId,
    `I didn't quite get that. 😊 What would you like to do?`,
    [
      { type: 'postback', title: '🛒 Book Now',      payload: 'BOOK'     },
      { type: 'postback', title: '📦 My Orders',     payload: 'MY_ORDERS'},
      { type: 'postback', title: '❓ FAQs',          payload: 'FAQS'     },
    ]
  );
}

// ── Show order summary with confirm buttons ──────────────────────────────────
async function showSummary(token, senderId, tenantId, customer, data) {
  const orderId  = 'ORD-' + Date.now().toString().slice(-6);
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
