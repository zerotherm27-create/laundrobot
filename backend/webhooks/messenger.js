const router = require('express').Router();
const db = require('../db');
const { sendMessage, sendTaggedMessage, sendButtons, sendQuickReplies, sendCatalog } = require('../utils/messenger');

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
  if (object !== 'page') return;
  for (const e of entry) {
    const pageId = e.id;
    const { rows: [tenant] } = await db.query(
      'SELECT * FROM tenants WHERE fb_page_id = $1 AND active = TRUE', [pageId]
    );
    if (!tenant) { console.log('[webhook] no tenant for page:', pageId); continue; }
    for (const event of (e.messaging || [])) {
      if (event.message || event.postback) {
        console.log('[webhook] msg from:', event.sender.id);
        try { await handleMessage(tenant, event.sender.id, event); }
        catch (err) { console.error('[webhook] error:', err.response?.data || err.message); }
      }
    }
  }
});

// ── Helpers ─────────────────────────────────────────────────────────────────
async function getOrCreateCustomer(tenantId, senderId) {
  let { rows: [customer] } = await db.query(
    'SELECT * FROM customers WHERE tenant_id=$1 AND fb_id=$2', [tenantId, senderId]
  );
  if (!customer) {
    const { rows: [c] } = await db.query(
      'INSERT INTO customers (tenant_id, fb_id) VALUES ($1,$2) RETURNING *', [tenantId, senderId]
    );
    customer = c;
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
    conv = { step: 'START', data: {} };
  }
  return conv;
}

function makeSetState(tenantId, senderId) {
  return async (newStep, newData, existingData) => {
    await db.query(
      'UPDATE conversations SET step=$1, data=$2, updated_at=NOW() WHERE tenant_id=$3 AND fb_user_id=$4',
      [newStep, JSON.stringify({ ...(existingData || {}), ...(newData || {}) }), tenantId, senderId]
    );
  };
}

// Show category quick-reply menu, or jump straight to catalog if only one/no categories
async function showCategoryMenu(token, senderId, tenantId) {
  const { rows: cats } = await db.query(
    `SELECT * FROM service_categories WHERE tenant_id=$1 AND active=TRUE ORDER BY sort_order ASC`,
    [tenantId]
  );

  if (cats.length === 0) {
    // No categories — show all services as catalog directly
    return await showServiceCatalog(token, senderId, tenantId, null);
  }

  if (cats.length === 1) {
    // Only one category — skip the menu, show services directly
    return await showServiceCatalog(token, senderId, tenantId, cats[0].id);
  }

  const replies = cats.map(c => ({
    title: c.name,
    payload: `CAT:${c.id}:${c.name}`,
  }));
  // Add "All Services" option
  replies.push({ title: '🛍 All Services', payload: 'CAT:ALL:All Services' });

  await sendQuickReplies(token, senderId, '🧺 What type of laundry service are you looking for?', replies);
}

// Show services as a product catalog (Generic Template carousel)
async function showServiceCatalog(token, senderId, tenantId, categoryId) {
  let query, params;
  if (!categoryId || categoryId === 'ALL') {
    query = `SELECT s.*, c.name AS category_name
             FROM services s
             LEFT JOIN service_categories c ON c.id = s.category_id
             WHERE s.tenant_id=$1 AND s.active=TRUE
             ORDER BY c.sort_order ASC NULLS LAST, s.sort_order ASC, s.name ASC`;
    params = [tenantId];
  } else {
    query = `SELECT s.*, c.name AS category_name
             FROM services s
             LEFT JOIN service_categories c ON c.id = s.category_id
             WHERE s.tenant_id=$1 AND s.category_id=$2 AND s.active=TRUE
             ORDER BY s.sort_order ASC, s.name ASC`;
    params = [tenantId, categoryId];
  }

  const { rows: services } = await db.query(query, params);

  if (services.length === 0) {
    await sendMessage(token, senderId, 'No services available in this category yet. Type "hi" to go back.');
    return;
  }

  const elements = services.map(s => ({
    title: s.name,
    subtitle: `₱${Number(s.price).toLocaleString()} ${s.unit}` + (s.description ? `\n${s.description}` : ''),
    imageUrl: s.image_url || null,
    buttons: [
      { title: '🛒 Book This', payload: `SVC:${s.id}:${s.name}:${s.price}:${s.unit}` },
    ],
  }));

  const catName = services[0]?.category_name;
  const intro = catName && categoryId !== 'ALL'
    ? `Here are our ${catName} services 👇 Tap "Book This" to order:`
    : `Here are all our services 👇 Tap "Book This" to order:`;

  await sendMessage(token, senderId, intro);
  await sendCatalog(token, senderId, elements);
}

