const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

// ── Instagram persistent menu must be configured, not skipped ────────────────
// The IG menu/ice-breakers were skipped for months behind a comment claiming
// they "require elevated permissions". False: POST /me/messenger_profile with
// ?platform=instagram and the ordinary page token works (verified live
// 2026-07-03, {"result":"success"}). The myth dated from the wrong-endpoint
// era when every IG call failed with capability errors.

const src = fs.readFileSync(path.join(__dirname, 'messengerProfile.js'), 'utf8');

test('sets the Instagram persistent menu via platform=instagram', () => {
  assert.match(src, /platform=instagram/, 'must call messenger_profile with platform=instagram');
  const igSection = src.split('platform=instagram')[1] || '';
  assert.match(src, /Instagram persistent menu/, 'must set an Instagram persistent menu');
});

test('sets Instagram ice breakers for new conversations', () => {
  assert.match(src, /ice_breakers/, 'must configure ice breakers');
});

test('the elevated-permissions skip is gone', () => {
  assert.doesNotMatch(
    src,
    /requires elevated permissions/,
    'the false "requires elevated permissions" skip must not return'
  );
});
