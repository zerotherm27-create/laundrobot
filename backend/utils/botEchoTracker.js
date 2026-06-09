// ── Bot-echo tracking (human-takeover detection) ─────────────────────────────
//
// Why this exists:
//   When a human staff member replies to a customer from the Meta inbox
//   (Messenger / Business Suite / Pages Manager), Meta sends us a `message_echoes`
//   webhook so we can pause the AI. The ONLY way we used to tell that echo apart
//   from the bot's own outgoing messages was the echo's `app_id` — but Meta
//   stamps human Business-Suite replies with the *connected app's* id too, so the
//   app_id check classified almost every human reply as a bot echo and the AI
//   never paused (root cause of the recurring "AI keeps talking after I take over"
//   bug).
//
// What we do instead:
//   We KNOW exactly which messages the bot sends — every outbound message goes
//   through `post()` in utils/messenger.js / utils/instagram.js. We increment a
//   per-recipient counter there. Each incoming echo decrements it: if there's an
//   outstanding bot-send, the echo is ours; if not, a human typed it → pause.
//   This is independent of Meta's unreliable `app_id`.
//
// Caveat: state is in-process memory, so it assumes a single backend instance
//   (the current Railway setup). If you scale to multiple replicas, move this
//   counter into the DB (e.g. a `pending_bot_echoes` column on `conversations`)
//   so a send on one instance is visible to an echo handled on another.

const _outstanding = new Map(); // recipientId -> { count, ts }
const TTL_MS = 2 * 60 * 1000;   // forget unpaired sends after 2 min

function noteBotSend(recipientId) {
  if (!recipientId) return;
  const id = String(recipientId);
  const cur = _outstanding.get(id);
  if (cur && Date.now() - cur.ts < TTL_MS) {
    cur.count += 1;
    cur.ts = Date.now();
  } else {
    _outstanding.set(id, { count: 1, ts: Date.now() });
  }
}

// True (and consumes one) if this echo corresponds to a message the bot sent.
// False → no outstanding bot-send → a human typed it.
function isOwnEcho(recipientId) {
  if (!recipientId) return false;
  const id = String(recipientId);
  const cur = _outstanding.get(id);
  if (!cur) return false;
  if (Date.now() - cur.ts >= TTL_MS) { _outstanding.delete(id); return false; }
  if (cur.count <= 0) { _outstanding.delete(id); return false; }
  cur.count -= 1;
  if (cur.count <= 0) _outstanding.delete(id);
  return true;
}

module.exports = { noteBotSend, isOwnEcho };
