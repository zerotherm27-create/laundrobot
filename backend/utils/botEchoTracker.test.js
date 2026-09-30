const assert = require('node:assert/strict');
const test = require('node:test');

const { isBotOwnEcho, BOT_METADATA_TAG, noteBotSend, pageMessagesAfterCustomer } = require('./botEchoTracker');

// ── mid-based detection (primary path) ───────────────────────────────────────
// Meta returns message_id on every Send API call; the same id comes back as
// message.mid in the echo. This is the only reliable discriminator because it
// is Meta's own ID — never forgeable, always present, independent of app_id or
// custom metadata fields.

test('bot echo with a recorded mid is the bot — no pause', () => {
  noteBotSend('mid_bot_001');
  const echo = { is_echo: true, mid: 'mid_bot_001' };
  assert.equal(isBotOwnEcho(echo), true);
});

test('human inbox reply with an unknown mid triggers a pause', () => {
  // Human replies from Business Suite carry a mid Meta generated for them,
  // which we never recorded via noteBotSend.
  const humanEcho = { is_echo: true, mid: 'mid_human_999', app_id: 12345, text: 'staff here' };
  assert.equal(isBotOwnEcho(humanEcho), false);
});

test('each mid is independent — recording one does not unlock others', () => {
  noteBotSend('mid_bot_A');
  assert.equal(isBotOwnEcho({ mid: 'mid_bot_A' }), true);
  assert.equal(isBotOwnEcho({ mid: 'mid_bot_B' }), false); // different mid
});

test('out-of-order delivery: human reply before bot echo — human still detected', () => {
  noteBotSend('mid_bot_ooo');
  // Human echo arrives BEFORE the bot's own echo in this test
  const humanEcho = { is_echo: true, mid: 'mid_human_ooo' };
  const botEcho   = { is_echo: true, mid: 'mid_bot_ooo' };
  assert.equal(isBotOwnEcho(humanEcho), false); // human first — must pause
  assert.equal(isBotOwnEcho(botEcho),   true);  // bot after — no pause
  assert.equal(isBotOwnEcho(humanEcho), false); // human again — still pauses
});

// ── metadata fallback (secondary path, no mid present) ───────────────────────

test('echo with our metadata tag and no mid is the bot — fallback path', () => {
  const echo = { is_echo: true, metadata: BOT_METADATA_TAG };
  assert.equal(isBotOwnEcho(echo), true);
});

test('echo with wrong/missing metadata and no mid is human — fallback path', () => {
  assert.equal(isBotOwnEcho({ is_echo: true, metadata: '' }), false);
  assert.equal(isBotOwnEcho({ is_echo: true, metadata: 'other_tag' }), false);
  assert.equal(isBotOwnEcho({ is_echo: true }), false);
});

// ── edge cases ────────────────────────────────────────────────────────────────

test('robust to missing / null message object', () => {
  assert.equal(isBotOwnEcho(undefined), false);
  assert.equal(isBotOwnEcho(null), false);
  assert.equal(isBotOwnEcho({}), false);
});

test('noteBotSend ignores falsy mids silently', () => {
  assert.doesNotThrow(() => noteBotSend(null));
  assert.doesNotThrow(() => noteBotSend(undefined));
  assert.doesNotThrow(() => noteBotSend(''));
});

// ── Click-to-Messenger ad greeting ───────────────────────────────────────────
// The ad's built-in greeting is sent by the Page (via Meta, so its mid is not
// one we recorded) BEFORE the customer's first message. It must not be read as
// a staff reply, or the AI pauses for 2h on every ad click.
// Graph returns messages newest-first.
const CUST = 'cust1';
const msg = (id, from, t) => ({ id, from: { id: from }, created_time: t });

test('ad greeting that predates the first customer message is not a human reply', () => {
  const thread = [
    msg('m_cust', CUST, '2026-09-30T03:46:00+0000'),
    msg('m_ad_greeting', 'PAGE', '2026-09-30T03:45:00+0000'),
  ];
  assert.deepEqual(pageMessagesAfterCustomer(thread, CUST, 5), []);
});

test('page message sent after a customer message is still a candidate human reply', () => {
  const thread = [
    msg('m_staff', 'PAGE', '2026-09-30T03:50:00+0000'),
    msg('m_cust', CUST, '2026-09-30T03:46:00+0000'),
    msg('m_ad_greeting', 'PAGE', '2026-09-30T03:45:00+0000'),
  ];
  assert.deepEqual(pageMessagesAfterCustomer(thread, CUST, 5).map(m => m.id), ['m_staff']);
});

test('truncated window (oldest message unseen) keeps the conservative behaviour', () => {
  const thread = [
    msg('m_a', 'PAGE', '2026-09-30T03:50:00+0000'),
    msg('m_b', 'PAGE', '2026-09-30T03:49:00+0000'),
  ];
  // limit == thread length → we can't see the start of the thread
  assert.deepEqual(pageMessagesAfterCustomer(thread, CUST, 2).map(m => m.id), ['m_a', 'm_b']);
});
