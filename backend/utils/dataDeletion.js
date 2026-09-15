const crypto = require('crypto');

function base64UrlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return Buffer.from(str, 'base64');
}

// Verifies and decodes Meta's signed_request parameter, used by both the
// Deauthorize and Data Deletion Request callbacks:
// https://developers.facebook.com/docs/development/create-an-app/app-dashboard/data-deletion-callback
// Format is "<base64url sig>.<base64url payload>", HMAC-SHA256 of the
// payload segment keyed by the app secret. Returns the decoded payload
// object, or null if malformed or signed by none of the given secrets.
function parseSignedRequest(signedRequest, secrets) {
  if (!signedRequest || typeof signedRequest !== 'string') return null;
  const [encodedSig, encodedPayload] = signedRequest.split('.');
  if (!encodedSig || !encodedPayload) return null;

  let payload;
  try {
    payload = JSON.parse(base64UrlDecode(encodedPayload).toString('utf8'));
  } catch {
    return null;
  }
  if (payload.algorithm !== 'HMAC-SHA256') return null;

  const sigBuf = base64UrlDecode(encodedSig);
  const matches = (secrets || []).some(secret => {
    if (!secret) return false;
    const expected = crypto.createHmac('sha256', secret).update(encodedPayload).digest();
    return sigBuf.length === expected.length && crypto.timingSafeEqual(sigBuf, expected);
  });
  return matches ? payload : null;
}

module.exports = { parseSignedRequest, base64UrlDecode };
