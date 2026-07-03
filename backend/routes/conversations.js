const router = require('express').Router();
const auth   = require('../middleware/auth');
const db     = require('../db');
const { sendHumanAgentMessage } = require('../utils/messenger');

// GET conversations waiting for human
router.get('/human', auth, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT cv.fb_user_id, cv.needs_human_at, cv.needs_human_text, cv.step,
              c.name AS customer_name, c.phone AS customer_phone
       FROM conversations cv
       LEFT JOIN customers c ON c.tenant_id=cv.tenant_id AND c.fb_id=cv.fb_user_id
       WHERE cv.tenant_id=$1 AND cv.needs_human=TRUE
       ORDER BY cv.needs_human_at ASC`,
      [req.user.tenant_id]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET customers with AI currently paused
router.get('/paused', auth, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT cv.fb_user_id, cv.ai_paused_until,
              c.name AS customer_name, c.phone AS customer_phone
       FROM conversations cv
       LEFT JOIN customers c ON c.tenant_id=cv.tenant_id AND c.fb_id=cv.fb_user_id
       WHERE cv.tenant_id=$1
         AND cv.ai_paused_until > NOW()
       ORDER BY cv.ai_paused_until ASC`,
      [req.user.tenant_id]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST release AI for a customer (clear the pause)
router.post('/:fbUserId/release-ai', auth, async (req, res) => {
  try {
    await db.query(
      `UPDATE conversations SET ai_paused_until=NULL, updated_at=NOW()
       WHERE tenant_id=$1 AND fb_user_id=$2`,
      [req.user.tenant_id, req.params.fbUserId]
    );
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST release conversation back to bot (optionally send a message first)
router.post('/:fbUserId/release', auth, async (req, res) => {
  const { message } = req.body;
  let sentMessageIds = null;
  try {
    if (message?.trim()) {
      const { rows: [tenant] } = await db.query(
        'SELECT fb_page_access_token, ai_pause_hours FROM tenants WHERE id=$1', [req.user.tenant_id]
      );
      if (!tenant?.fb_page_access_token) {
        return res.status(400).json({ error: 'No Facebook page token configured for this tenant — cannot send message.' });
      }
      // HUMAN_AGENT tag: staff can reply up to 7 days after the customer's
      // last message (plain RESPONSE fails with error 10 outside 24h).
      sentMessageIds = await sendHumanAgentMessage(tenant.fb_page_access_token, req.params.fbUserId, message.trim());
      const pauseHours = tenant.ai_pause_hours || 2;
      const pauseUntil = new Date(Date.now() + pauseHours * 60 * 60 * 1000).toISOString();
      await db.query(
        `INSERT INTO conversations (tenant_id, fb_user_id, step, data, ai_paused_until, updated_at)
         VALUES ($1, $2, 'START', '{}'::jsonb, $3, NOW())
         ON CONFLICT (tenant_id, fb_user_id)
         DO UPDATE SET ai_paused_until=$3, updated_at=NOW()`,
        [req.user.tenant_id, req.params.fbUserId, pauseUntil]
      );
    }
    await db.query(
      `UPDATE conversations SET needs_human=FALSE, needs_human_at=NULL, needs_human_text=NULL, step='START', updated_at=NOW()
       WHERE tenant_id=$1 AND fb_user_id=$2`,
      [req.user.tenant_id, req.params.fbUserId]
    );
    res.json({ ok: true, sent: sentMessageIds ? { messageIds: sentMessageIds, text: message.trim() } : null });
  } catch (err) {
    const fbErr = err.response?.data?.error;
    console.error('[release]', JSON.stringify({
      tenant_id: req.user.tenant_id,
      fb_user_id: req.params.fbUserId,
      hadMessage: !!message?.trim(),
      fbCode: fbErr?.code, fbSubcode: fbErr?.error_subcode, fbMessage: fbErr?.message,
      pgCode: err.code,
      err: fbErr?.message || err.message,
    }));
    res.status(500).json({ error: fbErr?.message || err.message || 'Failed to release conversation.' });
  }
});

module.exports = router;
