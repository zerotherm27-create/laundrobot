const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

// ── One definition of revenue across Overview, Reports and Finance ──────────
// Found 2026-09-26 on The Laundry Project: the three pages disagreed (₱45,879 / ₱55,941 / ₱93,110 for "this month")
// because each used its own rules, AND Finance dropped every auto-archived order (the monthly cron archives all
// COMPLETED orders), erasing ~80% of past months. Revenue = paid, not cancelled, price + delivery_fee − promo_discount.

const finance = fs.readFileSync(path.join(__dirname, 'finance.js'), 'utf8');
const tenants = fs.readFileSync(path.join(__dirname, 'tenants.js'), 'utf8');
// Strip comments so the explanatory text about "archived" doesn't trip the checks
const code = finance.replace(/\/\/.*$/gm, '');

test('finance queries never filter on archived (auto-archive is housekeeping); only soft-deleted orders are excluded', () => {
  assert.doesNotMatch(code, /archived\s*=|archived\s+IS\s+NULL|\.archived\b/i);
  assert.ok((code.match(/deleted_by IS NULL/g) || []).length >= 15, 'every finance order query must exclude soft-deleted rows');
});

test('revenue uses the shared NET expression (price + delivery − discount, paid, not cancelled)', () => {
  assert.match(finance, /const NET = "CASE WHEN paid AND status != 'CANCELLED' THEN price \+ COALESCE\(delivery_fee,0\) - COALESCE\(promo_discount,0\) ELSE 0 END"/);
  assert.ok((finance.match(/\$\{NET\}/g) || []).length >= 4, 'dashboard, breakeven, projections (x2) must use NET');
  assert.doesNotMatch(code, /THEN price ELSE 0 END\), 0\)::numeric AS revenue/);
});

test('dashboard supports day/week/month/year/all in Asia/Manila and returns null expenses for day/week', () => {
  const route = finance.slice(finance.indexOf("router.get('/dashboard'"), finance.indexOf("router.get('/sales-detail'"));
  for (const p of ['day', 'week', 'month', 'year', 'all']) assert.ok(route.includes(`'${p}'`), `period ${p}`);
  assert.match(finance, /const MNL = .*Asia\/Manila/);   // Manila wall-clock time
  assert.match(route, /\$\{MNL\}/);
  assert.match(route, /manilaToday\(\)/);
  assert.match(route, /let expenses = null;/);
  assert.match(route, /WHERE tenant_id = \$1/);
  assert.match(route, /bookingCount/);
});

test('sales-detail is tenant-scoped, excludes soft-deleted, includes archived history, and is capped', () => {
  const route = finance.slice(finance.indexOf("router.get('/sales-detail'"), finance.indexOf('// GET /finance/pricing-guide'));
  assert.match(route, /o\.tenant_id = \$1 AND o\.deleted_by IS NULL/);
  assert.match(route, /LIMIT 20000/);
  assert.match(route, /firstOrders/);
  assert.doesNotMatch(route.replace(/\/\/.*$/gm, ''), /archived/i);
});

test('superadmin shop totals use the same revenue definition', () => {
  assert.match(tenants, /o\.price \+ COALESCE\(o\.delivery_fee,0\) - COALESCE\(o\.promo_discount,0\)/);
  assert.match(tenants, /LEFT JOIN orders o ON o\.tenant_id = t\.id AND o\.deleted_by IS NULL/);
});

test('frontend revenue helper matches the SQL definition', async () => {
  const m = await import('../../frontend/src/utils/revenue.js');
  const row = (o) => ({ price: 100, delivery_fee: 20, promo_discount: 5, paid: true, status: 'COMPLETED', ...o });
  assert.equal(m.rowNet(row()), 115);
  assert.equal(m.rowRevenue(row()), 115);
  assert.equal(m.rowRevenue(row({ paid: false })), 0, 'unpaid is not revenue');
  assert.equal(m.rowRevenue(row({ status: 'CANCELLED' })), 0, 'cancelled is not revenue');
  assert.equal(m.rowRevenue(row({ delivery_fee: null, promo_discount: null })), 100);
  // Manila calendar boundaries: 16:30 UTC on the 25th is 00:30 on the 26th in Manila
  assert.equal(m.orderManilaDate({ created_at: '2026-09-25T16:30:00Z' }), '2026-09-26');
  assert.deepEqual(m.periodRange('week', '2026-09-26'), { from: '2026-09-20', to: '2026-09-26', label: '2026-09-20 to 2026-09-26' });
  assert.equal(m.periodRange('month', '2026-09-26').to, '2026-09-30');
  assert.equal(m.periodRange('month', '2026-02-10').to, '2026-02-28');
  assert.deepEqual([m.periodRange('year', '2026-09-26').from, m.periodRange('year', '2026-09-26').to], ['2026-01-01', '2026-12-31']);
});

// ── Cost of goods must be cost per unit × UNITS SOLD, for paid non-cancelled orders ─────────────────────────
// It used to be cost_per_unit once per paid order (cancelled included), so 35 ironed pieces in 7 orders cost 7 units,
// and the dashboard's Net Profit ignored it while Monthly Summary subtracted it.
test('COGS = cost_per_unit × units sold (quantity from the service\'s Number field), paid and not cancelled only', () => {
  assert.match(finance, /const UNITS = `COALESCE\(/);
  assert.match(finance, /jsonb_array_elements\(CASE WHEN jsonb_typeof\(o\.custom_selections\) = 'array'/);
  assert.match(finance, /f\.field_type = 'number'/);
  assert.match(finance, /const COGS_ROW = `CASE WHEN o\.paid AND o\.status != 'CANCELLED' THEN COALESCE\(s\.cost_per_unit, 0\) \* \$\{UNITS\} ELSE 0 END`/);
  assert.doesNotMatch(finance, /CASE WHEN o\.paid THEN COALESCE\(s\.cost_per_unit,0\) ELSE 0 END/, 'old once-per-order paid-only COGS must be gone');
  const summary = finance.slice(finance.indexOf("router.get('/monthly-summary'"), finance.indexOf("router.get('/targets'"));
  assert.match(summary, /SUM\(\$\{COGS_ROW\}\)/);
});

test('dashboard returns cogs and grossProfit for every period, and netProfit = gross profit − expenses (same as Monthly Summary)', () => {
  const route = finance.slice(finance.indexOf("router.get('/dashboard'"), finance.indexOf("router.get('/sales-detail'"));
  assert.match(route, /SUM\(\$\{COGS_ROW\}\)/);
  assert.match(route, /const grossProfit = revenue - cogs;/);
  assert.match(route, /expenses === null \? null : grossProfit - expenses/);
  assert.match(route, /cogs, grossProfit, expenses, netProfit/);
});

test('break-even variable cost and the Pricing Guide use the same unit-based cost', () => {
  const be = finance.slice(finance.indexOf("router.get('/breakeven'"), finance.indexOf("router.get('/projections'"));
  assert.match(be, /AVG\(COALESCE\(s\.cost_per_unit,0\) \* \$\{UNITS\}\) FILTER \(WHERE o\.paid AND o\.status != 'CANCELLED'\)/);
  const pg = finance.slice(finance.indexOf("router.get('/pricing-guide'"), finance.indexOf("router.put('/pricing-guide/:serviceId'"));
  assert.match(pg, /SUM\(\$\{UNITS\}\)/);
  assert.match(pg, /price_basis/);
  assert.match(pg, /average_sold/);
});
