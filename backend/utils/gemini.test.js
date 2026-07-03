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

test('base prompt defers payment policy to shop-specific instructions, never invents one', () => {
  assert.match(src, /Payment policies differ per shop/, 'prompt must state payment policy is per-shop');
  assert.match(
    src,
    /never confirm a customer's own assumption/i,
    "AI must not confirm assumptions like 'I can pay cash on pickup, right?'"
  );
  // Payment rules are tenant-specific (ai_instructions), NOT platform-wide:
  // the base prompt must not hardcode a no-cash-on-pickup (or any) policy.
  assert.doesNotMatch(src, /NO cash on pickup/i, 'no hardcoded platform-wide cash policy');
  assert.doesNotMatch(src, /Full payment is required BEFORE/i, 'no hardcoded platform-wide prepayment policy');
});

test('shop ai_instructions cap fits long tenant policies (TLP is >2200 chars)', () => {
  const m = src.match(/\.slice\(0,\s*(\d+)\)/);
  assert.ok(m, 'ai_instructions must be length-capped');
  assert.ok(Number(m[1]) >= 4000, `cap must be >= 4000 chars, got ${m[1]} — TLP's instructions were silently truncated at 2000`);
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

test('AI service list excludes walk-in-only services', () => {
  assert.match(
    src,
    /FROM services WHERE tenant_id=\$1 AND active=TRUE AND available_online=TRUE/,
    'buildShopContext must not feed walk-in-only (available_online=FALSE) services to the AI'
  );
});

test('prompt surfaces a recently auto-cancelled unpaid booking so the AI can explain it', () => {
  assert.match(src, /RECENTLY CANCELLED BOOKING/, 'prompt must carry the cancelled-booking section');
  assert.match(src, /status = 'CANCELLED' AND o\.paid = FALSE/, 'must look up unpaid cancelled bookings');
});
