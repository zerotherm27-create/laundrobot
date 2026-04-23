const router = require('express').Router();
const auth   = require('../middleware/auth');
const db     = require('../db');
const { sendMessage } = require('../utils/messenger');

// GET conversations waiting for human
router.get('/human', auth, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT cv.fb_user_id, cv.needs_human_at, cv.step,
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

// POST reply to a customer — sends message and pauses AI for that customer
router.post('/:fbUserId/reply', auth, async (req, res) => {
  const { message } = req.body;
  if (!message?.trim()) return res.status(400).json({ error: 'Message is required.' });
  try {
    const { rows: [tenant] } = await db.query(
      'SELECT fb_page_access_token, ai_pause_hours FROM tenants WHERE id=$1', [req.user.tenant_id]
    );
    if (!tenant?.fb_page_access_token) return res.status(400).json({ error: 'No page token configured.' });
    await sendMessage(tenant.fb_page_access_token, req.params.fbUserId, message.trim());
    const pauseHours = tenant.ai_pause_hours || 2;
    const pauseUntil = new Date(Date.now() + pauseHours * 60 * 60 * 1000).toISOString();
    await db.query(
      `INSERT INTO conversations (tenant_id, fb_user_id, step, data, updated_at)
       VALUES ($1, $2, 'AI', jsonb_build_object('ai_paused_until', $3), NOW())
       ON CONFLICT (tenant_id, fb_user_id)
       DO UPDATE SET data = conversations.data || jsonb_build_object('ai_paused_until', $3::text), updated_at=NOW()`,
      [req.user.tenant_id, req.params.fbUserId, pauseUntil]
    );
    res.json({ ok: true, ai_paused_until: pauseUntil });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST release conversation back to bot (optionally send a message first)
router.post('/:fbUserId/release', auth, async (req, res) => {
  const { message } = req.body;
  try {
    if (message?.trim()) {
      const { rows: [tenant] } = await db.query(
        'SELECT fb_page_access_token, ai_pause_hours FROM tenants WHERE id=$1', [req.user.tenant_id]
      );
      if (tenant?.fb_page_access_token) {
        await sendMessage(tenant.fb_page_access_token, req.params.fbUserId, message.trim());
        const pauseHours = tenant.ai_pause_hours || 2;
        const pauseUntil = new Date(Date.now() + pauseHours * 60 * 60 * 1000).toISOString();
        await db.query(
          `INSERT INTO conversations (tenant_id, fb_user_id, step, data, updated_at)
           VALUES ($1, $2, 'START', jsonb_build_object('ai_paused_until', $3), NOW())
           ON CONFLICT (tenant_id, fb_user_id)
           DO UPDATE SET data = conversations.data || jsonb_build_object('ai_paused_until', $3::text), updated_at=NOW()`,
          [req.user.tenant_id, req.params.fbUserId, pauseUntil]
        );
      }
    }
    await db.query(
      `UPDATE conversations SET needs_human=FALSE, needs_human_at=NULL, step='START', updated_at=NOW()
       WHERE tenant_id=$1 AND fb_user_id=$2`,
      [req.user.tenant_id, req.params.fbUserId]
    );
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
