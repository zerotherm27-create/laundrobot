const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

// ── Xendit webhook must track payment AMOUNTS, not just flip a flag ─────────
// BKG-000131 incident (2026-07-14): a ₱3,600 payment vanished the moment an
// admin edit reset paid=FALSE, because nothing recorded how much was paid.
// The webhook now writes every payment to booking_payments and only marks a
// booking paid when the ledger covers the current grand total.

const src = fs.readFileSync(path.join(__dirname, 'xendit.js'), 'utf8');

test('webhook records every booking payment in the ledger', () => {
  assert.match(src, /INSERT INTO booking_payments/,
    'PAID callbacks must insert into booking_payments');
  assert.match(src, /ON CONFLICT \(xendit_invoice_id\) DO NOTHING/,
    'insert must be idempotent — Xendit retries callbacks');
});

test('webhook only marks a booking paid when payments cover the grand total', () => {
  assert.match(src, /total_paid.*>=.*total_due|Number\(total_paid\)\s*>=\s*Number\(total_due\)/s,
    'paid=TRUE must be gated on SUM(ledger) >= grand total');
  // The grand total must use the full formula, cancelled rows excluded.
  const dueQuery = src.slice(src.indexOf('AS total_due') - 300, src.indexOf('AS total_due'));
  assert.match(dueQuery, /delivery_fee/, 'total_due must include delivery_fee');
  assert.match(dueQuery, /promo_discount/, 'total_due must subtract promo_discount');
  assert.match(dueQuery, /CANCELLED/, 'total_due must exclude cancelled rows');
});

test('a partial payment silences reminders but leaves the booking unpaid', () => {
  assert.match(src, /partial payment/i, 'partial branch must exist');
  const partialBranch = src.slice(src.indexOf('// Partial payment'), src.indexOf('// Partial payment') + 400);
  assert.match(partialBranch, /reminder_count=99/,
    'partial payments must stop the reminder/auto-cancel pipeline from re-billing');
  assert.doesNotMatch(partialBranch, /paid=TRUE/,
    'partial payments must NOT mark the booking paid');
});

// The follow-up job must never auto-cancel or re-remind a partially-paid booking.
const followupSrc = fs.readFileSync(path.join(__dirname, '..', 'jobs', 'followup.js'), 'utf8');

test('follow-up job skips bookings with ledger payments', () => {
  const guards = followupSrc.match(/NOT EXISTS\s*\(\s*SELECT 1 FROM booking_payments/g) || [];
  assert.ok(guards.length >= 2,
    'both the auto-cancel and reminder queries must exclude bookings with recorded payments');
});
