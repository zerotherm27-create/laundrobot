const router = require('express').Router();
const auth = require('../middleware/auth');
const db = require('../db');

// ── Single definition of revenue (Option A) ─────────────────────────────────────────────────────────
// Revenue = money the customer paid on orders that were not cancelled: price + delivery_fee − promo_discount.
// Overview, Reports and Finance must all use this (or the /finance endpoints that do).
//   • "archived" is NOT a finance filter: the monthly cron auto-archives every COMPLETED order, so filtering it
//     would erase past months. Only soft-deleted orders (deleted_by IS NOT NULL) are excluded.
const NET = "CASE WHEN paid AND status != 'CANCELLED' THEN price + COALESCE(delivery_fee,0) - COALESCE(promo_discount,0) ELSE 0 END";
const MNL = "((created_at AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Manila')";
// ── Cost of goods ────────────────────────────────────────────────────────────────────────────────────
// COGS per order row = services.cost_per_unit × units sold. Units are not a column: they are the quantity the customer
// entered, stored in orders.custom_selections under the service's Number field (or the "weight" field for per-kg
// services); default 1. Only paid, non-cancelled rows count, exactly like revenue. Needs aliases o (orders), s (services).
// The CURRENT cost_per_unit is applied to every order, so editing a cost restates history immediately.
const UNITS = `COALESCE(
  (SELECT NULLIF(regexp_replace(cs->>'value', '[^0-9.]', '', 'g'), '')::numeric
     FROM jsonb_array_elements(CASE WHEN jsonb_typeof(o.custom_selections) = 'array' THEN o.custom_selections ELSE '[]'::jsonb END) cs
    WHERE (lower(coalesce(s.unit,'')) LIKE '%kg%' AND lower(cs->>'label') LIKE '%weight%')
       OR EXISTS (SELECT 1 FROM service_custom_fields f
                   WHERE f.service_id = o.service_id AND f.field_type = 'number'
                     AND lower(trim(f.label)) = lower(trim(cs->>'label')))
    ORDER BY (lower(cs->>'label') LIKE '%weight%') DESC
    LIMIT 1),
  NULLIF(o.weight, 0), 1)`;
