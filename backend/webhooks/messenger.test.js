const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

// ── Instagram "book" must open the WEB booking form, not the chat flow ───────
// The 'book' trigger routed Instagram users into the in-chat state machine
// (SELECT_CATEGORY quick replies) — a leftover from when IG button templates
// were assumed unsupported. IG supports plain web_url buttons (no
// messenger_extensions webview), so Instagram customers get the same
// book.<domain> web form as Messenger customers.

const src = fs.readFileSync(path.join(__dirname, 'messenger.js'), 'utf8');

test("the 'book' trigger sends the web form on Instagram too", () => {
  const bookBlock = src.split("if (lc === 'book' || text === 'BOOK')")[1]?.split('return;')[0] || '';
  assert.match(
    bookBlock,
    /channel === 'messenger' \|\| channel === 'instagram'/,
    "the web-form branch must cover both messenger and instagram"
  );
});

test('bookBtn emits a plain web_url button for instagram (no messenger_extensions)', () => {
  const fn = src.split('function bookBtn')[1]?.split('\n}')[0] || '';
  assert.match(fn, /channel/, 'bookBtn must be channel-aware');
  assert.match(
    fn,
    /instagram[^\n]*\n?[^\n]*web_url/,
    'instagram branch must produce a web_url button'
  );
  const igLine = fn.split("'instagram'")[1]?.split(':')?.slice(0, 4).join(':') || '';
  assert.doesNotMatch(igLine, /messenger_extensions/, 'instagram button must not set messenger_extensions');
});
