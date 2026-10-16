const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

// Regression tests for cross-tenant leaks found in the 2026-09-27 isolation audit.
const read = f => fs.readFileSync(path.join(__dirname, f), 'utf8');

test('public order creation only rewrites invoice URLs for ITS OWN tenant (booking_ref repeats across shops)', () => {
  const src = read('public.js');
  assert.match(src, /UPDATE orders SET xendit_invoice_url=\$1 WHERE booking_ref=\$2 AND tenant_id=\$3/);
  assert.doesNotMatch(src, /UPDATE orders SET xendit_invoice_url=\$1 WHERE booking_ref=\$2'/);
});

test('anonymous phone→address lookup is rate limited', () => {
  const src = read('public.js');
  assert.match(src, /customerLookupLimiter = rateLimit\(/);
  assert.match(src, /router\.get\('\/:tenantId\/customer', customerLookupLimiter/);
});

test('inventory stock-in/out reject items that belong to another tenant and never echo them back', () => {
  const src = read('inventory.js');
  assert.equal((src.match(/SELECT 1 FROM inventory_items WHERE id=\$1 AND tenant_id=\$2/g) || []).length, 2);
  assert.equal((src.match(/FROM inventory_items WHERE id=\$1 AND tenant_id=\$2`,\s*\[item_id, tid\]/g) || []).length, 4);
  assert.doesNotMatch(src, /FROM inventory_items WHERE id=\$1`/);
});

test('confirm-qr-payment only reads service names from the caller\'s own tenant', () => {
  const src = read('orders.js');
  assert.match(src, /WHERE o\.booking_ref=\$1 AND o\.tenant_id=\$2`,\s*\[bookingRef, order\.tenant_id\]/);
});

// ── Booking confirmation wording (Messenger) ───────────────────────────────
// With a Pay Now button attached, "We'll be in touch to confirm your pickup" implied nothing was needed
// from the customer. Ask them to pay; keep the old line only when there is no payment link.
test('pickup confirmation asks the customer to settle payment when a Pay Now link exists', () => {
  const src = read('public.js');
  const block = src.slice(src.indexOf("`✅ Booking Confirmed!"), src.indexOf('if (paymentUrl) {'));
  assert.match(block, /qrUrl\s*\?\s*`Please scan the QR code and upload your payment screenshot/);
  assert.match(block, /: paymentUrl\s*[\s\S]*?Kindly settle your payment using the "Pay Now" button below so we can arrange your pickup/);
  assert.match(block, /: `We'll be in touch to confirm your pickup\./);
  // the "kindly settle" line must come before the generic fallback
  assert.ok(block.indexOf('Kindly settle') < block.indexOf("We'll be in touch to confirm your pickup."));
});

// ── Cart reminders must stop once the same person books ──
// A cart started in Messenger (keyed by PSID) was left unconverted when the booking was
// finished in a browser with no PSID / matched to an older customer row, so "complete your
// booking" reminders kept firing after the customer had booked and paid (BKG-000302).
test('public order creation converts carts of any same-shop customer with the same phone or email', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const src = fs.readFileSync(path.join(__dirname, 'public.js'), 'utf8');
  const stmt = src.split("UPDATE carts SET converted=TRUE, converted_at=NOW()")[1]?.split('.catch')[0] || '';
  assert.ok(stmt, 'order creation must run the phone/email cart-conversion UPDATE');
  assert.match(stmt, /tenant_id=\$1 AND converted=FALSE/, 'must be tenant-scoped and only touch open carts');
  assert.match(stmt, /fb_user_id IN \(\s*SELECT fb_id FROM customers\s*WHERE tenant_id=\$1/, 'customer lookup must also be tenant-scoped');
  assert.match(stmt, /phone=\$2/);
  assert.match(stmt, /lower\(email\)=\$3/);
});

// ── A phone match must never hand a web booking someone else's Messenger identity ──
// BKG-000302: booked in a browser (no PSID); the phone-only lookup attached it to an old chat
// contact's customer row, so payment/COMPLETED messages went to a stranger. Shops also let
// customers without a local number use the shop's own number, so that number must not match
// on phone alone.
test('public order customer lookup (no fb_id) only matches web-only customers and is safe for the shop number', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const src = fs.readFileSync(path.join(__dirname, 'public.js'), 'utf8');
  const branch = src.split('Phone alone must never hand a booking')[1]?.split("if (existing)")[0] || '';
  assert.ok(branch, 'no-fb_id customer lookup must exist');
  assert.match(branch, /tenant_id=\$1 AND phone=\$2 AND fb_id IS NULL/, 'must only match customers without a Messenger identity, tenant-scoped');
  assert.match(branch, /ORDER BY created_at LIMIT 1/, 'must be deterministic');
  assert.match(branch, /contact_number/, 'must detect the shop\'s own number used as a placeholder');
  assert.match(branch, /lower\(email\)=\$4/, 'shop-number bookings must also match on email');
});

test('cart conversion ignores the shop\'s own number as an identity (email only)', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const src = fs.readFileSync(path.join(__dirname, 'public.js'), 'utf8');
  const block = src.split('belonging to any customer of this shop with the same phone or email')[1]?.split('// Messenger confirmation to customer')[0] || '';
  assert.match(block, /contact_number/);
  assert.match(block, /orderPhone = null/);
});