const COGS_ROW = `CASE WHEN o.paid AND o.status != 'CANCELLED' THEN COALESCE(s.cost_per_unit, 0) * ${UNITS} ELSE 0 END`;   // Manila wall-clock time of an order
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const manilaToday = () => new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);
const addDays = (ymd, n) => { const d = new Date(ymd + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const lastDayOfMonth = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const pad2 = n => String(n).padStart(2, '0');

// GET /finance/dashboard
//   ?period=day|week|month|year|all   (default month)
//   day: &date=YYYY-MM-DD (default today, Manila)   week: 7 days ending &date   month: &year&month   year: &year
// All ranges are Asia/Manila calendar dates. Expenses are stored per month, so they (and net profit) are only
// returned for month/year; day/week/all return null for them.
router.get('/dashboard', auth, async (req, res) => {
  try {
    const tid = req.user.tenant_id;
    if (!tid) return res.status(400).json({ error: 'No shop selected' });
    const today = manilaToday();
    const period = ['day', 'week', 'month', 'year', 'all'].includes(req.query.period) ? req.query.period : 'month';
    const year = parseInt(req.query.year) || parseInt(today.slice(0, 4));
    const month = parseInt(req.query.month) || parseInt(today.slice(5, 7));
    if (year < 2020 || year > 2100 || month < 1 || month > 12) {
      return res.status(400).json({ error: 'Invalid year or month' });
    }
    const date = req.query.date || today;
    if (!DATE_RE.test(date)) return res.status(400).json({ error: 'Invalid date' });

    let from = null, to = null, label = 'All time';
    if (period === 'day')   { from = to = date; label = date; }
    if (period === 'week')  { to = date; from = addDays(date, -6); label = `${from} to ${to}`; }
    if (period === 'month') { from = `${year}-${pad2(month)}-01`; to = `${year}-${pad2(month)}-${pad2(lastDayOfMonth(year, month))}`; label = `${from} to ${to}`; }
    if (period === 'year')  { from = `${year}-01-01`; to = `${year}-12-31`; label = String(year); }

    const { rows: [rev] } = await db.query(
      `SELECT
        COALESCE(SUM(${NET}), 0)::numeric AS revenue,
        COALESCE(SUM(CASE WHEN paid AND status != 'CANCELLED' THEN price ELSE 0 END), 0)::numeric AS gross_sales,
        COALESCE(SUM(CASE WHEN paid AND status != 'CANCELLED' THEN COALESCE(delivery_fee,0) ELSE 0 END), 0)::numeric AS delivery_revenue,
        COALESCE(SUM(CASE WHEN paid AND status != 'CANCELLED' THEN COALESCE(promo_discount,0) ELSE 0 END), 0)::numeric AS discounts,
        COUNT(*) FILTER (WHERE paid AND status != 'CANCELLED') AS load_count,
        COUNT(DISTINCT booking_ref) FILTER (WHERE paid AND status != 'CANCELLED') AS booking_count,
        COUNT(*) FILTER (WHERE paid IS NOT TRUE AND status != 'CANCELLED') AS unpaid_count,
        COUNT(*) FILTER (WHERE status = 'CANCELLED') AS cancelled_count,
        COALESCE(SUM(CASE WHEN paid AND status = 'CANCELLED'
          THEN price + COALESCE(delivery_fee,0) - COALESCE(promo_discount,0) ELSE 0 END), 0)::numeric AS refund_total,
        COUNT(*) FILTER (WHERE paid AND status = 'CANCELLED') AS refund_count
       FROM orders
       WHERE tenant_id = $1
         AND deleted_by IS NULL
         AND ($2::date IS NULL OR DATE(${MNL}) >= $2::date)
         AND ($3::date IS NULL OR DATE(${MNL}) <= $3::date)`,
      [tid, from, to]
    );

    const { rows: [cg] } = await db.query(
      `SELECT COALESCE(SUM(${COGS_ROW}), 0)::numeric AS cogs
       FROM orders o LEFT JOIN services s ON s.id = o.service_id
       WHERE o.tenant_id = $1 AND o.deleted_by IS NULL
         AND ($2::date IS NULL OR DATE((o.created_at AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Manila') >= $2::date)
         AND ($3::date IS NULL OR DATE((o.created_at AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Manila') <= $3::date)`,
      [tid, from, to]
    );
    let expenses = null;
    if (period === 'month' || period === 'year') {
      const { rows: [exp] } = await db.query(
        `SELECT COALESCE(SUM(amount), 0)::numeric AS expenses
         FROM expenses
         WHERE tenant_id = $1 AND year = $2 AND ($3::int IS NULL OR month = $3::int)`,
        [tid, year, period === 'month' ? month : null]
      );
      expenses = parseFloat(exp?.expenses) || 0;
    }

    const revenue = parseFloat(rev?.revenue) || 0;
    const loadCount = parseInt(rev?.load_count) || 0;
    const cogs = parseFloat(cg?.cogs) || 0;
    const grossProfit = revenue - cogs;                                  // revenue − cost of goods (any period)
    const netProfit = expenses === null ? null : grossProfit - expenses; // same formula as Monthly Summary
    const profitMargin = netProfit === null ? null : (revenue > 0 ? (netProfit / revenue) * 100 : 0);
    res.json({
      period, range: { from, to, label },
      revenue, grossSales: parseFloat(rev?.gross_sales) || 0,
      deliveryRevenue: parseFloat(rev?.delivery_revenue) || 0, discounts: parseFloat(rev?.discounts) || 0,
      loadCount, bookingCount: parseInt(rev?.booking_count) || 0,
      unpaidCount: parseInt(rev?.unpaid_count) || 0, cancelledCount: parseInt(rev?.cancelled_count) || 0,
      avgRevenuePerLoad: loadCount > 0 ? revenue / loadCount : 0,
      refundTotal: parseFloat(rev?.refund_total) || 0, refundCount: parseInt(rev?.refund_count) || 0,
      cogs, grossProfit, expenses, netProfit, profitMargin,
      year, month,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /finance/sales-detail?from=YYYY-MM-DD&to=YYYY-MM-DD — every order row in the range (Manila dates), for Reports.
// Includes auto-archived orders; excludes only soft-deleted ones. `firstOrders` maps each customer in the range
// to their first-ever order time so new-vs-repeat can be worked out without loading all history.
router.get('/sales-detail', auth, async (req, res) => {
  try {
    const tid = req.user.tenant_id;
    if (!tid) return res.json({ rows: [], firstOrders: {} });
    const { from, to } = req.query;
    if (!DATE_RE.test(from || '') || !DATE_RE.test(to || '')) return res.status(400).json({ error: 'from and to (YYYY-MM-DD) are required' });
    const { rows } = await db.query(
      `SELECT o.id, o.booking_ref, o.created_at, o.customer_id, c.name AS customer_name,
              s.name AS service_name, o.price, o.delivery_fee, o.promo_discount, o.paid, o.status, o.source
       FROM orders o
       LEFT JOIN customers c ON c.id = o.customer_id
       LEFT JOIN services s ON s.id = o.service_id
       WHERE o.tenant_id = $1 AND o.deleted_by IS NULL
         AND DATE((o.created_at AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Manila') BETWEEN $2::date AND $3::date
       ORDER BY o.created_at DESC
       LIMIT 20000`,
      [tid, from, to]
    );
    const { rows: firsts } = await db.query(
      `SELECT customer_id, MIN(created_at) AS first_order
       FROM orders
       WHERE tenant_id = $1 AND deleted_by IS NULL AND customer_id IN (
         SELECT DISTINCT customer_id FROM orders
         WHERE tenant_id = $1 AND deleted_by IS NULL AND customer_id IS NOT NULL
           AND DATE((created_at AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Manila') BETWEEN $2::date AND $3::date)
       GROUP BY customer_id`,
      [tid, from, to]
    );
    const { rows: [ac] } = await db.query(
      `SELECT COUNT(DISTINCT customer_id)::int AS total FROM orders WHERE tenant_id = $1 AND deleted_by IS NULL AND customer_id IS NOT NULL`,
      [tid]
    );
    res.json({ from, to, rows, firstOrders: Object.fromEntries(firsts.map(r => [r.customer_id, r.first_order])), allTimeCustomers: ac?.total || 0 });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /finance/pricing-guide
router.get('/pricing-guide', auth, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT s.id, s.name, s.price, s.unit, s.cost_per_unit,
              c.name AS category_name,
              sold.sold_revenue, sold.sold_units
       FROM services s
       LEFT JOIN service_categories c ON c.id = s.category_id
       LEFT JOIN (
         SELECT o.service_id,
                SUM(o.price)::numeric AS sold_revenue,
                SUM(${UNITS})::numeric AS sold_units
         FROM orders o JOIN services s ON s.id = o.service_id
         WHERE o.tenant_id = $1 AND o.deleted_by IS NULL AND o.paid AND o.status != 'CANCELLED'
         GROUP BY o.service_id
       ) sold ON sold.service_id = s.id
       WHERE s.tenant_id = $1 AND s.active = TRUE
       ORDER BY s.sort_order, s.name`,
      [req.user.tenant_id]
    );
    // Services priced by option (Variation) have a list price of 0, which would make every margin negative.
    // For those, margin is measured against the average price actually sold per unit.
    const guide = rows.map(s => {
      const listPrice = parseFloat(s.price) || 0;
      const soldUnits = parseFloat(s.sold_units) || 0;
      const soldAvg = soldUnits > 0 ? (parseFloat(s.sold_revenue) || 0) / soldUnits : 0;
      const price = listPrice > 0 ? listPrice : soldAvg;
      const priceBasis = listPrice > 0 ? 'list' : (soldAvg > 0 ? 'average_sold' : 'none');
      const cost = parseFloat(s.cost_per_unit) || 0;
      const grossMargin = price - cost;
      const marginPct = price > 0 ? (grossMargin / price) * 100 : 0;
      return { id: s.id, name: s.name, unit: s.unit, category_name: s.category_name,
               list_price: listPrice, price, price_basis: priceBasis, units_sold: soldUnits,
               cost_per_unit: cost, gross_margin: grossMargin, margin_pct: marginPct };
    });
    res.json(guide);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /finance/pricing-guide/:serviceId
router.put('/pricing-guide/:serviceId', auth, async (req, res) => {
  try {
    const { cost_per_unit } = req.body;
    if (cost_per_unit == null || isNaN(parseFloat(cost_per_unit))) {
      return res.status(400).json({ error: 'cost_per_unit is required' });
    }
    const { rows } = await db.query(
      `UPDATE services SET cost_per_unit = $1
       WHERE id = $2 AND tenant_id = $3
       RETURNING id, name, price, cost_per_unit`,
      [parseFloat(cost_per_unit), req.params.serviceId, req.user.tenant_id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Service not found' });
    res.json(rows[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /finance/daily-sales?date=YYYY-MM-DD
router.get('/daily-sales', auth, async (req, res) => {
  try {
    const date = req.query.date || new Date().toISOString().slice(0, 10);
    const { rows } = await db.query(
      `SELECT o.id, o.created_at, o.booking_ref,
              c.name AS customer_name, c.phone AS customer_phone,
              s.name AS service_name, s.unit,
              o.weight, o.price, o.promo_discount, o.delivery_fee,
              o.paid, o.status, o.source
       FROM orders o
       LEFT JOIN customers c ON c.id = o.customer_id
       LEFT JOIN services s ON s.id = o.service_id
       WHERE o.tenant_id = $1
         AND DATE((o.created_at AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Manila') = $2::date
         AND o.deleted_by IS NULL
       ORDER BY o.created_at DESC`,
      [req.user.tenant_id, date]
    );
    const sales = rows.map(o => {
      const price = parseFloat(o.price) || 0;
      const discount = parseFloat(o.promo_discount) || 0;
      const deliveryFee = parseFloat(o.delivery_fee) || 0;
      return {
        ...o,
        price,
        promo_discount: discount,
        delivery_fee: deliveryFee,
        gross_amount: price + deliveryFee,
        net_amount: price + deliveryFee - discount,
      };
    });
    res.json(sales);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /finance/expenses?year=YYYY
router.get('/expenses', auth, async (req, res) => {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const { rows } = await db.query(
      `SELECT id, year, month, category, label, amount
       FROM expenses
       WHERE tenant_id = $1 AND year = $2
       ORDER BY category, label, month`,
      [req.user.tenant_id, year]
    );
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /finance/expenses  — upsert a single cell
router.put('/expenses', auth, async (req, res) => {
  try {
    const { year, month, category, label, amount } = req.body;
    if (!year || !month || !category || !label || amount == null) {
      return res.status(400).json({ error: 'year, month, category, label, amount required' });
    }
    const { rows } = await db.query(
      `INSERT INTO expenses (tenant_id, year, month, category, label, amount)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (tenant_id, year, month, label)
       DO UPDATE SET amount = EXCLUDED.amount, category = EXCLUDED.category
       RETURNING *`,
      [req.user.tenant_id, year, month, category, label, parseFloat(amount) || 0]
    );
    res.json(rows[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /finance/expenses/custom-labels
router.get('/expenses/custom-labels', auth, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT id, category, label FROM expense_custom_labels WHERE tenant_id = $1 ORDER BY category, label`,
      [req.user.tenant_id]
    );
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /finance/expenses/custom-labels — add a custom expense label under a category
router.post('/expenses/custom-labels', auth, async (req, res) => {
  try {
    const category = (req.body.category || '').trim();
    const label = (req.body.label || '').trim();
    if (!category || !label) {
      return res.status(400).json({ error: 'category and label required' });
    }
    const { rows } = await db.query(
      `INSERT INTO expense_custom_labels (tenant_id, category, label) VALUES ($1, $2, $3) RETURNING id, category, label`,
      [req.user.tenant_id, category, label]
    );
    res.json(rows[0]);
  } catch (e) {
    if (e.code === '23505') {
      return res.status(409).json({ error: 'A label with this name already exists' });
    }
    console.error(e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /finance/expenses/custom-labels/:id — remove a custom label and all its recorded amounts
router.delete('/expenses/custom-labels/:id', auth, async (req, res) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `DELETE FROM expense_custom_labels WHERE id = $1 AND tenant_id = $2 RETURNING label`,
      [req.params.id, req.user.tenant_id]
    );
    if (!rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Not found' });
    }
    await client.query(
      `DELETE FROM expenses WHERE tenant_id = $1 AND label = $2`,
      [req.user.tenant_id, rows[0].label]
    );
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error(e);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// GET /finance/monthly-summary?year=YYYY
router.get('/monthly-summary', auth, async (req, res) => {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const tid = req.user.tenant_id;

    // Revenue per month from orders
    const { rows: revRows } = await db.query(
      `SELECT
        EXTRACT(MONTH FROM (created_at AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Manila')::int AS month,
        COALESCE(SUM(CASE WHEN paid AND status != 'CANCELLED' THEN price ELSE 0 END), 0)::numeric AS gross_sales,
        COALESCE(SUM(CASE WHEN paid AND status != 'CANCELLED' THEN COALESCE(promo_discount,0) ELSE 0 END), 0)::numeric AS total_discounts,
        COALESCE(SUM(CASE WHEN paid AND status != 'CANCELLED' THEN COALESCE(delivery_fee,0) ELSE 0 END), 0)::numeric AS delivery_revenue,
        COUNT(*) FILTER (WHERE paid AND status != 'CANCELLED')::int AS load_count,
        COALESCE(SUM(CASE WHEN paid AND status = 'CANCELLED'
          THEN price + COALESCE(delivery_fee,0) - COALESCE(promo_discount,0) ELSE 0 END), 0)::numeric AS refund_total,
        COUNT(*) FILTER (WHERE paid AND status = 'CANCELLED')::int AS refund_count
       FROM orders
       WHERE tenant_id = $1
         AND EXTRACT(YEAR FROM (created_at AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Manila') = $2
         AND deleted_by IS NULL
       GROUP BY 1 ORDER BY 1`,
      [tid, year]
    );

    // COGS per month: join with services for cost_per_unit
    const { rows: cogsRows } = await db.query(
      `SELECT
        EXTRACT(MONTH FROM (o.created_at AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Manila')::int AS month,
        COALESCE(SUM(${COGS_ROW}), 0)::numeric AS cogs
       FROM orders o
       LEFT JOIN services s ON s.id = o.service_id
       WHERE o.tenant_id = $1
         AND EXTRACT(YEAR FROM (o.created_at AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Manila') = $2
         AND o.deleted_by IS NULL
       GROUP BY 1 ORDER BY 1`,
      [tid, year]
    );

    // Expenses per month
    const { rows: expRows } = await db.query(
      `SELECT month, COALESCE(SUM(amount),0)::numeric AS expenses
       FROM expenses
       WHERE tenant_id = $1 AND year = $2
       GROUP BY month ORDER BY month`,
      [tid, year]
    );

    // Build 12-month map
    const revMap = Object.fromEntries(revRows.map(r => [r.month, r]));
    const cogsMap = Object.fromEntries(cogsRows.map(r => [r.month, r.cogs]));
    const expMap = Object.fromEntries(expRows.map(r => [r.month, r.expenses]));

    let ytd = 0;
    const months = Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      const r = revMap[m] || {};
      const grossSales = parseFloat(r.gross_sales) || 0;
      const discounts = parseFloat(r.total_discounts) || 0;
      const deliveryRev = parseFloat(r.delivery_revenue) || 0;
      const loadCount = parseInt(r.load_count) || 0;
      const refundTotal = parseFloat(r.refund_total) || 0;
      const refundCount = parseInt(r.refund_count) || 0;
      const netRevenue = grossSales - discounts + deliveryRev;
      const cogs = parseFloat(cogsMap[m]) || 0;
      const grossProfit = netRevenue - cogs;
      const opExpenses = parseFloat(expMap[m]) || 0;
      const netProfit = grossProfit - opExpenses;
      const marginPct = netRevenue > 0 ? (netProfit / netRevenue) * 100 : 0;
      ytd += netProfit;
      return { month: m, grossSales, discounts, deliveryRev, netRevenue, cogs, grossProfit, opExpenses, netProfit, marginPct, ytdCumulative: ytd, loadCount, refundTotal, refundCount };
    });

    res.json({ year, months });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /finance/targets?year=YYYY
router.get('/targets', auth, async (req, res) => {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const { rows } = await db.query(
      `SELECT period_type, year, amount FROM targets
       WHERE tenant_id = $1 AND year = $2`,
      [req.user.tenant_id, year]
    );
    const map = Object.fromEntries(rows.map(r => [r.period_type, parseFloat(r.amount) || 0]));
    res.json({ weekly: map.weekly || 0, monthly: map.monthly || 0, annual: map.annual || 0 });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /finance/targets
router.put('/targets', auth, async (req, res) => {
  try {
    const { period_type, year, amount } = req.body;
    if (!['weekly','monthly','annual'].includes(period_type) || !year || amount == null) {
      return res.status(400).json({ error: 'period_type (weekly|monthly|annual), year, amount required' });
    }
    const { rows } = await db.query(
      `INSERT INTO targets (tenant_id, period_type, year, amount)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (tenant_id, period_type, year)
       DO UPDATE SET amount = EXCLUDED.amount
       RETURNING *`,
      [req.user.tenant_id, period_type, year, parseFloat(amount) || 0]
    );
    res.json(rows[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /finance/breakeven?year=YYYY&month=M
router.get('/breakeven', auth, async (req, res) => {
  try {
    const now = new Date();
    const year  = parseInt(req.query.year)  || now.getFullYear();
    const month = parseInt(req.query.month) || (now.getMonth() + 1);
    if (year < 2020 || year > 2100 || month < 1 || month > 12) {
      return res.status(400).json({ error: 'Invalid year or month' });
    }
    const tid   = req.user.tenant_id;

    const [{ rows: [rev] }, { rows: [exp] }, { rows: [vc] }] = await Promise.all([
      db.query(
        `SELECT
          COALESCE(SUM(${NET}), 0)::numeric AS revenue,
          COUNT(*) FILTER (WHERE paid AND status != 'CANCELLED')::int AS load_count
         FROM orders
         WHERE tenant_id=$1
           AND EXTRACT(YEAR FROM (created_at AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Manila')=$2
           AND EXTRACT(MONTH FROM (created_at AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Manila')=$3
           AND deleted_by IS NULL`,
        [tid, year, month]
      ),
      db.query(
        `SELECT COALESCE(SUM(amount),0)::numeric AS fixed_costs
         FROM expenses WHERE tenant_id=$1 AND year=$2 AND month=$3`,
        [tid, year, month]
      ),
      db.query(
        `SELECT COALESCE(AVG(COALESCE(s.cost_per_unit,0) * ${UNITS}) FILTER (WHERE o.paid AND o.status != 'CANCELLED'),0)::numeric AS avg_variable_cost
         FROM orders o
         LEFT JOIN services s ON s.id=o.service_id
         WHERE o.tenant_id=$1
           AND EXTRACT(YEAR FROM (o.created_at AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Manila')=$2
           AND EXTRACT(MONTH FROM (o.created_at AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Manila')=$3
           AND o.paid=TRUE
           AND o.deleted_by IS NULL`,
        [tid, year, month]
      ),
    ]);

    const revenue         = parseFloat(rev.revenue)           || 0;
    const loadCount       = parseInt(rev.load_count)          || 0;
    const fixedCosts      = parseFloat(exp.fixed_costs)       || 0;
    const avgVariableCost = parseFloat(vc.avg_variable_cost)  || 0;
    const avgRevPerLoad   = loadCount > 0 ? revenue / loadCount : 0;
    const contributionMargin = avgRevPerLoad - avgVariableCost;
    const breakEvenLoads  = contributionMargin > 0 ? Math.ceil(fixedCosts / contributionMargin) : null;
    const breakEvenRevenue = breakEvenLoads ? breakEvenLoads * avgRevPerLoad : null;
    const promoHeadroom   = avgRevPerLoad > 0
      ? Math.max(0, ((avgRevPerLoad - avgVariableCost - (fixedCosts / Math.max(loadCount, 1))) / avgRevPerLoad) * 100)
      : 0;
    const isAboveBreakEven = breakEvenLoads !== null && loadCount >= breakEvenLoads;

    res.json({
      revenue, loadCount, fixedCosts, avgVariableCost,
      avgRevPerLoad, contributionMargin,
      breakEvenLoads, breakEvenRevenue,
      promoHeadroom, isAboveBreakEven,
      year, month,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /finance/projections?year=YYYY&month=M
router.get('/projections', auth, async (req, res) => {
  try {
    const now   = new Date();
    const year  = parseInt(req.query.year)  || now.getFullYear();
    const month = parseInt(req.query.month) || (now.getMonth() + 1);
    if (year < 2020 || year > 2100 || month < 1 || month > 12) {
      return res.status(400).json({ error: 'Invalid year or month' });
    }
    const tid   = req.user.tenant_id;

    const isCurrentMonth = year === now.getFullYear() && month === (now.getMonth() + 1);
    const daysInMonth    = new Date(year, month, 0).getDate();
    const daysElapsed    = isCurrentMonth ? now.getDate() : daysInMonth;

    const { rows: [mtd] } = await db.query(
      `SELECT COALESCE(SUM(${NET}),0)::numeric AS revenue,
              COUNT(*) FILTER (WHERE paid AND status!='CANCELLED')::int AS load_count
       FROM orders
       WHERE tenant_id=$1
         AND EXTRACT(YEAR FROM (created_at AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Manila')=$2
         AND EXTRACT(MONTH FROM (created_at AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Manila')=$3
         AND deleted_by IS NULL`,
      [tid, year, month]
    );

    const { rows: history } = await db.query(
      `SELECT EXTRACT(MONTH FROM (created_at AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Manila')::int AS month,
              EXTRACT(YEAR FROM (created_at AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Manila')::int AS yr,
              SUM(${NET})::numeric AS revenue
       FROM orders
       WHERE tenant_id=$1
         AND created_at < DATE_TRUNC('month', (NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Manila')
         AND created_at >= DATE_TRUNC('month', (NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Manila') - INTERVAL '3 months'
         AND deleted_by IS NULL
       GROUP BY 1,2 ORDER BY yr, month`,
      [tid]
    );

    const revenue       = parseFloat(mtd.revenue)    || 0;
    const loadCount     = parseInt(mtd.load_count)   || 0;
    const dailyRate     = daysElapsed > 0 ? revenue / daysElapsed : 0;
    const monthEndProj  = dailyRate * daysInMonth;
    const daysRemaining = daysInMonth - daysElapsed;

    const histRevenues  = history.map(r => parseFloat(r.revenue) || 0);
    const avgMonthly    = histRevenues.length
      ? histRevenues.reduce((s, v) => s + v, 0) / histRevenues.length
      : monthEndProj;
    const annualProj    = avgMonthly * 12;
    const weeklyRate    = dailyRate * 7;

    res.json({
      revenue, loadCount, dailyRate, weeklyRate,
      monthEndProjection: monthEndProj,
      annualProjection: annualProj,
      daysElapsed, daysRemaining, daysInMonth,
      historyMonths: history.map(r => ({ month: r.month, year: r.yr, revenue: parseFloat(r.revenue) || 0 })),
      year, month,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /finance/insights — AI recommendations via Gemini
router.post('/insights', auth, async (req, res) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(503).json({ error: 'AI not configured. Add GEMINI_API_KEY to your environment.' });

    const { context } = req.body;
    if (!context) return res.status(400).json({ error: 'context required' });
    if (req.body.context && JSON.stringify(req.body.context).length > 50000) {
      return res.status(400).json({ error: 'Context too large' });
    }

    const PESO = n => `₱${Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;
    const PCT  = n => `${Number(n || 0).toFixed(1)}%`;

    const { dashboard: d, breakeven: b, projections: p, topServices, targets } = context;

    const prompt = `You are a business advisor for a laundry shop in the Philippines. Analyze this month's financial data and give 4 to 5 specific, actionable recommendations. Be direct and practical. Focus on profit improvement, cost control, promo strategy, and reaching targets. Use Philippine context (GCash, per-kilo pricing, walk-in customers, etc.).

CURRENT MONTH PERFORMANCE:
- Revenue: ${PESO(d?.revenue)} (${d?.loadCount || 0} loads)
- Expenses: ${PESO(d?.expenses)}
- Net Profit: ${PESO(d?.netProfit)} (${PCT(d?.profitMargin)} margin)
- Avg Revenue per Load: ${PESO(d?.avgRevenuePerLoad)}

BREAK-EVEN STATUS:
- Fixed Costs this month: ${PESO(b?.fixedCosts)}
- Break-even loads needed: ${b?.breakEvenLoads ?? 'unknown'}
- Loads completed: ${b?.loadCount || 0}
- Status: ${b?.isAboveBreakEven ? '✅ Above break-even' : '⚠️ Below break-even'}
- Max promo headroom without losing money: ${PCT(b?.promoHeadroom)}

PROJECTIONS:
- Month-end projection at current pace: ${PESO(p?.monthEndProjection)}
- Annual projection: ${PESO(p?.annualProjection)}
- Daily revenue rate: ${PESO(p?.dailyRate)}

TARGETS:
- Monthly target: ${PESO(targets?.monthly)}
- Annual target: ${PESO(targets?.annual)}
- On track for monthly target: ${d?.revenue && targets?.monthly && p?.monthEndProjection >= targets?.monthly ? 'Yes ✅' : 'No ⚠️'}

TOP SERVICES (if available): ${topServices?.map(s => `${s.name}: ${s.count} orders, ${PESO(s.revenue)}`).join('; ') || 'not provided'}

Respond with exactly 4 to 5 recommendations. Each must:
1. Start with a bold action verb (Offer, Reduce, Bundle, Target, etc.)
2. Be specific (include numbers, percentages, or peso amounts where relevant)
3. Explain the expected impact in one sentence
4. Be realistic for a small Philippine laundry shop

Format each recommendation on its own line starting with "•".`;

    const axios = require('axios');
    const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

    const { data } = await axios.post(
      `${GEMINI_URL}?key=${apiKey}`,
      {
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 600, temperature: 0.7 },
      },
      { timeout: 15000 }
    );

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!text) return res.status(502).json({ error: 'No response from AI' });

    const recommendations = text
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.startsWith('•'))
      .map(l => l.replace(/^•\s*/, ''));

    res.json({ recommendations, raw: text });
  } catch (e) {
    console.error('[finance/insights]', e.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /finance/customer-retention?year=YYYY&month=M
// Returns current-month summary + 12-month monthly breakdown
router.get('/customer-retention', auth, async (req, res) => {
  try {
    const now   = new Date();
    const year  = parseInt(req.query.year)  || now.getFullYear();
    const month = parseInt(req.query.month) || (now.getMonth() + 1);
    const tid   = req.user.tenant_id;

    // ── Current month summary ────────────────────────────────────────────────
    // For each customer active this month, check if they had ANY order before
    // this month (repeat) or not (new).
    const { rows: summary } = await db.query(
      `SELECT
         COUNT(DISTINCT o.customer_id) FILTER (WHERE o.customer_id IS NOT NULL)::int  AS total,
         COUNT(DISTINCT o.customer_id) FILTER (
           WHERE o.customer_id IS NOT NULL
             AND NOT EXISTS (
               SELECT 1 FROM orders prev
               WHERE prev.tenant_id   = o.tenant_id
                 AND prev.customer_id = o.customer_id
                 AND prev.created_at  < DATE_TRUNC('month', MAKE_DATE($2, $3, 1))
                 AND prev.deleted_by IS NULL
             )
         )::int AS new_customers,
         COUNT(DISTINCT o.customer_id) FILTER (
           WHERE o.customer_id IS NOT NULL
             AND EXISTS (
               SELECT 1 FROM orders prev
               WHERE prev.tenant_id   = o.tenant_id
                 AND prev.customer_id = o.customer_id
                 AND prev.created_at  < DATE_TRUNC('month', MAKE_DATE($2, $3, 1))
                 AND prev.deleted_by IS NULL
             )
         )::int AS repeat_customers
       FROM orders o
       WHERE o.tenant_id = $1
         AND EXTRACT(YEAR  FROM o.created_at) = $2
         AND EXTRACT(MONTH FROM (o.created_at AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Manila') = $3
         AND o.deleted_by IS NULL`,
      [tid, year, month]
    );

    // All-time total unique customers
    const { rows: [allTime] } = await db.query(
      `SELECT COUNT(DISTINCT customer_id) FILTER (WHERE customer_id IS NOT NULL)::int AS total
       FROM orders WHERE tenant_id = $1 AND deleted_by IS NULL`,
      [tid]
    );

    // ── 12-month monthly breakdown ──────────────────────────────────────────
    const { rows: monthly } = await db.query(
      `SELECT
         EXTRACT(MONTH FROM (o.created_at AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Manila')::int AS month,
         EXTRACT(YEAR  FROM o.created_at)::int AS year,
         COUNT(DISTINCT o.customer_id) FILTER (WHERE o.customer_id IS NOT NULL)::int AS total,
         COUNT(DISTINCT o.customer_id) FILTER (
           WHERE o.customer_id IS NOT NULL
             AND NOT EXISTS (
               SELECT 1 FROM orders prev
               WHERE prev.tenant_id   = o.tenant_id
                 AND prev.customer_id = o.customer_id
                 AND prev.created_at  < DATE_TRUNC('month', DATE_TRUNC('month',
                       MAKE_DATE(EXTRACT(YEAR FROM (o.created_at AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Manila')::int,
                                 EXTRACT(MONTH FROM (o.created_at AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Manila')::int, 1)))
                 AND prev.deleted_by IS NULL
             )
         )::int AS new_customers,
         COUNT(DISTINCT o.customer_id) FILTER (
           WHERE o.customer_id IS NOT NULL
             AND EXISTS (
               SELECT 1 FROM orders prev
               WHERE prev.tenant_id   = o.tenant_id
                 AND prev.customer_id = o.customer_id
                 AND prev.created_at  < DATE_TRUNC('month', DATE_TRUNC('month',
                       MAKE_DATE(EXTRACT(YEAR FROM (o.created_at AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Manila')::int,
                                 EXTRACT(MONTH FROM (o.created_at AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Manila')::int, 1)))
                 AND prev.deleted_by IS NULL
             )
         )::int AS repeat_customers
       FROM orders o
       WHERE o.tenant_id = $1
         AND o.created_at >= DATE_TRUNC('year', MAKE_DATE($2, 1, 1))
         AND o.created_at <  DATE_TRUNC('year', MAKE_DATE($2, 1, 1)) + INTERVAL '1 year'
         AND o.deleted_by IS NULL
       GROUP BY 1, 2
       ORDER BY 2, 1`,
      [tid, year]
    );

    const s = summary[0] || {};
    const total          = parseInt(s.total)            || 0;
    const newCustomers   = parseInt(s.new_customers)    || 0;
    const repeatCustomers= parseInt(s.repeat_customers) || 0;
    const allTimeTotal   = parseInt(allTime?.total)     || 0;
    const retentionRate  = total > 0 ? (repeatCustomers / total) * 100 : 0;

    // Build full 12-month array with zeros for missing months
    const monthlyMap = Object.fromEntries(monthly.map(r => [r.month, r]));
    const months = Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      const r = monthlyMap[m] || {};
      return {
        month: m,
        total:           parseInt(r.total)            || 0,
        newCustomers:    parseInt(r.new_customers)    || 0,
        repeatCustomers: parseInt(r.repeat_customers) || 0,
      };
    });

    res.json({
      year, month,
      total, newCustomers, repeatCustomers, retentionRate, allTimeTotal,
      months,
    });
  } catch (e) {
    console.error('[customer-retention]', e.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
