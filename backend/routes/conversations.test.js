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
