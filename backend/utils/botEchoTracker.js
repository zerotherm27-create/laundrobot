// ── Bot-echo classification (human-takeover detection) ───────────────────────
//
// Why this exists:
//   When a human staff member replies to a customer from the Meta inbox
//   (Messenger / Business Suite / Pages Manager), Meta sends us a `message_echoes`
//   webhook so we can pause the AI. We must tell that human echo apart from the
//   bot's OWN outgoing messages (which also come back as echoes).
//
//   ✗ app_id does NOT work: Meta stamps human Business-Suite replies with the
//     connected app's id too, identical to our Send API calls. NEVER use app_id.
//
//   ✗ An in-memory send counter does NOT work either (this was the previous fix
//     and the source of the recurring "AI talks over staff" bug): a count can't
//     tell which message an echo belongs to, so Meta's out-of-order / dropped
//     echoes let a human reply be mistaken for an outstanding bot send → no pause.
//
//   ✓ What works: stamp every bot send with `message.metadata = BOT_METADATA_TAG`
//     (done in utils/messenger.js + utils/instagram.js `post()`). Meta round-trips
//     that string back in the echo at `message.metadata`. A human's inbox reply
//     has no such tag — and a human cannot forge it. So the rule is simply:
//       echo.message.metadata === BOT_METADATA_TAG  → the bot's own send (ignore)
//       anything else (absent / different)          → a human typed it (pause AI)
//     This is stateless: it is correct across process restarts and any number of
//     backend replicas, and never touches app_id.
//
// Requirements for correctness (both hold today):
//   1. Meta round-trips message.metadata in echoes. Confirmed for the Messenger
//      Platform Send API.
//   2. EVERY outbound message goes through post() so it gets stamped. Verified:
//      all runtime sends route through utils/messenger.js / utils/instagram.js.
//      If you ever add a code path that calls the Graph /messages endpoint
//      directly, it MUST set message.metadata = BOT_METADATA_TAG or its echo will
//      be misread as a human reply and spuriously pause the AI.
//
// Failure mode (deliberately the SAFE direction): if Meta ever fails to echo the
//   tag on a bot send, that echo is read as a human reply and the AI pauses itself
//   (goes quiet) rather than talking over a human. The customer can resume the bot
//   by sending another message after ai_pause_hours, or staff can use /release-ai.

// Developer-defined string stamped on every bot send and matched on every echo.
const BOT_METADATA_TAG = 'laundrobot_ai_v1';

// True  → this echo is one of the bot's own sends (do not pause).
// False → a human staff member typed it from the Meta inbox (pause the AI).
function isBotOwnEcho(echoMessage) {
  return echoMessage?.metadata === BOT_METADATA_TAG;
}

module.exports = { isBotOwnEcho, BOT_METADATA_TAG };
