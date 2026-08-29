const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

// ── Announcement broadcast invariants ──
// The manual shop announcement ("pickup may be delayed due to weather") can be
// pushed to Messenger customers. Three things must hold:
//  1. only customers with a LIVE booking are messaged — not everyone who ever
//     ordered, which is what POST /blast does;
//  2. sends go through utils/messenger's sendMessage, never a direct Graph
//     call, so post() records the message_id via noteBotSend — otherwise the
//     echo reads as a human reply and pauses the AI (see CLAUDE.md);
//  3. Meta error 10 (outside the 24h window) is reported as SKIPPED, not as a
//     delivered message. There is no compliant tag for a general announcement,
//     so those customers are genuinely unreachable and staff must know.

const src = fs.readFileSync(path.join(__dirname, 'messaging.js'), 'utf8');
const announceRoute = src.slice(src.indexOf("router.post('/announcement/send'"));

test('announcement audience excludes completed and cancelled bookings', () => {
  assert.match(src, /ANNOUNCEMENT_AUDIENCE/);
  assert.match(src, /o\.status NOT IN \('COMPLETED', 'CANCELLED'\)/);
  assert.match(src, /c\.fb_id IS NOT NULL/);
  assert.match(src, /c\.tenant_id = \$1/);
});

test('recipient count and send use the same audience clause', () => {
  const uses = src.match(/\$\{ANNOUNCEMENT_AUDIENCE\}/g) || [];
  assert.equal(uses.length, 2, 'count route and send route must share the audience');
});

test('announcement sends through sendMessage, not a direct Graph call', () => {
  assert.match(announceRoute, /await sendMessage\(/);
  assert.doesNotMatch(announceRoute, /graph\.facebook\.com/);
  assert.doesNotMatch(announceRoute, /axios/);
});

test('Meta error 10 is counted as skipped, never as sent', () => {
  assert.match(announceRoute, /code === 10/);
  assert.match(announceRoute, /skipped\+\+/);
  // sent++ must only happen on the success path, before the catch block
  const successIdx = announceRoute.indexOf('sent++');
  const catchIdx = announceRoute.indexOf('} catch (e) {');
  assert.ok(successIdx > 0 && successIdx < catchIdx, 'sent++ must be in the try, not the catch');
});

test('announcement must be enabled and non-empty before it can be sent', () => {
  assert.match(announceRoute, /!tenant\.announcement_enabled \|\| !text/);
  assert.match(announceRoute, /status\(400\)/);
});

test('broadcast keeps the growth/pro plan gate', () => {
  assert.match(announceRoute, /\['growth', 'pro'\]\.includes\(tenant\?\.plan\)/);
  assert.match(announceRoute, /\['admin','superadmin'\]\.includes\(req\.user\.role\)/);
});
