const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

// ── Regression: reminders must be per BOOKING, not per order row ─────────────
// A multi-item booking (e.g. BKG-000109: 5 rows, ₱3,065 grand total) used to
// get one reminder PER ROW, each showing only that row's price (the customer
// saw "Pay ₱1,000" for a ₱3,065 booking) and a row UUID instead of the
// booking ref. Reminders must show the booking ref and the grand total
// (SUM(price) + delivery_fee − promo_discount across the ref).

const { buildMessage } = require('./followup');

const bookingGroup = {
  ref: 'BKG-000109',
  total: '3065',
  customer_name: 'Elicha',
  service_name: 'Stuffed Toy, Bolster Pillow, Sofa Cover & Seat Cover',
  pickup_date: 'Jul 2, 5:00 PM',
  is_dropoff: false,
};

test('reminder message shows the booking ref, not a row UUID', () => {
  for (const n of [1, 2, 3, 4]) {
    const msg = buildMessage(n, bookingGroup, 'https://pay.example/x');
    assert.match(msg, /BKG-000109/, `reminder #${n} must reference the booking ref`);
    assert.doesNotMatch(msg, /undefined/, `reminder #${n} must not leak undefined fields`);
  }
});

test('reminder message shows the grand total across all rows in the booking', () => {
  for (const n of [1, 2, 3, 4]) {
    const msg = buildMessage(n, bookingGroup, null);
    assert.match(msg, /₱3065\.00/, `reminder #${n} must show the booking grand total`);
  }
});

test('drop-off reminder also uses ref and grand total', () => {
  const msg = buildMessage(4, { ...bookingGroup, is_dropoff: true }, null);
  assert.match(msg, /BKG-000109/);
  assert.match(msg, /₱3065\.00/);
});

// ── Static guards on the job's SQL ───────────────────────────────────────────
// The reminder and auto-cancel queries must aggregate rows by booking_ref
// (falling back to the row id for single-row orders) and updates keyed on the
// ref must be tenant-scoped — booking refs are only unique PER TENANT.

const src = fs.readFileSync(path.join(__dirname, 'followup.js'), 'utf8');

test('follow-up queries group order rows by booking_ref', () => {
  const groupBys = src.match(/GROUP BY[^`]*?COALESCE\(o\.booking_ref, o\.id::text\)/g) || [];
  assert.ok(
    groupBys.length >= 2,
    'both the auto-cancel and reminder queries must GROUP BY COALESCE(o.booking_ref, o.id::text)'
  );
});

test('updates keyed on the booking ref are tenant-scoped', () => {
  const updates = src.match(/UPDATE orders[^`]*COALESCE\(booking_ref, id::text\)[^`]*/g) || [];
  assert.ok(updates.length >= 3, 'expected the ref-keyed UPDATE statements (cancel, invoice url, reminder count)');
  for (const u of updates) {
    assert.match(u, /tenant_id\s*=\s*\$\d/, `ref-keyed UPDATE must also filter by tenant_id:\n${u}`);
  }
});

test('grand total includes delivery fee and promo discount', () => {
  assert.match(
    src,
    /SUM\(o\.price\)\s*\+\s*SUM\(COALESCE\(o\.delivery_fee,\s*0\)\)\s*-\s*SUM\(COALESCE\(o\.promo_discount,\s*0\)\)/,
    'reminder total must be SUM(price) + SUM(delivery_fee) − SUM(promo_discount)'
  );
});
