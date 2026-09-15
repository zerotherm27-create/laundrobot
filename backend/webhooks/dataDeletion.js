const router = require('express').Router();
const crypto = require('crypto');
const db = require('../db');
const { parseSignedRequest } = require('../utils/dataDeletion');

// Meta calls this when a user requests their data be deleted (Settings >
// Apps and Websites > Remove, or a platform-level deletion sweep). Configure
// this URL as the Data Deletion Request Callback in App Settings > Advanced
// so Meta stops queuing these as manual "Urgent" alerts in the dashboard
// inbox that require downloading a user-ID file by hand.
// https://developers.facebook.com/docs/development/create-an-app/app-dashboard/data-deletion-callback
router.post('/', async (req, res) => {
  const payload = parseSignedRequest(req.body.signed_request, [process.env.FB_APP_SECRET, process.env.FB_IG_APP_SECRET]);
  if (!payload || !payload.user_id) {
    console.warn('[data-deletion] invalid or unsigned request');
    return res.sendStatus(403);
  }

  const userId = payload.user_id;
  const confirmationCode = crypto.randomUUID();

  try {
    // Anonymize rather than hard-delete: order history stays intact for
    // accounting/reporting, but no PII tying it to this person remains.
    // fb_id / fb_user_id are NOT NULL + UNIQUE(tenant_id, ...), so they get
    // a tombstone value instead of NULL to satisfy the constraint without
    // colliding with a future customer reusing the same slot.
    const tombstone = `deleted-${confirmationCode}`;
    const { rowCount: customerRows } = await db.query(
      `UPDATE customers SET name = NULL, phone = NULL, address = NULL, fb_id = $1 WHERE fb_id = $2`,
      [tombstone, userId]
    );
    const { rowCount: convoRows } = await db.query(
      `UPDATE conversations SET data = '{}', fb_user_id = $1 WHERE fb_user_id = $2`,
      [tombstone, userId]
    );

    await db.query(
      `INSERT INTO data_deletion_requests (user_id, confirmation_code, rows_affected) VALUES ($1, $2, $3)`,
      [userId, confirmationCode, customerRows + convoRows]
    );

    console.log(`[data-deletion] user_id=${userId} confirmation=${confirmationCode} customers=${customerRows} conversations=${convoRows}`);
  } catch (err) {
    console.error('[data-deletion] failed to anonymize:', err.message);
    return res.sendStatus(500);
  }

  const base = process.env.APP_URL || 'https://laundrobot.app';
  res.json({
    url: `${base}/webhook/data-deletion/status/${confirmationCode}`,
    confirmation_code: confirmationCode,
  });
});

// Status page shown to the user after they submit a deletion request.
router.get('/status/:code', async (req, res) => {
  try {
    const { rows: [record] } = await db.query(
      `SELECT confirmation_code, requested_at FROM data_deletion_requests WHERE confirmation_code = $1`,
      [req.params.code]
    );
    if (!record) return res.status(404).send('No deletion request found for this confirmation code.');
    res.send(`Your data deletion request (confirmation code ${record.confirmation_code}) was completed on ${record.requested_at}.`);
  } catch (err) {
    console.error('[data-deletion] status lookup failed:', err.message);
    res.sendStatus(500);
  }
});

module.exports = router;
