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
