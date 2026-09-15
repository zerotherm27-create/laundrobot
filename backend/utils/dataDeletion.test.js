const assert = require('node:assert/strict');
const test = require('node:test');
const crypto = require('node:crypto');

// ── Data Deletion Request callback signature verification ───────────────────
// Meta's signed_request format: "<base64url sig>.<base64url payload>", HMAC-SHA256
// of the payload segment keyed by the app secret. Must accept either configured
// app secret (main + companion IG app, same reasoning as utils/webhookSig.js)
// and must not throw on malformed input from an unauthenticated POST body.

const { parseSignedRequest, base64UrlDecode } = require('./dataDeletion');

function base64UrlEncode(buf) {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function sign(payloadObj, secret) {
  const encodedPayload = base64UrlEncode(Buffer.from(JSON.stringify(payloadObj)));
  const sig = crypto.createHmac('sha256', secret).update(encodedPayload).digest();
  return `${base64UrlEncode(sig)}.${encodedPayload}`;
}

const payload = { algorithm: 'HMAC-SHA256', issued_at: 1700000000, user_id: 'psid-123' };

test('decodes and verifies a signed_request from the primary app secret', () => {
  const signedRequest = sign(payload, 'main-secret');
  const result = parseSignedRequest(signedRequest, ['main-secret', 'ig-secret']);
  assert.deepEqual(result, payload);
});

test('accepts a signed_request from the secondary (Instagram app) secret', () => {
  const signedRequest = sign(payload, 'ig-secret');
  const result = parseSignedRequest(signedRequest, ['main-secret', 'ig-secret']);
  assert.deepEqual(result, payload);
});

test('rejects a signature from an unknown secret', () => {
  const signedRequest = sign(payload, 'attacker-secret');
  assert.equal(parseSignedRequest(signedRequest, ['main-secret', 'ig-secret']), null);
});

test('rejects a payload claiming a different algorithm', () => {
  const signedRequest = sign({ ...payload, algorithm: 'HMAC-SHA1' }, 'main-secret');
  assert.equal(parseSignedRequest(signedRequest, ['main-secret']), null);
});

test('does not throw on malformed, empty, or missing input', () => {
  assert.equal(parseSignedRequest('garbage', ['main-secret']), null);
  assert.equal(parseSignedRequest('', ['main-secret']), null);
  assert.equal(parseSignedRequest(undefined, ['main-secret']), null);
  assert.equal(parseSignedRequest('a.b', ['main-secret']), null);
  assert.equal(parseSignedRequest(sign(payload, 'main-secret'), []), null);
});

test('base64UrlDecode round-trips standard base64url payloads', () => {
  const encoded = base64UrlEncode(Buffer.from('hello world'));
  assert.equal(base64UrlDecode(encoded).toString('utf8'), 'hello world');
});
