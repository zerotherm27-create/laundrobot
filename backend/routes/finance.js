const router = require('express').Router();
const auth = require('../middleware/auth');
const db = require('../db');

// GET /finance/dashboard?year=YYYY&month=M
router.get('/dashboard', auth, async (req, res) => {
  try {
    const now = new Date();
    const year = parseInt(req.query.year) || now.getFullYear();
    const month = parseInt(req.query.month) || (now.getMonth() + 1);
    const tid = req.user.tenant_id;

    const { rows: [rev] } = await db.query(
      `SELECT
        COALESCE(SUM(CASE WHEN paid THEN price ELSE 0 END), 0)::numeric AS revenue,
        COUNT(*) FILTER (WHERE paid AND status != 'CANCELLED') AS load_count
       FROM orders
       WHERE tenant_id = $1
         AND EXTRACT(YEAR FROM created_at) = $2
         AND EXTRACT(MONTH FROM created_at) = $3
         AND (archived = FALSE OR archived IS NULL)`,
      [tid, year, month]
    );

    const { rows: [exp] } = await db.query(
      `SELECT COALESCE(SUM(amount), 0)::numeric AS expenses
       FROM expenses
       WHERE tenant_id = $1 AND year = $2 AND month = $3`,
      [tid, year, month]
    );

    const revenue = parseFloat(rev?.revenue) || 0;
    const expenses = parseFloat(exp?.expenses) || 0;
    const loadCount = parseInt(rev?.load_count) || 0;
    const netProfit = revenue - expenses;
    const profitMargin = revenue > 0 ? (netProfit / revenue) * 100 : 0;
    const avgRevenuePerLoad = loadCount > 0 ? revenue / loadCount : 0;

    res.json({ revenue, expenses, netProfit, profitMargin, loadCount, avgRevenuePerLoad, year, month });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// GET /finance/pricing-guide
router.get('/pricing-guide', auth, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT s.id, s.name, s.price, s.unit, s.cost_per_unit,
              c.name AS category_name
       FROM services s
       LEFT JOIN service_categories c ON c.id = s.category_id
       WHERE s.tenant_id = $1 AND s.active = TRUE
       ORDER BY s.sort_order, s.name`,
      [req.user.tenant_id]
    );
    const guide = rows.map(s => {
      const price = parseFloat(s.price) || 0;
      const cost = parseFloat(s.cost_per_unit) || 0;
      const grossMargin = price - cost;
      const marginPct = price > 0 ? (grossMargin / price) * 100 : 0;
      return { ...s, price, cost_per_unit: cost, gross_margin: grossMargin, margin_pct: marginPct };
    });
    res.json(guide);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
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
    res.status(500).json({ error: e.message });
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
         AND DATE(o.created_at AT TIME ZONE 'Asia/Manila') = $2::date
         AND (o.archived = FALSE OR o.archived IS NULL)
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
    res.status(500).json({ error: e.message });
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
    res.status(500).json({ error: e.message });
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
    res.status(500).json({ error: e.message });
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
        EXTRACT(MONTH FROM created_at)::int AS month,
        COALESCE(SUM(CASE WHEN paid THEN price ELSE 0 END), 0)::numeric AS gross_sales,
        COALESCE(SUM(CASE WHEN paid THEN COALESCE(promo_discount,0) ELSE 0 END), 0)::numeric AS total_discounts,
        COALESCE(SUM(CASE WHEN paid THEN COALESCE(delivery_fee,0) ELSE 0 END), 0)::numeric AS delivery_revenue,
        COUNT(*) FILTER (WHERE paid AND status != 'CANCELLED')::int AS load_count
       FROM orders
       WHERE tenant_id = $1
         AND EXTRACT(YEAR FROM created_at) = $2
         AND (archived = FALSE OR archived IS NULL)
       GROUP BY 1 ORDER BY 1`,
      [tid, year]
    );

    // COGS per month: join with services for cost_per_unit
    const { rows: cogsRows } = await db.query(
      `SELECT
        EXTRACT(MONTH FROM o.created_at)::int AS month,
        COALESCE(SUM(CASE WHEN o.paid THEN COALESCE(s.cost_per_unit,0) ELSE 0 END), 0)::numeric AS cogs
       FROM orders o
       LEFT JOIN services s ON s.id = o.service_id
       WHERE o.tenant_id = $1
         AND EXTRACT(YEAR FROM o.created_at) = $2
         AND (o.archived = FALSE OR o.archived IS NULL)
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
      const netRevenue = grossSales - discounts + deliveryRev;
      const cogs = parseFloat(cogsMap[m]) || 0;
      const grossProfit = netRevenue - cogs;
      const opExpenses = parseFloat(expMap[m]) || 0;
      const netProfit = grossProfit - opExpenses;
      const marginPct = netRevenue > 0 ? (netProfit / netRevenue) * 100 : 0;
      ytd += netProfit;
      return { month: m, grossSales, discounts, deliveryRev, netRevenue, cogs, grossProfit, opExpenses, netProfit, marginPct, ytdCumulative: ytd, loadCount };
    });

    res.json({ year, months });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
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
    res.status(500).json({ error: e.message });
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
    res.status(500).json({ error: e.message });
  }
});

// GET /finance/breakeven?year=YYYY&month=M
router.get('/breakeven', auth, async (req, res) => {
  try {
    const now = new Date();
    const year  = parseInt(req.query.year)  || now.getFullYear();
    const month = parseInt(req.query.month) || (now.getMonth() + 1);
    const tid   = req.user.tenant_id;

    const [{ rows: [rev] }, { rows: [exp] }, { rows: [vc] }] = await Promise.all([
      db.query(
        `SELECT
          COALESCE(SUM(CASE WHEN paid THEN price ELSE 0 END), 0)::numeric AS revenue,
          COUNT(*) FILTER (WHERE paid AND status != 'CANCELLED')::int AS load_count
         FROM orders
         WHERE tenant_id=$1
           AND EXTRACT(YEAR FROM created_at)=$2
           AND EXTRACT(MONTH FROM created_at)=$3
           AND (archived=FALSE OR archived IS NULL)`,
        [tid, year, month]
      ),
      db.query(
        `SELECT COALESCE(SUM(amount),0)::numeric AS fixed_costs
         FROM expenses WHERE tenant_id=$1 AND year=$2 AND month=$3`,
        [tid, year, month]
      ),
      db.query(
        `SELECT COALESCE(AVG(COALESCE(s.cost_per_unit,0)),0)::numeric AS avg_variable_cost
         FROM orders o
         LEFT JOIN services s ON s.id=o.service_id
         WHERE o.tenant_id=$1
           AND EXTRACT(YEAR FROM o.created_at)=$2
           AND EXTRACT(MONTH FROM o.created_at)=$3
           AND o.paid=TRUE
           AND (o.archived=FALSE OR o.archived IS NULL)`,
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
    res.status(500).json({ error: e.message });
  }
});

// GET /finance/projections?year=YYYY&month=M
router.get('/projections', auth, async (req, res) => {
  try {
    const now   = new Date();
    const year  = parseInt(req.query.year)  || now.getFullYear();
    const month = parseInt(req.query.month) || (now.getMonth() + 1);
    const tid   = req.user.tenant_id;

    const isCurrentMonth = year === now.getFullYear() && month === (now.getMonth() + 1);
    const daysInMonth    = new Date(year, month, 0).getDate();
    const daysElapsed    = isCurrentMonth ? now.getDate() : daysInMonth;

    const { rows: [mtd] } = await db.query(
      `SELECT COALESCE(SUM(CASE WHEN paid THEN price ELSE 0 END),0)::numeric AS revenue,
              COUNT(*) FILTER (WHERE paid AND status!='CANCELLED')::int AS load_count
       FROM orders
       WHERE tenant_id=$1
         AND EXTRACT(YEAR FROM created_at)=$2
         AND EXTRACT(MONTH FROM created_at)=$3
         AND (archived=FALSE OR archived IS NULL)`,
      [tid, year, month]
    );

    const { rows: history } = await db.query(
      `SELECT EXTRACT(MONTH FROM created_at)::int AS month,
              EXTRACT(YEAR FROM created_at)::int AS yr,
              SUM(CASE WHEN paid THEN price ELSE 0 END)::numeric AS revenue
       FROM orders
       WHERE tenant_id=$1
         AND created_at < DATE_TRUNC('month', CURRENT_DATE)
         AND created_at >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '3 months'
         AND (archived=FALSE OR archived IS NULL)
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
    res.status(500).json({ error: e.message });
  }
});

// POST /finance/insights — AI recommendations via Gemini
router.post('/insights', auth, async (req, res) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(503).json({ error: 'AI not configured. Add GEMINI_API_KEY to your environment.' });

    const { context } = req.body;
    if (!context) return res.status(400).json({ error: 'context required' });

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
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
