const assert = require('node:assert/strict');
const test = require('node:test');

const { isBotOwnEcho, BOT_METADATA_TAG } = require('./botEchoTracker');

// Regression guard for the recurring "AI keeps talking after a human takes over" bug.
// Fix: classify message_echoes purely by the metadata tag we stamp on every bot
// send. NOT by app_id (Meta stamps human Business-Suite replies with the connected
// app's id too) and NOT by an in-memory counter (it mislabels human replies when
// echoes arrive out of order — the original failure).

test('echo carrying our metadata tag is the bot — no pause', () => {
  const echo = { is_echo: true, metadata: BOT_METADATA_TAG, app_id: 12345 };
  assert.equal(isBotOwnEcho(echo), true);
});

test('human inbox reply (no metadata tag) is NOT the bot — pause', () => {
  // The dangerous case: Meta stamps the human reply with OUR app_id. It must still
  // be treated as a human because it lacks our metadata tag.
  const humanEcho = { is_echo: true, app_id: 12345, text: 'staff here, let me check' };
  assert.equal(isBotOwnEcho(humanEcho), false);
});

test('echo with a different/empty metadata value is treated as human', () => {
  assert.equal(isBotOwnEcho({ is_echo: true, metadata: '' }), false);
  assert.equal(isBotOwnEcho({ is_echo: true, metadata: 'someone_elses_tag' }), false);
  assert.equal(isBotOwnEcho({ is_echo: true, metadata: null }), false);
});

test('classification is stateless — order of bot vs human echoes never matters', () => {
  // Out-of-order delivery: a human reply arrives BEFORE the bot's own echo. The old
  // counter would consume the outstanding bot send and mislabel the human as "bot".
  // With pure metadata there is no state, so each echo is judged on its own tag.
  const botEcho   = { is_echo: true, metadata: BOT_METADATA_TAG };
  const humanEcho = { is_echo: true }; // no tag
  assert.equal(isBotOwnEcho(humanEcho), false); // human first
  assert.equal(isBotOwnEcho(botEcho),   true);  // bot echo after — still bot
  assert.equal(isBotOwnEcho(humanEcho), false); // repeat — still human, no leakage
});

test('robust to missing message object', () => {
  assert.equal(isBotOwnEcho(undefined), false);
  assert.equal(isBotOwnEcho(null), false);
  assert.equal(isBotOwnEcho({}), false);
});
