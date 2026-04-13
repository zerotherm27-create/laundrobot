const router = require('express').Router();
const db = require('../db');
const { sendMessage, sendButtons } = require('../utils/messenger');
const { createInvoice } = require('../utils/xendit');

router.get('/', (req, res) => {
  if (req.query['hub.verify_token'] === process.env.FB_VERIFY_TOKEN) {
    return res.send(req.query['hub.challenge']);
  }
  res.sendStatus(403);
});

router.post('/', async (req, res) => {
  res.sendStatus(200);
  const { object, entry } = req.body;
  console.log('[webhook] received object:', object, 'entries:', entry?.length);
  if (object !== 'page') return;
  for (const e of entry) {
    const pageId = e.id;
    console.log('[webhook] page id:', pageId);
    const { rows: [tenant] } = await db.query(
      'SELECT * FROM tenants WHERE fb_page_id = $1 AND active = TRUE', [pageId]
    );
    if (!tenant) {
      console.log('[webhook] no tenant found for page id:', pageId);
      continue;
    }
    for (const event of (e.messaging || [])) {
      if (event.message || event.postback) {
        console.log('[webhook] handling message from:', event.sender.id);
        try {
          await handleMessage(tenant, event.sender.id, event);
        } catch (err) {
          console.error('[webhook] handleMessage error:', err.response?.data || err.message);
        }
      }
    }
  }
});

async function handleMessage(tenant, senderId, event) {
  const token = tenant.fb_page_access_token;
  const text = event.message?.text || event.postback?.payload || '';
  let { rows: [conv] } = await db.query(
    'SELECT * FROM conversations WHERE tenant_id=$1 AND fb_user_id=$2',
    [tenant.id, senderId]
  );
  if (!conv) {
    await db.query(
      'INSERT INTO conversations (tenant_id, fb_user_id, step, data) VALUES ($1,$2,$3,$4)',
      [tenant.id, senderId, 'START', '{}']
    );
    conv = { step: 'START', data: {} };
  }
  const step = conv.step;
  const data = conv.data || {};
  async function setState(newStep, newData) {
    await db.query(
      'UPDATE conversations SET step=$1, data=$2, updated_at=NOW() WHERE tenant_id=$3 AND fb_user_id=$4',
      [newStep, JSON.stringify({ ...data, ...(newData || {}) }), tenant.id, senderId]
    );
  }
  let { rows: [customer] } = await db.query(
    'SELECT * FROM customers WHERE tenant_id=$1 AND fb_id=$2', [tenant.id, senderId]
  );
  if (!customer) {
    const { rows: [c] } = await db.query(
      'INSERT INTO customers (tenant_id, fb_id) VALUES ($1,$2) RETURNING *', [tenant.id, senderId]
    );
    customer = c;
  }
  const lc = text.toLowerCase();
  if (step === 'START' || lc === 'hi' || lc === 'hello') {
    await sendMessage(token, senderId, 'Hi! Welcome to ' + tenant.name + '! Type "book" to start or "services" to see prices.');
    await setState('MENU');
  } else if (lc === 'book' || step === 'MENU') {
    const { rows: services } = await db.query(
      'SELECT * FROM services WHERE tenant_id=$1 AND active=TRUE ORDER BY name', [tenant.id]
    );
    const buttons = services.slice(0, 3).map(s => ({
      type: 'postback', title: s.name + ' P' + s.price, payload: 'SVC:' + s.id + ':' + s.name + ':' + s.price
    }));
    await sendButtons(token, senderId, 'Choose a service:', buttons);
    await setState('SELECT_SERVICE');
  } else if (text.startsWith('SVC:')) {
    const parts = text.split(':');
    await sendMessage(token, senderId, 'You selected ' + parts[2] + '. How many kg? (e.g. 3)');
    await setState('ASK_WEIGHT', { service_id: parts[1], service_name: parts[2], price_per_kg: parts[3] });
  } else if (step === 'ASK_WEIGHT') {
    const w = parseFloat(text);
    if (isNaN(w)) { await sendMessage(token, senderId, 'Please enter a number.'); return; }
    const total = (w * parseFloat(data.price_per_kg)).toFixed(2);
    await sendMessage(token, senderId, w + 'kg x P' + data.price_per_kg + ' = P' + total + '\n\nWhat is your pickup address?');
    await setState('ASK_ADDRESS', { weight: w, total });
  } else if (step === 'ASK_ADDRESS') {
    await sendMessage(token, senderId, 'Got it! What date and time for pickup? (e.g. April 15 10:00 AM)');
    await setState('ASK_DATETIME', { address: text });
  } else if (step === 'ASK_DATETIME') {
    await sendMessage(token, senderId, 'What is your name?');
    await setState('ASK_NAME', { pickup_date: text });
  } else if (step === 'ASK_NAME') {
    await db.query('UPDATE customers SET name=$1, address=$2 WHERE tenant_id=$3 AND fb_id=$4',
      [text, data.address, tenant.id, senderId]);
    const orderId = 'ORD-' + Date.now().toString().slice(-6);
    await sendMessage(token, senderId,
      'Order Summary:\nID: ' + orderId + '\nService: ' + data.service_name +
      '\nWeight: ' + data.weight + 'kg\nAddress: ' + data.address +
      '\nPickup: ' + data.pickup_date + '\nTotal: P' + data.total +
      '\n\nType "confirm" to book or "cancel" to restart.');
    await setState('CONFIRM', { name: text, order_id: orderId });
  } else if (step === 'CONFIRM' && lc === 'confirm') {
    await db.query(
      'INSERT INTO orders (id,tenant_id,customer_id,service_id,weight,price,pickup_date,address,status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)',
      [data.order_id, tenant.id, customer.id, data.service_id, data.weight, data.total, data.pickup_date, data.address, 'NEW ORDER']
    );
    await sendMessage(token, senderId, 'Booking confirmed! Order ID: ' + data.order_id + '. We will pick up on ' + data.pickup_date + '.');
    await setState('DONE');
  } else if (lc === 'cancel') {
    await setState('START');
    await sendMessage(token, senderId, 'Cancelled. Type "hi" to start again.');
  } else if (lc === 'services') {
    const { rows: services } = await db.query(
      'SELECT * FROM services WHERE tenant_id=$1 AND active=TRUE', [tenant.id]
    );
    const list = services.map(s => s.name + ': P' + s.price + ' ' + s.unit).join('\n');
    await sendMessage(token, senderId, 'Our services:\n' + list + '\n\nType "book" to order.');
  } else {
    await sendMessage(token, senderId, 'Type "hi" to book or "services" to see prices.');
  }
}

module.exports = router;