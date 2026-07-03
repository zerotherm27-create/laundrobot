const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const jwt = require('jsonwebtoken');

// ── Branch switching must not shorten (or crash) the session ────────────────
// switch-branch re-issued tokens with { ...req.user } + expiresIn: '24h'.
// Two bugs: (1) req.user still carries iat/exp from jwt.verify, and
// jsonwebtoken v9 THROWS when a payload has exp AND options.expiresIn — so
// switching always 500'd; (2) even conceptually, hardcoding 24h downgraded a
// 30-day "keep me logged in" session to one day. The fix strips iat and
// carries the ORIGINAL absolute exp forward, so switching branches never
// changes when the session ends.

test('re-signing with original exp preserved works and keeps the expiry', () => {
  const secret = 'test-secret';
  const original = jwt.sign({ id: 'u1', tenant_id: 'a' }, secret, { expiresIn: '30d' });
  const decoded = jwt.verify(original, secret);

  // The pattern the route must use: drop iat, keep exp, no expiresIn option
  const { iat, ...claims } = decoded;
  const switched = jwt.sign({ ...claims, tenant_id: 'b' }, secret);
  const reDecoded = jwt.verify(switched, secret);

  assert.equal(reDecoded.exp, decoded.exp, 'absolute expiry must survive the switch');
  assert.equal(reDecoded.tenant_id, 'b');
});

const src = fs.readFileSync(path.join(__dirname, 'auth.js'), 'utf8');

test('switch-branch does not hardcode a 24h downgrade', () => {
  const block = src.split("'/switch-branch'")[1] || src.split('"/switch-branch"')[1] || '';
  assert.ok(block, 'switch-branch route must exist');
  assert.doesNotMatch(block, /expiresIn:\s*'24h'/, 'must not re-issue with a hardcoded 24h expiry');
  assert.match(block, /const \{ iat[^}]*\} = req\.user/, 'must strip iat and preserve exp from the original token');
});
