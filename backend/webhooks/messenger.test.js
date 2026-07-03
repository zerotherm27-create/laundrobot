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

// ── Walk-in-only services must never reach customers ─────────────────────────
// Services flagged available_online=FALSE (e.g. the WALK IN category) are for
// the POS only. The public web form already filters them; the chat flow and
// the AI prompt must too.

test('chat catalog queries exclude walk-in-only services', () => {
  const catalogQueries = src.match(/FROM services s[\s\S]{0,300}?ORDER BY/g) || [];
  assert.ok(catalogQueries.length >= 2, 'expected the two showServiceCatalog queries');
  for (const q of catalogQueries) {
    assert.match(q, /available_online=TRUE/, `catalog query must filter available_online:\n${q}`);
  }
});

test('chat category menu hides categories with no online services', () => {
  assert.match(
    src,
    /FROM service_categories c[\s\S]{0,200}?EXISTS \(SELECT 1 FROM services s[\s\S]{0,120}?available_online=TRUE/,
    'category menu must only list categories having online services'
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
