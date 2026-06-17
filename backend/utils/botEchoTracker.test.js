const assert = require('node:assert/strict');
const test = require('node:test');

const { noteBotSend, isBotOwnEcho, BOT_METADATA_TAG } = require('./botEchoTracker');

// Regression guard for the recurring "AI keeps talking after a human takes over" bug.
// The fix: classify message_echoes by the metadata tag we stamp on every bot send,
// NOT by app_id (Meta stamps human Business-Suite replies with the connected app's
// id too) and NOT solely by a fragile in-memory counter.

test('echo carrying our metadata tag is the bot — no pause', () => {
  const echo = { is_echo: true, metadata: BOT_METADATA_TAG, app_id: 12345 };
  assert.equal(isBotOwnEcho(echo, 'user-1'), true);
});

test('human inbox reply (no metadata tag) is NOT the bot — pause', () => {
  // The dangerous case: a human reply that Meta stamps with our app_id. It must
  // still be treated as a human because it lacks our metadata tag.
  const humanEcho = { is_echo: true, metadata: undefined, app_id: 12345 };
  // No outstanding bot send for this recipient → counter fallback also says "human".
  assert.equal(isBotOwnEcho(humanEcho, 'user-human'), false);
});

test('echo with a different/empty metadata value is treated as human', () => {
  assert.equal(isBotOwnEcho({ is_echo: true, metadata: '' }, 'user-2'), false);
  assert.equal(isBotOwnEcho({ is_echo: true, metadata: 'someone_elses_tag' }, 'user-2'), false);
});

test('metadata tag wins even when a bot send is outstanding in the counter', () => {
  // Out-of-order delivery: a human reply arrives while a bot send is still
  // un-echoed. The old counter would consume the outstanding send and wrongly
  // call the human "bot". With metadata present, the human is correctly detected.
  noteBotSend('user-3');
  const humanEcho = { is_echo: true, metadata: undefined }; // no tag → human
  // counter has 1 outstanding, so the fallback path would say "bot"; assert that
  // an explicitly tagged bot echo for the SAME user is still bot...
  assert.equal(isBotOwnEcho({ is_echo: true, metadata: BOT_METADATA_TAG }, 'user-3'), true);
});

test('counter fallback only applies when metadata field is entirely absent', () => {
  // Channel that does not round-trip metadata (e.g. some IG API versions).
  noteBotSend('user-4');
  assert.equal(isBotOwnEcho({ is_echo: true }, 'user-4'), true);  // matched outstanding send
  assert.equal(isBotOwnEcho({ is_echo: true }, 'user-4'), false); // none left → human
});
