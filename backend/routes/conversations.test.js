const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

// ── Human Agent tag on dashboard staff replies ───────────────────────────────
// The Meta "Human Agent" feature exists to let staff reply within 7 days of a
// customer's message using the HUMAN_AGENT message tag. The dashboard release
// route used to send a plain RESPONSE-type message, which (a) fails with
// error 10 outside the 24h window and (b) never exercises the feature we're
// requesting in App Review. Staff replies must go out with the HUMAN_AGENT tag.

const messengerSrc = fs.readFileSync(path.join(__dirname, '..', 'utils', 'messenger.js'), 'utf8');
const conversationsSrc = fs.readFileSync(path.join(__dirname, 'conversations.js'), 'utf8');

test('messenger.js provides a HUMAN_AGENT-tagged send that goes through post()', () => {
  assert.match(messengerSrc, /sendHumanAgentMessage/, 'sendHumanAgentMessage must exist');
  assert.match(
    messengerSrc,
    /messaging_type:\s*'MESSAGE_TAG',\s*\n?\s*tag:\s*'HUMAN_AGENT'/,
    'must send with messaging_type MESSAGE_TAG and tag HUMAN_AGENT'
  );
  const fnBody = messengerSrc.split('function sendHumanAgentMessage')[1]?.split('\n}')[0] || '';
  assert.match(fnBody, /await post\(/, 'must use the post() wrapper so noteBotSend records the mid (bot-echo invariant)');
  assert.match(messengerSrc, /module\.exports = \{[^}]*sendHumanAgentMessage/, 'must be exported');
});

test('the dashboard release route sends staff replies with the HUMAN_AGENT tag', () => {
  assert.match(conversationsSrc, /sendHumanAgentMessage/, 'release route must use the tagged send');
  const releaseBlock = conversationsSrc.split("'/:fbUserId/release'")[1] || '';
  assert.match(releaseBlock, /sendHumanAgentMessage\(/, 'the /release handler must call sendHumanAgentMessage');
  assert.doesNotMatch(
    releaseBlock,
    /[^A-Za-z]sendMessage\(/,
    'the /release handler must not fall back to the plain RESPONSE send'
  );
});

// ── Release route must be observable and never silently no-op ───────────────
// The route used to catch errors with `res.status(500).json({ error: err.message })`
// and NO server-side logging at all — so when Meta rejected the HUMAN_AGENT tag
// (or anything else failed), there was zero visibility into why, on either end.
// It also silently skipped the send (and reported success) when the tenant had
// no fb_page_access_token, hiding a real failure behind `{ ok: true }`.

test('release route logs the real Meta/Postgres error, not just err.message', () => {
  const releaseBlock = conversationsSrc.split("'/:fbUserId/release'")[1] || '';
  assert.match(releaseBlock, /console\.error\(\s*['"]\[release\]/, 'must log on failure — this route was the silent outlier');
  assert.match(releaseBlock, /err\.response\?\.data\?\.error/, 'must extract Meta\'s actual error object, not just err.message');
  assert.match(
    releaseBlock,
    /res\.status\(500\)\.json\(\{\s*error:\s*fbErr\?\.message\s*\|\|\s*err\.message/,
    'must surface the real error message to the frontend, not a bare err.message'
  );
});

test('release route rejects explicitly when no page token is configured, instead of a silent no-op success', () => {
  const releaseBlock = conversationsSrc.split("'/:fbUserId/release'")[1] || '';
  assert.match(
    releaseBlock,
    /if \(!tenant\?\.fb_page_access_token\)\s*\{\s*return res\.status\(400\)/,
    'missing token must return an explicit 400, not silently skip the send and report {ok:true}'
  );
});

test('release route returns delivery confirmation (message ids) on success', () => {
  const releaseBlock = conversationsSrc.split("'/:fbUserId/release'")[1] || '';
  assert.match(releaseBlock, /sentMessageIds\s*=\s*await sendHumanAgentMessage/, 'must capture the returned message ids');
  assert.match(releaseBlock, /sent:\s*sentMessageIds/, 'success response must include the sent confirmation');
});

test('release route clears needs_human_text so stale customer messages do not linger', () => {
  const releaseBlock = conversationsSrc.split("'/:fbUserId/release'")[1] || '';
  assert.match(releaseBlock, /needs_human_text=NULL/, 'release must clear needs_human_text along with needs_human');
});

test('sendHumanAgentMessage returns the Send API message id(s) for delivery confirmation', () => {
  const fnBody = messengerSrc.split('function sendHumanAgentMessage')[1]?.split('\n}')[0] || '';
  assert.match(fnBody, /message_id/, 'must capture message_id from the Send API response');
  assert.match(fnBody, /return mids/, 'must return the captured mids to the caller');
});

test('GET /human surfaces the customer\'s triggering message', () => {
  const humanBlock = conversationsSrc.split("'/human'")[1]?.split("router.get('/paused'")[0] || '';
  assert.match(humanBlock, /needs_human_text/, 'GET /human must select needs_human_text so staff see what they are replying to');
});

// ── Webhook must capture the customer's message when human handoff triggers ──

const webhookSrc = fs.readFileSync(path.join(__dirname, '..', 'webhooks', 'messenger.js'), 'utf8');

test('both wantsHuman trigger sites persist the customer\'s message text', () => {
  const matches = webhookSrc.match(/needs_human=TRUE,\s*needs_human_at=NOW\(\),\s*needs_human_text=\$3/g) || [];
  assert.equal(matches.length, 2, 'expected both human-request trigger sites to capture needs_human_text');
});
