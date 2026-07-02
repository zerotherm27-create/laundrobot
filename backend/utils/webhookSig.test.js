const assert = require('node:assert/strict');
const test = require('node:test');
const crypto = require('node:crypto');

// ── Webhook signature verification must accept BOTH Meta apps ────────────────
// Instagram DM webhooks can be delivered signed by the companion Instagram app
// (laundrobot-IG), not just the main LaundroBot app. With single-secret
// verification every such delivery was 403'd as "Signature mismatch" and IG
// messages silently never reached the bot (discovered 2026-07-02 in Railway
// logs). Verification must try every configured app secret, and must not
// throw on malformed/odd-length signature headers.

const { signatureMatches } = require('./webhookSig');

const body = Buffer.from(JSON.stringify({ object: 'instagram', entry: [] }));
const sign = (secret) => 'sha256=' + crypto.createHmac('sha256', secret).update(body).digest('hex');

test('accepts a signature from the primary app secret', () => {
  assert.equal(signatureMatches(body, sign('main-secret'), ['main-secret', 'ig-secret']), true);
});

test('accepts a signature from the secondary (Instagram app) secret', () => {
  assert.equal(signatureMatches(body, sign('ig-secret'), ['main-secret', 'ig-secret']), true);
});

test('rejects a signature from an unknown secret', () => {
  assert.equal(signatureMatches(body, sign('attacker-secret'), ['main-secret', 'ig-secret']), false);
});

test('does not throw on malformed or wrong-length signature headers', () => {
  assert.equal(signatureMatches(body, 'sha256=short', ['main-secret']), false);
  assert.equal(signatureMatches(body, 'garbage', ['main-secret']), false);
  assert.equal(signatureMatches(body, '', ['main-secret']), false);
});

test('skips empty/undefined secrets safely', () => {
  assert.equal(signatureMatches(body, sign('ig-secret'), [undefined, '', 'ig-secret']), true);
  assert.equal(signatureMatches(body, sign('main-secret'), []), false);
});
