const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

// ── Guard against the malformed aggregate-FILTER pattern ─────────────────────
// Postgres requires `SUM(expr) FILTER (WHERE ...)` — the FILTER clause must
// follow the aggregate's CLOSING paren. Writing `SUM((expr) FILTER (...))`
// pushes FILTER inside the argument and is a syntax error (42601). This bug
// shipped once in referrals.js (revenue query) and silently 500'd the route,
// which blanked the Settings page because its loader used Promise.all.
// This test scans every route file so it can never recur unnoticed.

const AGGREGATES = ['SUM', 'COUNT', 'AVG', 'MIN', 'MAX', 'ARRAY_AGG', 'STRING_AGG', 'JSONB_AGG', 'BOOL_OR', 'BOOL_AND'];

/**
 * Returns true if `sql` contains an aggregate call whose FILTER clause sits
 * INSIDE the aggregate's argument parentheses (the malformed form).
 */
function hasMalformedAggregateFilter(sql) {
  const upper = sql.toUpperCase();
  const aggRe = new RegExp(`\\b(${AGGREGATES.join('|')})\\s*\\(`, 'g');
  let m;
  while ((m = aggRe.exec(upper)) !== null) {
    // Position just after the aggregate's opening paren
    let i = m.index + m[0].length;
    let depth = 1; // we're inside the aggregate's argument list
    while (i < upper.length && depth > 0) {
      const ch = upper[i];
      if (ch === '(') depth++;
      else if (ch === ')') depth--;
      else if (depth > 0 && upper.startsWith('FILTER', i)) {
        // FILTER seen while still inside the aggregate's parens → malformed
        // (depth === 1 with the next non-space being FILTER right after the
        //  argument is fine ONLY when it's after the close; here depth>0 means
        //  we have not closed the aggregate yet)
        return true;
      }
      i++;
    }
  }
  return false;
}

test('detector flags the known-bad pattern (would have caught the referrals bug)', () => {
  const bad = `COALESCE(
    SUM((o.price + COALESCE(o.delivery_fee,0) - COALESCE(o.promo_discount,0))
        FILTER (WHERE o.paid = TRUE AND o.status != 'CANCELLED')),
  0)`;
  assert.equal(hasMalformedAggregateFilter(bad), true);
});

test('detector accepts the correct pattern (FILTER after aggregate close)', () => {
  const good = `COALESCE(
    SUM(o.price + COALESCE(o.delivery_fee,0) - COALESCE(o.promo_discount,0))
        FILTER (WHERE o.paid = TRUE AND o.status != 'CANCELLED'),
  0)`;
  assert.equal(hasMalformedAggregateFilter(good), false);
});

test('detector accepts COUNT(*) FILTER and window FILTER forms', () => {
  assert.equal(hasMalformedAggregateFilter(`COUNT(*) FILTER (WHERE paid)`), false);
  assert.equal(
    hasMalformedAggregateFilter(`SUM(o2.price) FILTER (WHERE o2.status = 'CANCELLED') OVER (PARTITION BY o.booking_ref)`),
    false
  );
});

test('no route file contains a malformed aggregate-FILTER clause', () => {
  const routesDir = __dirname;
  const files = fs.readdirSync(routesDir).filter(f => f.endsWith('.js') && !f.endsWith('.test.js'));
  const offenders = [];
  for (const f of files) {
    const sql = fs.readFileSync(path.join(routesDir, f), 'utf8');
    if (hasMalformedAggregateFilter(sql)) offenders.push(f);
  }
  assert.deepEqual(offenders, [], `Malformed SUM((expr) FILTER(...)) found in: ${offenders.join(', ')}`);
});
