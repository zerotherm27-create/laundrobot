const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

// ── Booking edit must re-flag paid status when the total goes up ────────────
// PUT /orders/booking/:ref used to leave `paid` untouched on existing rows
// and copy `first.paid` (the pre-edit status) onto any newly-added item. If a
// booking was already paid and an admin added an item or otherwise raised the
// total, every row — old and new — stayed `paid = TRUE`, so Kanban/order-status
// kept showing "Paid" even though a new balance was now owed. A Xendit invoice
// link was still generated and messaged to the customer, but nothing in the
// dashboard reflected the unpaid balance.

const ordersSrc = fs.readFileSync(path.join(__dirname, 'orders.js'), 'utf8');
const editBlock = ordersSrc.split("router.put('/booking/:ref'")[1]?.split("\nrouter.")[0] || '';

test('booking edit route exists and computes a booking-total diff', () => {
  assert.notEqual(editBlock, '', 'PUT /booking/:ref handler must be present');
});

test('booking edit marks the booking unpaid when payments no longer cover the total', () => {
  assert.match(
    editBlock,
    /paid\s*=\s*FALSE/,
    'must flip paid to FALSE somewhere in the handler when a balance is owed'
  );
  // The paid=FALSE update must be gated on an actual outstanding balance, not
  // unconditional (an edit fully covered by prior payments must not touch paid).
  const updateGate = editBlock.split(/paid\s*=\s*FALSE/)[0].split('\n').slice(-6).join('\n');
  assert.match(
    updateGate,
    /balance\s*>\s*0/,
    'the paid=FALSE update must be conditioned on balance > 0'
  );
});

// ── Balance-aware billing (BKG-000131 incident, 2026-07-14) ─────────────────
// A customer paid ₱3,600 on the original invoice; two admin edits later the
// route (which diffed totals between edits) generated no link and the manual
// payment-link route billed the FULL total again. Billing must always be
// grand total − amount actually paid, backed by the booking_payments ledger.

test('booking edit computes the customer ask from the payments ledger, not a total diff', () => {
  assert.match(editBlock, /booking_payments/,
    'edit route must read booking_payments to know what was actually paid');
  assert.match(editBlock, /editedTotal\s*-\s*amountPaid/,
    'balance must be grand total minus amount paid');
  // The Xendit invoice must be created for the balance, not the total diff.
  const invoiceBlock = editBlock.slice(editBlock.indexOf('createInvoice'));
  assert.match(invoiceBlock, /amount:\s*balance/,
    'the adjustment invoice amount must be the outstanding balance');
});

test('booking edit totals include delivery_fee and promo_discount (grand-total formula)', () => {
  // orders.price is the service subtotal only; every total in the edit route
  // must add delivery_fee and subtract promo_discount (see orderPrice.js).
  assert.match(editBlock, /delivery_fee/,
    'edit route totals must include delivery_fee');
  assert.match(editBlock, /promo_discount/,
    'edit route totals must include promo_discount');
});

test('booking edit expires the stale payment link before issuing the new one', () => {
  assert.match(editBlock, /expireInvoice/,
    'the previous pending invoice must be voided so the customer cannot pay a stale amount');
});

test('the payment-link route subtracts ledger payments from the amount billed', () => {
  const linkBlock = ordersSrc.split("'/:id/payment-link'")[1]?.split("\nrouter.")[0] || '';
  assert.notEqual(linkBlock, '', 'POST /:id/payment-link handler must be present');
  assert.match(linkBlock, /booking_payments/,
    'payment-link route must consult the booking_payments ledger');
  assert.match(linkBlock, /rowsTotal\s*-\s*Number\(ledger_paid\)/,
    'billed total must be unpaid rows minus ledger payments');
});

test('verify-payment records the payment in the ledger and nets it against the balance', () => {
  const verifyBlock = ordersSrc.split("'/:id/verify-payment'")[1]?.split("\nrouter.")[0] || '';
  assert.notEqual(verifyBlock, '', 'POST /:id/verify-payment handler must be present');
  assert.match(verifyBlock, /INSERT INTO booking_payments/,
    'a verified payment must be written to the ledger');
  assert.match(verifyBlock, /ON CONFLICT \(xendit_invoice_id\) DO NOTHING/,
    'ledger insert must be idempotent — the webhook may already have recorded it');
  assert.match(verifyBlock, /unpaid_total\)\s*-\s*Number\(ledger_paid\)/,
    'the coverage check must net out payments already in the ledger');
});

test('the paid=FALSE update runs inside the same transaction as the item changes', () => {
  const commitIdx = editBlock.indexOf("client.query('COMMIT')");
  const paidFalseIdx = editBlock.indexOf('paid = FALSE');
  assert.ok(commitIdx > -1 && paidFalseIdx > -1 && paidFalseIdx < commitIdx,
    'paid=FALSE must be set via the transactional client before COMMIT, so a mid-edit failure cannot leave it applied without the item changes (or vice versa)');
});

test('the paid=FALSE update is scoped to the booking_ref and tenant', () => {
  const stmt = editBlock.slice(editBlock.indexOf('paid = FALSE') - 80, editBlock.indexOf('paid = FALSE') + 120);
  assert.match(stmt, /booking_ref\s*=\s*\$1/);
  assert.match(stmt, /tenant_id\s*=\s*\$2/);
});
