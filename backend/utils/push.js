const webpush = require('web-push');
const db = require('../db');

let vapidSet = false;
function ensureVapid() {
  if (vapidSet) return true;
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return false;
  webpush.setVapidDetails(
    'mailto:' + (process.env.VAPID_MAILTO || 'admin@laundrobot.app'),
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
  vapidSet = true;
  return true;
}

async function sendPushToTenant(tenantId, payload) {
  if (!ensureVapid()) return;
  const { rows } = await db.query(
    'SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE tenant_id = $1',
    [tenantId]
  );
  if (!rows.length) return;

  const body = JSON.stringify(payload);
  const results = await Promise.allSettled(
    rows.map(sub =>
      webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, body)
    )
  );

  // Remove expired/invalid subscriptions (410 Gone or 404)
  const expired = [];
  results.forEach((r, i) => {
    if (r.status === 'rejected' && [404, 410].includes(r.reason?.statusCode)) {
      expired.push(rows[i].endpoint);
    }
  });
  if (expired.length) {
    await db.query(
      'DELETE FROM push_subscriptions WHERE endpoint = ANY($1)',
      [expired]
    ).catch(() => {});
  }
}

module.exports = { sendPushToTenant };
