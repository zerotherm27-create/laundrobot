// Automated trial emails for shop OWNERS (not laundry customers): confirm-your-email nudges,
// trial-ending reminders, and a win-back sequence with a one-time "7 more trial days" offer.
// Wording: utils/lifecycleEmails.js. Timing: pickStep() below. Send log: lifecycle_emails table.
//
// Kill switch — env LIFECYCLE_EMAILS: 'off' (default, does nothing) | 'dry' (logs who would get
// what, sends nothing, writes nothing) | 'on'.
const db = require('../db');
const { sendEmail } = require('../utils/email');
const { render } = require('../utils/lifecycleEmails');
const { buildLinks } = require('../utils/lifecycleLinks');
const { createVerificationToken } = require('../utils/verification');

const DAY = 24 * 60 * 60 * 1000;
// A step is only sent within this long after it falls due. Shops whose date passed long ago (e.g.
// every trial that expired before this feature existed) are never back-filled with old emails.
const WINDOW = 2 * DAY;
const MIN_GAP = 20 * 60 * 60 * 1000; // never two emails to one shop inside 20h
const SEND_HOUR_MANILA = 10;
const TRIAL_DAYS = 14; // must match the trial length set in routes/auth.js + routes/verifyEmail.js
const REPLY_TO = () => process.env.LIFECYCLE_REPLY_TO || 'hello@laundrobot.app';

const ms = d => (d ? new Date(d).getTime() : null);

// Pure: which single step (if any) is due for this shop right now. `row` is one row of the
// candidate query in runLifecycleEmail. Returns a step key from utils/lifecycleEmails.js, or null.
function pickStep(row, now = new Date()) {
  const t = now.getTime();
  const sent = row.sent || [];
  if (row.marketing_unsubscribed_at) return null;
  // Paid (or was paid once, then cancelled) shops are not trial leads.
  if (!['trial', 'expired'].includes(row.subscription_status)) return null;
  if (row.subscription_paid_until) return null;
  if (row.last_sent_at && t - ms(row.last_sent_at) < MIN_GAP) return null;

  const due = at => at !== null && t >= at && t < at + WINDOW;
  const first = steps => {
    for (const [step, at] of steps) if (due(at) && !sent.includes(step)) return step;
    return null;
  };

  // Never confirmed their email: only the confirm nudges (their trial clock has not really started).
  if (!row.email_verified) {
    const signup = ms(row.created_at);
    if (signup === null) return null;
    return first([['unverified_2', signup + 3 * DAY], ['unverified_1', signup + 1 * DAY]]);
  }

  const end = ms(row.trial_ends_at);
  if (end === null) return null;

  // Already used the 7 extra days: one closing email when they run out, nothing else.
  if (row.trial_extended_at) return first([['ext_ended', end]]);

  // The trial clock starts when the owner confirms their email (verifyEmail.js resets trial_ends_at).
  const start = end - TRIAL_DAYS * DAY;

  // Latest step first, so a shop is never sent an out-of-date earlier step.
  return first([
    ['ended_14', end + 14 * DAY],
    ['ended_7',  end + 7 * DAY],
    ['ended_3',  end + 3 * DAY],
    ['ended_0',  end],
    ['trial_1d', end - 1 * DAY],
    ['trial_3d', end - 3 * DAY],
    // How-to emails while the trial is running (day 1, 4 and 8).
    ['tips_3',   start + 8 * DAY],
    ['tips_2',   start + 4 * DAY],
    ['tips_1',   start + 1 * DAY],
  ]);
}

// Self-serve signups only (signup_ip is set by /auth/signup, never by superadmin-created shops),
// primary shops only, owner = oldest admin user. One row per shop with the steps already sent.
const CANDIDATES_SQL = `
  SELECT t.id AS tenant_id, t.name, t.created_at, t.subscription_status, t.trial_ends_at,
         t.subscription_paid_until, t.trial_extended_at, t.marketing_unsubscribed_at,
         u.id AS user_id, u.email, u.email_verified,
         COALESCE(array_agg(le.step) FILTER (WHERE le.step IS NOT NULL), '{}') AS sent,
         MAX(le.sent_at) AS last_sent_at
  FROM tenants t
  JOIN LATERAL (
    SELECT id, email, email_verified FROM users
    WHERE tenant_id = t.id AND role = 'admin' AND email IS NOT NULL
    ORDER BY created_at ASC LIMIT 1
  ) u ON TRUE
  LEFT JOIN lifecycle_emails le ON le.tenant_id = t.id
  WHERE t.active = TRUE
    AND t.primary_tenant_id IS NULL
    AND t.signup_ip IS NOT NULL
    AND t.marketing_unsubscribed_at IS NULL
    AND t.subscription_status IN ('trial', 'expired')
    AND t.subscription_paid_until IS NULL
  GROUP BY t.id, u.id, u.email, u.email_verified`;

const manilaHour = now => (now.getUTCHours() + 8) % 24;

// `force` skips the 10:00-Manila gate (for a manual run); it never overrides the kill switch.
async function runLifecycleEmail({ now = new Date(), force = false } = {}) {
  const mode = (process.env.LIFECYCLE_EMAILS || 'off').toLowerCase();
  if (mode !== 'on' && mode !== 'dry') return { mode: 'off', sent: 0 };
  if (!force && manilaHour(now) !== SEND_HOUR_MANILA) return { mode, sent: 0, skipped: 'not send hour' };

  const { rows } = await db.query(CANDIDATES_SQL);
  let sent = 0;
  for (const row of rows) {
    const step = pickStep(row, now);
    if (!step) continue;

    if (mode === 'dry') {
      console.log(`[lifecycle] DRY RUN would send ${step} to ${row.email} (${row.name})`);
      continue;
    }

    // Claim the step BEFORE sending: the UNIQUE (tenant_id, step) row is the lock, so two
    // instances (or a retry) can never send the same step twice.
    const { rows: claimed } = await db.query(
      `INSERT INTO lifecycle_emails (tenant_id, email, step) VALUES ($1, $2, $3)
       ON CONFLICT (tenant_id, step) DO NOTHING RETURNING id`,
      [row.tenant_id, row.email, step]
    );
    if (!claimed.length) continue;

    try {
      const verifyToken = step.startsWith('unverified_') ? await createVerificationToken(db, row.user_id) : null;
      const links = buildLinks(row.tenant_id, verifyToken);
      await sendEmail({
        to: row.email,
        ...render(step, { shopName: row.name, links }),
        headers: { 'List-Unsubscribe': `<${links.unsubscribe}>` },
        replyTo: REPLY_TO(), // the emails say "reply to this email" — never let that go to noreply@
      });
      sent++;
      console.log(`[lifecycle] sent ${step} to ${row.email} (${row.name})`);
    } catch (err) {
      // Release the claim so the next run retries (still inside the step's window).
      await db.query(`DELETE FROM lifecycle_emails WHERE id = $1 AND tenant_id = $2`, [claimed[0].id, row.tenant_id]).catch(() => {});
      console.error(`[lifecycle] ${step} to ${row.email} failed:`, err.response?.data || err.message);
    }
  }
  return { mode, sent };
}

module.exports = runLifecycleEmail;
module.exports.pickStep = pickStep;
module.exports.REPLY_TO = REPLY_TO;
module.exports.CANDIDATES_SQL = CANDIDATES_SQL;
