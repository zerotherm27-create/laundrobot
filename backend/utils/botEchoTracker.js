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
//   bug). NEVER reintroduce app_id-based discrimination.
//
// PRIMARY mechanism (stateless, reliable): every outbound message is stamped with
//   `message.metadata = BOT_METADATA_TAG`. Meta round-trips that string back in the
//   echo at `message.metadata`. A human's inbox reply carries no such tag, so the
//   echo handler can tell them apart with certainty — independent of app_id, and
//   independent of process state (survives restarts and multiple replicas).
//
// FALLBACK mechanism (the counter below): some channels/older API versions may not
//   round-trip metadata. When an echo arrives with NO metadata field at all, we
//   fall back to this per-recipient counter: every bot send increments it via
//   noteBotSend(); each un-tagged echo decrements it. If there's an outstanding
//   bot-send the echo is ours; otherwise a human typed it → pause.
//
//   ⚠️ The counter is a heuristic — it can't tell which message an echo belongs to,
//   so out-of-order / dropped echoes mislabel a human reply as a bot echo (this was
//   the recurring failure). It is also in-process memory (single instance only).
//   Treat it as a best-effort backstop; the metadata tag is the real fix.

// Developer-defined string stamped on every bot send and matched on every echo.
const BOT_METADATA_TAG = 'laundrobot_ai_v1';

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

// Decide whether a message_echoes event is the bot's own send (true → ignore) or a
// human staff reply from the Meta inbox (false → pause the AI). PRIMARY signal: the
// metadata tag we stamp on every bot send, which Meta round-trips at
// message.metadata — a human reply has none. Only when the echo carries NO metadata
// field at all do we fall back to the in-memory counter. NEVER use app_id here.
function isBotOwnEcho(echoMessage, recipientId) {
  const meta = echoMessage?.metadata;
  if (meta !== undefined && meta !== null) {
    return meta === BOT_METADATA_TAG; // authoritative: stateless, restart/replica-safe
  }
  return isOwnEcho(recipientId); // fallback for channels that don't round-trip metadata
}

module.exports = { noteBotSend, isOwnEcho, isBotOwnEcho, BOT_METADATA_TAG };
