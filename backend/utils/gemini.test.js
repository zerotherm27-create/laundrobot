const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

// ── Regression: AI must not invent payment policy or ignore active bookings ──
// Soaphie told a customer "you can pay cash to our staff when they pick up
// your items" (no such policy — full payment is required BEFORE pickup is
// arranged) and kept saying "type 'book' to get started" to a customer who
// had already booked. The system prompt must carry the payment policy and the
// customer's active bookings so follow-up questions are answered in context.

const { formatActiveBookings } = require('./gemini');

const bookings = [
  {
    ref: 'BKG-000109',
    services: 'Bolster Pillow, Sofa Cover & Seat Cover, Stuffed Toy',
    total: '3065',
    status: 'NEW ORDER',
    paid: false,
    is_dropoff: false,
    pickup_date: '2026-07-02T17:00:00+08:00',
  },
];

test('active booking line shows ref, grand total, and unpaid status', () => {
  const out = formatActiveBookings(bookings);
  assert.match(out, /BKG-000109/);
  assert.match(out, /₱3,065/);
  assert.match(out, /NOT YET PAID/);
  assert.doesNotMatch(out, /undefined/);
});

test('paid booking is labelled PAID, not NOT YET PAID', () => {
  const out = formatActiveBookings([{ ...bookings[0], paid: true }]);
  assert.match(out, /PAID/);
  assert.doesNotMatch(out, /NOT YET PAID/);
});

test('no active bookings → empty string (section omitted from prompt)', () => {
  assert.equal(formatActiveBookings([]), '');
  assert.equal(formatActiveBookings(null), '');
});

// ── Static guards on the prompt source ───────────────────────────────────────

const src = fs.readFileSync(path.join(__dirname, 'gemini.js'), 'utf8');

test('system prompt carries an explicit payment policy', () => {
  assert.match(src, /PAYMENT POLICY/, 'prompt must have a PAYMENT POLICY section');
  assert.match(src, /cash on pickup|cash upon pickup/i, 'policy must explicitly rule out cash on pickup');
  assert.match(src, /full payment/i, 'policy must require full payment before pickup is arranged');
});

test('system prompt tells the AI how to treat customers with active bookings', () => {
  assert.match(src, /ACTIVE BOOKINGS/, 'prompt must inject active bookings');
  assert.match(
    src,
    /do NOT tell them to type 'book'|don't tell them to type 'book'/i,
    "AI must not push 'book' at customers who already booked"
  );
});

test('active bookings query groups rows per booking and excludes terminal statuses', () => {
  assert.match(src, /COALESCE\(o\.booking_ref, o\.id::text\)/, 'must group by booking_ref (per-booking, not per-row)');
  assert.match(src, /NOT IN \('CANCELLED',\s*'COMPLETED'\)/, 'must only surface active orders');
});

test('prompt surfaces a recently auto-cancelled unpaid booking so the AI can explain it', () => {
  assert.match(src, /RECENTLY CANCELLED BOOKING/, 'prompt must carry the cancelled-booking section');
  assert.match(src, /status = 'CANCELLED' AND o\.paid = FALSE/, 'must look up unpaid cancelled bookings');
});
