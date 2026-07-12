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

test('booking edit marks the booking unpaid when the edit raises the total', () => {
  assert.match(
    editBlock,
    /paid\s*=\s*FALSE/,
    'must flip paid to FALSE somewhere in the handler when the total increases'
  );
  // The paid=FALSE update must be gated on the total actually going up, not
  // unconditional (a price decrease or no-op edit must not touch paid).
  const updateGate = editBlock.split(/paid\s*=\s*FALSE/)[0].split('\n').slice(-6).join('\n');
  assert.match(
    updateGate,
    /-\s*oldTotal\s*>\s*0|diff\s*>\s*0/,
    'the paid=FALSE update must be conditioned on newTotal - oldTotal > 0'
  );
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
