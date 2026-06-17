// ── Bot-echo classification (human-takeover detection) ───────────────────────
//
// Why this exists:
//   When a human staff member replies to a customer from the Meta inbox
//   (Messenger / Business Suite / Pages Manager), Meta sends us a `message_echoes`
//   webhook so we can pause the AI. We must tell that human echo apart from the
//   bot's OWN outgoing messages (which also come back as echoes).
//
//   ✗ app_id does NOT work: Meta stamps human Business-Suite replies with the
//     connected app's id too. NEVER use app_id.
//
//   ✗ An in-memory send counter does NOT work: a count can't tell which message
//     an echo belongs to (see commit history for the recurring bug this caused).
//     Do not reintroduce a counter.
//
//   ✗ message.metadata round-trip is NOT reliable: Meta does not guarantee
//     round-tripping custom metadata on human-reply echoes. In practice human
//     echoes arrived without our tag, causing zero pauses across 218 conversations.
//
//   ✓ What works: Meta's own message_id.
//     Every Send API call returns { message_id } in the response body. Meta echoes
//     that same id back as message.mid in the message_echoes event. We record
//     every mid the bot sends (in-memory, 10-min TTL) and look it up on each echo:
//       echo.message.mid ∈ _sentMids  → the bot's own send (do not pause)
//       echo.message.mid ∉ _sentMids  → a human typed it (pause the AI)
//     This is deterministic. It depends only on Meta's own ID (always present,
//     never forgeable by a human) rather than a custom metadata field. We still
//     stamp message.metadata as a secondary fallback for echoes without a mid.
//
// Failure mode (safe direction): if the process restarts between a bot send and
//   its echo, the mid is gone and the echo reads as human → AI pauses briefly.
//   Customers resume after ai_pause_hours or staff use /release-ai. This is the
//   safe direction (go quiet rather than talk over a human).
//
// Invariant to maintain: EVERY outbound message must go through post() in
//   utils/messenger.js or utils/instagram.js so its response mid is recorded.
//   If you add a code path that calls the Graph /messages endpoint directly,
//   call noteBotSend(response.data.message_id) immediately after.

const BOT_METADATA_TAG = 'laundrobot_ai_v1';

// mid → expiry timestamp (ms). Capped at MAX_MIDS; old entries pruned on overflow.
const _sentMids = new Map();
const MID_TTL_MS = 10 * 60 * 1000; // 10 min — far longer than any echo round-trip
const MAX_MIDS = 1000;

function noteBotSend(mid) {
  if (!mid) return;
  _sentMids.set(mid, Date.now() + MID_TTL_MS);
  if (_sentMids.size > MAX_MIDS) {
    const now = Date.now();
    for (const [k, exp] of _sentMids) {
      if (exp < now) _sentMids.delete(k);
      if (_sentMids.size <= MAX_MIDS) break;
    }
  }
}

// True  → this echo is one of the bot's own sends (do not pause).
// False → a human staff member typed it from the Meta inbox (pause the AI).
function isBotOwnEcho(echoMessage) {
  if (!echoMessage) return false;
  const mid = echoMessage.mid;
  if (mid) {
    const exp = _sentMids.get(mid);
    if (exp === undefined) return false;   // mid unknown → human reply
    if (Date.now() >= exp) { _sentMids.delete(mid); return false; } // expired
    return true;
  }
  // No mid in echo (shouldn't happen but guard it) — fall back to metadata tag.
  return echoMessage.metadata === BOT_METADATA_TAG;
}

module.exports = { isBotOwnEcho, BOT_METADATA_TAG, noteBotSend };
