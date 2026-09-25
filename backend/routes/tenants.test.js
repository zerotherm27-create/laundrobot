const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

// ── facebook-connect must not swallow failures ──────────────────────────────
// fb_page_id is UNIQUE: connecting a Page already attached to another tenant
// used to surface as a bare 500. And setupMessengerProfile's fbError was
// discarded, so the UI said "✅ Connected" even when Messenger setup failed.

const src = fs.readFileSync(path.join(__dirname, 'tenants.js'), 'utf8');
const connect = src.slice(src.indexOf("'/settings/facebook-connect'"), src.indexOf("'/settings/facebook-status'"));

test('facebook-connect maps unique violation to a 409 with a clear message', () => {
  assert.match(connect, /err\.code === '23505'/);
  assert.match(connect, /status\(409\)/);
});

test('facebook-connect returns setup warnings instead of always claiming success', () => {
  assert.match(connect, /warning/);
  assert.match(connect, /res\.json\(\{ success: true, pageName: page\.name, warning \}\)/);
});
