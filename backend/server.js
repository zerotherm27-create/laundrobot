require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const runFollowUp = require('./jobs/followup');
const app = express();

app.use(cors({ origin: '*', methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'], allowedHeaders: ['Content-Type','Authorization'] }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

const routes = [
  ['/auth',       './routes/auth'],
  ['/orders',     './routes/orders'],
  ['/services',   './routes/services'],
  ['/categories', './routes/categories'],
  ['/customers',  './routes/customers'],
  ['/tenants',    './routes/tenants'],
  ['/messaging',  './routes/messaging'],
  ['/users',      './routes/users'],
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

app.get('/', (req, res) => res.json({
  status: 'LaundroBot API running',
  env: {
    has_db: !!process.env.DATABASE_URL,
    has_jwt: !!process.env.JWT_SECRET,
    has_fb_token: !!process.env.FB_VERIFY_TOKEN,
  }
}));

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log('Server running on port ' + PORT);

  // Run follow-up job every 30 minutes for timely reminders
  cron.schedule('*/30 * * * *', () => {
    runFollowUp().catch(err => console.error('[follow-up] unhandled error:', err.message));
  });
  console.log('✓ follow-up cron scheduled (every 30 min)');
});