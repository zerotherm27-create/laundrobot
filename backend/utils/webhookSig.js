const crypto = require('crypto');

// Verifies Meta's X-Hub-Signature-256 header against every configured app
// secret. Instagram DM webhooks can arrive signed by the companion Instagram
// app (laundrobot-IG) rather than the main app, so single-secret verification
// silently 403'd all IG messages. timingSafeEqual throws on length mismatch,
// so each comparison is guarded.
function signatureMatches(rawBody, sig, secrets) {
  if (!sig) return false;
  const sigBuf = Buffer.from(sig);
  return (secrets || []).some(secret => {
    if (!secret) return false;
    const expected = Buffer.from(
      'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex')
    );
    return sigBuf.length === expected.length && crypto.timingSafeEqual(sigBuf, expected);
  });
}

module.exports = { signatureMatches };
