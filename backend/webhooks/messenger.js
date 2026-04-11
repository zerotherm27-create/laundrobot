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
  if (object !== 'page') return;
  for (const e of entry) {
    const pageId = e.id;
    const { rows: [tenant] } = await db.query(
      'SELECT * FROM tenants WHERE fb_page_id = $1 AND active = TRUE', [pageId]
    );
    if (!tenant) continue;
    for (const event of (e.messaging || [])) {
      if (event.message || event.postback) {
        await handleMessage(tenant, event.sender.id, event);
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
      'SELECT *