// ── Main message handler ────────────────────────────────────────────────────
async function handleMessage(tenant, senderId, event) {
  const token  = tenant.fb_page_access_token;
  const text   = event.message?.text || event.postback?.payload || '';
  const lc     = text.toLowerCase().trim();
  const conv   = await getConv(tenant.id, senderId);
  const step   = conv.step;
  const data   = conv.data || {};
  const setState = makeSetState(tenant.id, senderId);
  const customer = await getOrCreateCustomer(tenant.id, senderId);

  // ── Global commands (work from any step) ─────────────────────────────
  if (lc === 'hi' || lc === 'hello' || lc === 'start' || text === 'GET_STARTED' || step === 'START') {
    await sendButtons(token, senderId,
      `👋 Hi! Welcome to ${tenant.name}!\n\nWhat would you like to do?`,
      [
        { type: 'postback', title: '🛒 Book Now',      payload: 'BOOK'     },
        { type: 'postback', title: '📋 View Services', payload: 'SERVICES' },
        { type: 'postback', title: '❓ FAQs',          payload: 'FAQS'     },
      ]
    );
    await setState('MENU', {}, {});
    return;
  }

  if (lc === 'book' || text === 'BOOK' || lc === 'menu') {
    await setState('SELECT_CATEGORY', {}, {});
    await showCategoryMenu(token, senderId, tenant.id);
    return;
  }

  if (lc === 'services' || text === 'SERVICES') {
    await setState('SELECT_CATEGORY', {}, {});
    await showCategoryMenu(token, senderId, tenant.id);
    return;
  }

  // ── FAQs ────────────────────────────────────────────────────────────
  if (text === 'FAQS' || lc === 'faq' || lc === 'faqs') {
    const { rows: faqs } = await db.query(
      `SELECT * FROM faqs WHERE tenant_id=$1 AND active=TRUE ORDER BY sort_order ASC, id ASC LIMIT 11`,
      [tenant.id]
    );
    if (!faqs.length) {
      await sendMessage(token, senderId, "We don't have any FAQs set up yet. Type \"hi\" to go back to the menu.");
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
      `SELECT * FROM faqs WHERE id=$1 AND tenant_id=$2 AND active=TRUE`,
      [faqId, tenant.id]
    );
    if (!faq) {
      await sendMessage(token, senderId, 'FAQ not found. Type "hi" to go back.');
      return;
    }
    await sendMessage(token, senderId, `❓ *${faq.question}*\n\n${faq.answer}`);
    // Show quick reply to go back to FAQ list or main menu
    await sendQuickReplies(token, senderId, 'Was that helpful?', [
      { title: '❓ More FAQs', payload: 'FAQS' },
      { title: '🏠 Main Menu', payload: 'MAIN_MENU' },
    ]);
    return;
  }

  if (text === 'MAIN_MENU') {
    await sendButtons(token, senderId,
      `What would you like to do?`,
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
    return;
  }

  // ── Category selected from quick reply ───────────────────────────────
  if (text.startsWith('CAT:')) {
    const parts   = text.split(':');
    const catId   = parts[1];
    const catName = parts.slice(2).join(':');
    await setState('SELECT_SERVICE', {}, {});
    await showServiceCatalog(token, senderId, tenant.id, catId === 'ALL' ? null : catId);
    return;
  }

  // ── Service selected from catalog ────────────────────────────────────
  if (text.startsWith('SVC:')) {
    const parts   = text.split(':');
    const svcId   = parts[1];
    const svcName = parts[2];
    const price   = parts[3];
    const unit    = parts[4] || 'per kg';

    const qtyLabel = unit.includes('kg') ? 'How many kg?' :
                     unit.includes('piece') ? 'How many pieces?' :
                     unit.includes('set') ? 'How many sets?' : 'Quantity?';

    await sendMessage(token, senderId,
      `✅ Great choice! You selected:\n\n🧺 *${svcName}*\n💰 ₱${Number(price).toLocaleString()} ${unit}\n\n${qtyLabel} (e.g. 5)`
    );
    await setState('ASK_WEIGHT', { service_id: svcId, service_name: svcName, price_per_kg: price, unit }, {});
    return;
  }

  // ── Booking flow steps ───────────────────────────────────────────────
  if (step === 'ASK_WEIGHT') {
    const w = parseFloat(text);
    if (isNaN(w) || w <= 0) {
      await sendMessage(token, senderId, 'Please enter a valid number (e.g. 5)');
      return;
    }
    const total = (w * parseFloat(data.price_per_kg)).toFixed(2);
    const unit  = data.unit || 'per kg';
    const qtyUnit = unit.includes('kg') ? 'kg' : unit.includes('piece') ? 'pcs' : unit.includes('set') ? 'sets' : 'units';
    await sendMessage(token, senderId,
      `${w} ${qtyUnit} × ₱${data.price_per_kg} = *₱${total}*\n\n📍 What is your pickup address?`
    );
    await setState('ASK_ADDRESS', { weight: w, total }, data);
    return;
  }

  if (step === 'ASK_ADDRESS') {
    await sendMessage(token, senderId,
      `📍 Pickup address saved!\n\n🗓 What date and time for pickup?\n(e.g. April 20 10:00 AM)`
    );
    await setState('ASK_DATETIME', { address: text }, data);
    return;
  }

  if (step === 'ASK_DATETIME') {
    await sendMessage(token, senderId, '👤 What is your name?');
    await setState('ASK_NAME', { pickup_date: text }, data);
    return;
  }

  if (step === 'ASK_NAME') {
    await db.query(
      'UPDATE customers SET name=$1, address=$2 WHERE tenant_id=$3 AND fb_id=$4',
      [text, data.address, tenant.id, senderId]
    );
    const orderId = 'ORD-' + Date.now().toString().slice(-6);
    const unit = data.unit || 'per kg';
    const qtyUnit = unit.includes('kg') ? 'kg' : unit.includes('piece') ? 'pcs' : unit.includes('set') ? 'sets' : 'units';

    await sendButtons(token, senderId,
      `📋 Order Summary\n\n` +
      `🆔 Order ID: ${orderId}\n` +
      `🧺 Service: ${data.service_name}\n` +
      `⚖️ Quantity: ${data.weight} ${qtyUnit}\n` +
      `📍 Address: ${data.address}\n` +
      `🗓 Pickup: ${data.pickup_date}\n` +
      `💰 Total: ₱${data.total}\n\n` +
      `Ready to confirm?`,
      [
        { type: 'postback', title: '✅ Confirm Booking', payload: 'CONFIRM_YES' },
        { type: 'postback', title: '❌ Cancel',          payload: 'CONFIRM_NO'  },
      ]
    );
    await setState('CONFIRM', { name: text, order_id: orderId }, data);
    return;
  }

  if (step === 'CONFIRM' && (text === 'CONFIRM_YES' || lc === 'confirm')) {
    await db.query(
      `INSERT INTO orders (id,tenant_id,customer_id,service_id,weight,price,pickup_date,address,status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [data.order_id, tenant.id, customer.id, data.service_id, data.weight, data.total, data.pickup_date, data.address, 'NEW ORDER']
    );
    await sendButtons(token, senderId,
      `🎉 Booking confirmed!\n\n` +
      `🆔 Order ID: ${data.order_id}\n` +
      `🗓 We'll pick up on: ${data.pickup_date}\n\n` +
      `We'll send you updates as your order progresses. Thank you! 🙏`,
      [
        { type: 'postback', title: '📦 My Orders', payload: 'MY_ORDERS' },
        { type: 'postback', title: '🛒 Book Again', payload: 'BOOK'      },
      ]
    );
    await setState('DONE', {}, {});
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

  // ── Fallback ─────────────────────────────────────────────────────────
  await sendButtons(token, senderId,
    `I didn't quite get that. 😊 What would you like to do?`,
    [
      { type: 'postback', title: '🛒 Book Now',      payload: 'BOOK'     },
      { type: 'postback', title: '📦 My Orders',     payload: 'MY_ORDERS'},
      { type: 'postback', title: '❓ FAQs',          payload: 'FAQS'     },
    ]
  );
}

module.exports = router;
