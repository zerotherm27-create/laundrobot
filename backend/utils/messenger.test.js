const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

// ── HUMAN_AGENT tag must fall back to RESPONSE while pending Meta approval ──
// Confirmed live in production (2026-07-04) via the new [release] error
// logging: Meta rejects the tag outright pre-App-Review-approval —
// "(#100) Cannot tag messages with 'HUMAN_AGENT' without prior approval."
// (code 100, subcode 2018276) — even for app admins/testers, contradicting
// the prior assumption in CLAUDE.md that admins/testers could use it early.
// Every dashboard staff reply was silently broken as a result. Mirrors the
// existing sendStatusUpdate two-step fallback pattern (RESPONSE -> utility
// template) already used elsewhere in this file.

const src = fs.readFileSync(path.join(__dirname, 'messenger.js'), 'utf8');

test('sendHumanAgentMessage falls back to a plain RESPONSE send when Meta rejects the tag as unapproved', () => {
  const fnBody = src.split('async function sendHumanAgentMessage')[1]?.split('\nasync function')[0] || '';
  assert.match(fnBody, /catch/, 'must catch the Graph API error to detect the unapproved-tag rejection');
  assert.match(fnBody, /2018276|without prior approval/, 'must detect Meta\'s specific "without prior approval" rejection');
  assert.match(fnBody, /messaging_type:\s*'RESPONSE'/, 'must retry as a plain RESPONSE send on that specific rejection');
});

test('sendHumanAgentMessage still tries the HUMAN_AGENT tag first (for once it is approved)', () => {
  const fnBody = src.split('async function sendHumanAgentMessage')[1]?.split('\nasync function')[0] || '';
  assert.match(fnBody, /tag:\s*'HUMAN_AGENT'/, 'must still attempt the tagged send first');
});

test('an unrelated Graph API error (not the unapproved-tag rejection) is not swallowed by the fallback', () => {
  const fnBody = src.split('async function sendHumanAgentMessage')[1]?.split('\nasync function')[0] || '';
  assert.match(fnBody, /throw/, 'other errors (e.g. outside the RESPONSE window, invalid recipient) must still propagate');
});
