require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const path = require('path');
const runFollowUp    = require('./jobs/followup');
const runCartReminder = require('./jobs/cartReminder');
const app = express();

app.use(cors({ origin: '*', methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'], allowedHeaders: ['Content-Type','Authorization'] }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

const routes = [
  ['/auth',       './routes/auth'],
  ['/auth',       './routes/resetPassword'],
  ['/orders',     './routes/orders'],
  ['/services',   './routes/services'],
  ['/categories', './routes/categories'],
  ['/customers',  './routes/customers'],
  ['/tenants',    './routes/tenants'],
  ['/messaging',  './routes/messaging'],
  ['/users',      './routes/users'],
  ['/faqs',            './routes/faqs'],
  ['/delivery-zones',  './routes/deliveryZones'],
  ['/delivery-brackets', './routes/deliveryBrackets'],
  ['/blocked-dates',   './routes/blockedDates'],
  ['/promo-codes',     './routes/promoCodes'],
  ['/referrals',       './routes/referrals'],
  ['/public',          './routes/public'],
  ['/conversations',   './routes/conversations'],
  ['/faq-suggestions', './routes/faqSuggestions'],
];

for (const [path, file] of routes) {
  try {
    app.use(path, require(file));
    console.log('✓ loaded ' + path);
  } catch(e) {
    console.error('✗ FAILED ' + path + ': ' + e.message);
  }
}

try { app.use('/webhook/messenger', require('./webhooks/messenger')); console.log('✓ webhook messenger'); } catch(e) { console.error('✗ webhook messenger: ' + e.message); }
try { app.use('/webhook/xendit', require('./webhooks/xendit')); console.log('✓ webhook xendit'); } catch(e) { console.error('✗ webhook xendit: ' + e.message); }

// Serve React SPA (frontend build output in /public)
const publicDir = path.join(__dirname, '..', 'public');
app.use(express.static(publicDir));
// SPA catch-all: all non-API GET requests serve index.html
app.get(/^(?!\/auth|\/orders|\/services|\/categories|\/customers|\/tenants|\/messaging|\/users|\/faqs|\/faq-suggestions|\/delivery-zones|\/delivery-brackets|\/blocked-dates|\/promo-codes|\/public|\/webhook|\/conversations).*/, (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

app.get('/healthz', (req, res) => res.json({
  status: 'LaundroBot API running',
  env: {
    has_db: !!process.env.DATABASE_URL,
    has_jwt: !!process.env.JWT_SECRET,
    has_fb_token: !!process.env.FB_VERIFY_TOKEN,
  }
}));

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', async () => {
  console.log('Server running on port ' + PORT);

  // Auto-setup Messenger profile (Get Started, greeting, persistent menu) for all active tenants
  try {
    const db = require('./db');
    const { setupMessengerProfile } = require('./utils/messengerProfile');
    const { rows: tenants } = await db.query(`SELECT id, name, fb_page_access_token, ig_user_id FROM tenants WHERE active=TRUE`);
    for (const t of tenants) {
      try {
        await setupMessengerProfile(t.fb_page_access_token, t.name, t.id, process.env.APP_URL, t.ig_user_id);
      } catch (e) {
        console.warn(`[startup] messenger profile failed for ${t.name}:`, e.response?.data?.error?.message || e.message);
      }
    }
  } catch (e) {
    console.warn('[startup] messenger profile setup skipped:', e.message);
  }

  // Run follow-up job every 30 minutes for timely reminders
  cron.schedule('*/30 * * * *', () => {
    runFollowUp().catch(err => console.error('[follow-up] unhandled error:', err.message));
  });
  console.log('✓ follow-up cron scheduled (every 30 min)');

  // Cart abandonment reminder — runs every hour
  cron.schedule('0 * * * *', () => {
    runCartReminder().catch(err => console.error('[cart-reminder] unhandled error:', err.message));
  });
  console.log('✓ cart reminder cron scheduled (every hour)');

  // Archive completed orders monthly — runs at midnight on the 1st of each month
  cron.schedule('0 0 1 * *', async () => {
    try {
      const db = require('./db');
      const now = new Date();
      const prevMonth = now.getMonth() === 0 ? 12 : now.getMonth();
      const prevYear  = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
      const { rows: tenants } = await db.query(`SELECT id FROM tenants WHERE active=TRUE`);
      let total = 0;
      for (const t of tenants) {
        const { rowCount } = await db.query(
          `UPDATE orders SET archived=TRUE, archived_at=NOW()
           WHERE tenant_id=$1 AND status='COMPLETED' AND archived=FALSE
             AND date_part('year', created_at)=$2 AND date_part('month', created_at)=$3`,
          [t.id, prevYear, prevMonth]
        );
        total += rowCount;
      }
      console.log(`[archive] Archived ${total} completed orders from ${prevYear}-${String(prevMonth).padStart(2,'0')}`);
    } catch (err) {
      console.error('[archive] monthly cron failed:', err.message);
    }
  });
  console.log('✓ monthly archive cron scheduled (1st of each month)');
});