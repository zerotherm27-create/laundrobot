const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

const src = fs.readFileSync(path.join(__dirname, 'xendit.js'), 'utf8');

// A tenant knows the shared callback token, so the body of a "sub-…" callback must never be trusted:
// the plan, description and paid status come from the invoice re-fetched with the PLATFORM key.
test('subscription callbacks are verified against the platform Xendit account', () => {
  const sub = src.slice(src.indexOf("startsWith('sub-')"), src.indexOf('// Strip the "-MANUAL-'));
  assert.match(sub, /XENDIT_PLATFORM_API_KEY/);
  assert.match(sub, /getInvoiceStatus\(platformKey, xenditInvoiceId\)/);
  assert.match(sub, /verified\.external_id !== external_id/);
  assert.match(sub, /const desc = verified\.description/);
  assert.doesNotMatch(sub, /req\.body\.description/);
});

test('forged/foreign subscription invoices (404) are dropped without retry; transient errors ask Xendit to retry', () => {
  const sub = src.slice(src.indexOf("startsWith('sub-')"), src.indexOf('// Strip the "-MANUAL-'));
  assert.match(sub, /status === 404[\s\S]*?res\.sendStatus\(200\)/);
  assert.match(sub, /verification failed, asking Xendit to retry[\s\S]*?res\.sendStatus\(500\)/);
});

// booking_ref is unique per tenant only — the old code took `WHERE booking_ref=$1 LIMIT 1` across all shops.
test('booking payments resolve the owning tenant safely and never apply an ambiguous ref', () => {
  assert.match(src, /resolveBookingTenant\(db, refId, xenditInvoiceId, getInvoiceStatus\)/);
  assert.match(src, /resolved\.reason === 'ambiguous'/);
  assert.doesNotMatch(src, /SELECT tenant_id FROM orders WHERE booking_ref=\$1 LIMIT 1/);
});

test('payment notifications for a booking ref are scoped to the resolved tenant', () => {
  assert.match(src, /o\.booking_ref=\$1 AND o\.tenant_id=\$2/);
  assert.match(src, /isBkgRef \? \[refId, bookingTenantId\] : \[refId\]/);
});
