# Finance Insights Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a 6th "Insights" tab to the Finance page with break-even analysis, sales targets with progress tracking, revenue projections, and Gemini-powered AI recommendations.

**Architecture:** Extend the existing `backend/routes/finance.js` with 5 new endpoints, add a `targets` table via Supabase migration, and add an `Insights` tab component to `frontend/src/pages/Finance.jsx`. AI recommendations call the Gemini API directly (same pattern as `backend/utils/gemini.js`) — no new AI infrastructure needed.

**Tech Stack:** Node.js/Express backend, PostgreSQL via Supabase (`pg`), React 18 (inline styles, no router), Axios, Google Gemini 2.5 Flash API.

---

## File Map

| File | Change |
|------|--------|
| `backend/routes/finance.js` | Add 5 endpoints: `GET /targets`, `PUT /targets`, `GET /breakeven`, `GET /projections`, `POST /insights` |
| `frontend/src/pages/Finance.jsx` | Add `Insights` to `TABS` array, add `Insights` component, add `<Insights />` render |
| `frontend/src/api.js` | Add 5 new exported functions |
| DB migration | Create `targets` table |

---

## Task 1: DB Migration — targets table

**Files:**
- Supabase migration (run via MCP)

- [ ] **Step 1: Apply migration via Supabase MCP**

```sql
CREATE TABLE IF NOT EXISTS targets (
  id SERIAL PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  period_type TEXT NOT NULL,  -- 'weekly' | 'monthly' | 'annual'
  year INT NOT NULL,
  amount NUMERIC DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(tenant_id, period_type, year)
);
```

- [ ] **Step 2: Verify the table exists**

Run in Supabase SQL editor or via MCP `execute_sql`:
```sql
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'targets';
```
Expected: columns `id, tenant_id, period_type, year, amount, created_at`.

---

## Task 2: Backend — GET /finance/targets and PUT /finance/targets

**Files:**
- Modify: `backend/routes/finance.js` (append before `module.exports`)

- [ ] **Step 1: Add the two target endpoints to `backend/routes/finance.js`**

Append before `module.exports = router;`:

```js
// GET /finance/targets?year=YYYY
router.get('/targets', auth, async (req, res) => {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const { rows } = await db.query(
      `SELECT period_type, year, amount FROM targets
       WHERE tenant_id = $1 AND year = $2`,
      [req.user.tenant_id, year]
    );
    // Always return all three period types
    const map = Object.fromEntries(rows.map(r => [r.period_type, parseFloat(r.amount) || 0]));
    res.json({
      weekly:  map.weekly  || 0,
      monthly: map.monthly || 0,
      annual:  map.annual  || 0,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// PUT /finance/targets — upsert one target
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
```

- [ ] **Step 2: Verify syntax**

```bash
node -e "require('./backend/routes/finance')" 2>&1
```
Expected: only a `Database connection error:` line (no syntax errors).

---

## Task 3: Backend — GET /finance/breakeven

**Files:**
- Modify: `backend/routes/finance.js`

Break-even formula:
- **Fixed costs** = total expenses for the month (from `expenses` table)
- **Avg variable cost per load** = average `cost_per_unit` across paid orders this month (joined to services)
- **Avg revenue per load** = total revenue / load count
- **Break-even loads** = fixed costs / (avg revenue per load − avg variable cost per load)
- **Promo headroom %** = contribution margin % − (fixed costs / revenue × 100)

- [ ] **Step 1: Add the breakeven endpoint**

Append before `module.exports = router;`:

```js
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
    const contributionMargin = avgRevPerLoad - avgVariableCost; // per load
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
      promoHeadroom,
      isAboveBreakEven,
      year, month,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});
```

- [ ] **Step 2: Verify syntax**

```bash
node -e "require('./backend/routes/finance')" 2>&1
```
Expected: `Database connection error:` only.

---

## Task 4: Backend — GET /finance/projections

**Files:**
- Modify: `backend/routes/finance.js`

Projections logic:
- **Month-end projection** = (MTD revenue / days elapsed) × days in month
- **Annual projection** = average monthly revenue from last 3 completed months × 12
- **Days to target** = if monthly target set, estimate days needed at current pace

- [ ] **Step 1: Add the projections endpoint**

Append before `module.exports = router;`:

```js
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

    // Last 3 completed months for trend
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

    const revenue       = parseFloat(mtd.revenue) || 0;
    const loadCount     = parseInt(mtd.load_count) || 0;
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
      revenue, loadCount,
      dailyRate, weeklyRate,
      monthEndProjection: monthEndProj,
      annualProjection: annualProj,
      daysElapsed, daysRemaining, daysInMonth,
      historyMonths: history.map(r => ({
        month: r.month, year: r.yr, revenue: parseFloat(r.revenue) || 0,
      })),
      year, month,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});
```

- [ ] **Step 2: Verify syntax**

```bash
node -e "require('./backend/routes/finance')" 2>&1
```
Expected: `Database connection error:` only.

---

## Task 5: Backend — POST /finance/insights (Gemini AI)

**Files:**
- Modify: `backend/routes/finance.js`

Calls Gemini 2.5 Flash directly (same as `backend/utils/gemini.js`). Builds a rich financial context prompt and asks for 4–5 concrete, actionable recommendations specific to a Philippine laundry business.

- [ ] **Step 1: Add the insights endpoint**

Append before `module.exports = router;`:

```js
// POST /finance/insights — AI recommendations via Gemini
router.post('/insights', auth, async (req, res) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(503).json({ error: 'AI not configured. Add GEMINI_API_KEY to your environment.' });

    const { context } = req.body; // { dashboard, breakeven, projections, topServices, slowDays }
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
```

- [ ] **Step 2: Verify syntax**

```bash
node -e "require('./backend/routes/finance')" 2>&1
```
Expected: `Database connection error:` only.

---

## Task 6: Frontend — API methods

**Files:**
- Modify: `frontend/src/api.js`

- [ ] **Step 1: Add 5 new exported functions at the end of the Finance section**

Find the existing Finance block in `api.js` and append:

```js
export const getFinanceTargets     = year             => api.get('/finance/targets', { params: { year } });
export const upsertTarget          = data             => api.put('/finance/targets', data);
export const getFinanceBreakeven   = (year, month)    => api.get('/finance/breakeven', { params: { year, month } });
export const getFinanceProjections = (year, month)    => api.get('/finance/projections', { params: { year, month } });
export const getFinanceInsights    = context          => api.post('/finance/insights', { context });
```

- [ ] **Step 2: Verify the imports resolve**

```bash
cd frontend && node_modules/.bin/vite build 2>&1 | tail -5
```
Expected: `✓ built in X.XXs`

---

## Task 7: Frontend — Insights tab component

**Files:**
- Modify: `frontend/src/pages/Finance.jsx`

Add the `Insights` component and wire it into the tab system. The component has 4 sections rendered top-to-bottom:
1. **Sales Targets** — editable weekly/monthly/annual targets with progress bars
2. **Break-Even Analysis** — status card + loads gauge + promo headroom
3. **Projections** — month-end and annual forecast cards
4. **AI Recommendations** — "Get AI Insights" button → Gemini response

- [ ] **Step 1: Add imports to Finance.jsx**

The existing import line already covers all needed API functions. Add the 5 new ones:

```js
import {
  getFinanceDashboard, getFinancePricingGuide, updateServiceCost,
  getFinanceDailySales, getFinanceExpenses, upsertExpense, getFinanceMonthlySummary,
  getFinanceTargets, upsertTarget, getFinanceBreakeven, getFinanceProjections, getFinanceInsights,
} from '../api.js';
```

- [ ] **Step 2: Add `'Insights'` to the TABS array**

```js
const TABS = ['Dashboard', 'Pricing Guide', 'Daily Sales', 'Expenses', 'Monthly Summary', 'Insights'];
```

- [ ] **Step 3: Add the Insights component before the `export default Finance` line**

```jsx
// ─── Insights ─────────────────────────────────────────────────────────────────

function Insights() {
  const now = new Date();
  const [year,  setYear]  = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const [targets,     setTargets]     = useState({ weekly: 0, monthly: 0, annual: 0 });
  const [breakeven,   setBreakeven]   = useState(null);
  const [projections, setProjections] = useState(null);
  const [dashboard,   setDashboard]   = useState(null);
  const [aiRecs,      setAiRecs]      = useState([]);
  const [aiLoading,   setAiLoading]   = useState(false);
  const [aiError,     setAiError]     = useState('');
  const [loading,     setLoading]     = useState(true);
  const [editTarget,  setEditTarget]  = useState({});
  const [savingTarget, setSavingTarget] = useState({});

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getFinanceTargets(year),
      getFinanceBreakeven(year, month),
      getFinanceProjections(year, month),
      getFinanceDashboard(year, month),
    ]).then(([t, b, p, d]) => {
      if (t.data && typeof t.data === 'object' && !Array.isArray(t.data)) setTargets(t.data);
      if (b.data && typeof b.data === 'object' && !Array.isArray(b.data)) setBreakeven(b.data);
      if (p.data && typeof p.data === 'object' && !Array.isArray(p.data)) setProjections(p.data);
      if (d.data && typeof d.data === 'object' && !Array.isArray(d.data)) setDashboard(d.data);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [year, month]);

  async function saveTarget(period_type) {
    const amount = parseFloat(editTarget[period_type]) || 0;
    setSavingTarget(p => ({ ...p, [period_type]: true }));
    try {
      await upsertTarget({ period_type, year, amount });
      setTargets(p => ({ ...p, [period_type]: amount }));
    } catch { alert('Failed to save target.'); }
    setSavingTarget(p => ({ ...p, [period_type]: false }));
    setEditTarget(p => { const n = { ...p }; delete n[period_type]; return n; });
  }

  async function fetchInsights() {
    setAiLoading(true);
    setAiError('');
    setAiRecs([]);
    try {
      const r = await getFinanceInsights({
        dashboard, breakeven, projections, targets,
        topServices: null,
      });
      if (Array.isArray(r.data?.recommendations)) {
        setAiRecs(r.data.recommendations);
      } else {
        setAiError('Could not parse AI response.');
      }
    } catch (e) {
      setAiError(e.response?.data?.error || 'AI request failed. Make sure GEMINI_API_KEY is set.');
    }
    setAiLoading(false);
  }

  const progressPct = (actual, target) => target > 0 ? Math.min(100, (actual / target) * 100) : 0;
  const projMonthPct = projections && targets.monthly > 0
    ? Math.min(100, (projections.monthEndProjection / targets.monthly) * 100) : 0;

  const targetDefs = [
    { key: 'weekly',  label: 'Weekly Target',  tip: 'avg ₱/week' },
    { key: 'monthly', label: 'Monthly Target',  tip: 'revenue goal/month' },
    { key: 'annual',  label: 'Annual Target',   tip: 'yearly revenue goal' },
  ];

  const PESO = n => `₱${Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const PCT  = n => `${Number(n || 0).toFixed(1)}%`;

  if (loading) return <div style={{ color: '#6B7280', fontSize: 14 }}>Loading…</div>;

  const beLoads      = breakeven?.breakEvenLoads ?? null;
  const currentLoads = breakeven?.loadCount || 0;
  const beGauge      = beLoads ? Math.min(100, (currentLoads / beLoads) * 100) : 0;
  const beColor      = beGauge >= 100 ? '#059669' : beGauge >= 70 ? '#BA7517' : '#EF4444';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Period selectors */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <select value={month} onChange={e => setMonth(Number(e.target.value))}
          style={{ padding: '6px 10px', borderRadius: 6, border: '0.5px solid #ccc', fontSize: 13, fontFamily: 'inherit', cursor: 'pointer' }}>
          {FULL_MONTHS.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
        </select>
        <select value={year} onChange={e => setYear(Number(e.target.value))}
          style={{ padding: '6px 10px', borderRadius: 6, border: '0.5px solid #ccc', fontSize: 13, fontFamily: 'inherit', cursor: 'pointer' }}>
          {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map(y => <option key={y}>{y}</option>)}
        </select>
      </div>

      {/* ── Sales Targets ── */}
      <div style={{ ...cardStyle }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: '#111827' }}>Sales Targets</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {targetDefs.map(({ key, label, tip }) => {
            const actual   = key === 'weekly' ? (projections?.weeklyRate || 0) : key === 'monthly' ? (dashboard?.revenue || 0) : 0;
            const target   = targets[key] || 0;
            const pct      = progressPct(actual, target);
            const barColor = pct >= 100 ? '#059669' : pct >= 70 ? '#38a9c2' : pct >= 40 ? '#BA7517' : '#EF4444';
            const isEditing = key in editTarget;
            return (
              <div key={key}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{label}</span>
                    <span style={{ fontSize: 11, color: '#9CA3AF', marginLeft: 6 }}>{tip}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {isEditing ? (
                      <>
                        <input autoFocus type="number" min="0" step="100"
                          value={editTarget[key]}
                          onChange={e => setEditTarget(p => ({ ...p, [key]: e.target.value }))}
                          onBlur={() => saveTarget(key)}
                          onKeyDown={e => { if (e.key === 'Enter') saveTarget(key); if (e.key === 'Escape') setEditTarget(p => { const n={...p}; delete n[key]; return n; }); }}
                          disabled={savingTarget[key]}
                          style={{ width: 100, padding: '3px 6px', borderRadius: 4, border: '1px solid #38a9c2', fontSize: 13, textAlign: 'right', fontFamily: 'inherit' }} />
                      </>
                    ) : (
                      <span style={{ fontSize: 13, color: '#374151', borderBottom: '1px dashed #ccc', cursor: 'pointer' }}
                        onClick={() => setEditTarget(p => ({ ...p, [key]: String(target) }))}>
                        {target > 0 ? PESO(target) : 'Set target'}
                      </span>
                    )}
                  </div>
                </div>
                <div style={{ height: 8, background: '#F3F4F6', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: barColor, borderRadius: 4, transition: 'width 0.4s ease' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3 }}>
                  <span style={{ fontSize: 11, color: '#6B7280' }}>
                    {key === 'annual' ? 'Set annual goal' : `${key === 'weekly' ? 'Avg weekly rate' : 'MTD'}: ${PESO(actual)}`}
                  </span>
                  {target > 0 && <span style={{ fontSize: 11, color: barColor, fontWeight: 600 }}>{pct.toFixed(0)}%</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Break-Even Analysis ── */}
      <div style={cardStyle}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: '#111827' }}>Break-Even Analysis</div>
        {!breakeven ? (
          <div style={{ fontSize: 13, color: '#6B7280' }}>No data yet. Add expenses and set service costs to enable break-even analysis.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Status pill */}
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: beColor + '18', borderRadius: 20, padding: '4px 12px', alignSelf: 'flex-start' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: beColor }}>
                {beGauge >= 100 ? '✅ Above break-even' : beGauge >= 70 ? '⚠️ Almost there' : '❌ Below break-even'}
              </span>
            </div>
            {/* Gauge */}
            {beLoads && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: '#6B7280' }}>Loads: {currentLoads} of {beLoads} needed</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: beColor }}>{beGauge.toFixed(0)}%</span>
                </div>
                <div style={{ height: 10, background: '#F3F4F6', borderRadius: 5, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${beGauge}%`, background: beColor, borderRadius: 5, transition: 'width 0.4s ease' }} />
                </div>
              </div>
            )}
            {/* Stats grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[
                { label: 'Fixed Costs',           val: PESO(breakeven.fixedCosts) },
                { label: 'Break-even Revenue',    val: breakeven.breakEvenRevenue ? PESO(breakeven.breakEvenRevenue) : '—' },
                { label: 'Contribution / Load',   val: PESO(breakeven.contributionMargin) },
                { label: 'Max Promo Headroom',    val: PCT(breakeven.promoHeadroom), note: 'before losing money' },
              ].map(s => (
                <div key={s.label} style={{ background: '#f9f9f7', borderRadius: 8, padding: '10px 12px' }}>
                  <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 2 }}>{s.label}</div>
                  <div style={{ fontSize: 16, fontWeight: 600, color: '#111827' }}>{s.val}</div>
                  {s.note && <div style={{ fontSize: 10, color: '#9CA3AF' }}>{s.note}</div>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Projections ── */}
      <div style={cardStyle}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: '#111827' }}>Projections</div>
        {!projections ? (
          <div style={{ fontSize: 13, color: '#6B7280' }}>No order data yet for projections.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8 }}>
              {[
                { label: `${FULL_MONTHS[month-1]} projection`, val: PESO(projections.monthEndProjection), sub: `${projections.daysRemaining} days remaining`, color: projMonthPct >= 100 ? '#059669' : '#38a9c2' },
                { label: 'Annual projection',         val: PESO(projections.annualProjection), sub: 'based on last 3 months', color: '#7F77DD' },
                { label: 'Daily revenue rate',        val: PESO(projections.dailyRate),  sub: 'today\'s pace', color: '#BA7517' },
                { label: 'Weekly revenue rate',       val: PESO(projections.weeklyRate), sub: 'projected this week', color: '#1D9E75' },
              ].map(c => (
                <div key={c.label} style={{ background: '#f9f9f7', borderRadius: 8, padding: '10px 12px' }}>
                  <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 2 }}>{c.label}</div>
                  <div style={{ fontSize: 16, fontWeight: 600, color: c.color }}>{c.val}</div>
                  <div style={{ fontSize: 10, color: '#9CA3AF' }}>{c.sub}</div>
                </div>
              ))}
            </div>
            {targets.monthly > 0 && projections.monthEndProjection > 0 && (
              <div style={{ fontSize: 13, color: projMonthPct >= 100 ? '#059669' : '#EF4444', fontWeight: 500, padding: '8px 12px', background: projMonthPct >= 100 ? '#D1FAE5' : '#FEE2E2', borderRadius: 8 }}>
                {projMonthPct >= 100
                  ? `✅ On track to meet your monthly target of ${PESO(targets.monthly)}`
                  : `⚠️ Projected to reach ${PCT(projMonthPct)} of your ${PESO(targets.monthly)} monthly target`}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── AI Recommendations ── */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>AI Recommendations</div>
            <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>Powered by Gemini · Based on this month's data</div>
          </div>
          <button onClick={fetchInsights} disabled={aiLoading}
            style={{ padding: '8px 16px', fontSize: 13, borderRadius: 8, cursor: aiLoading ? 'not-allowed' : 'pointer', background: aiLoading ? '#E5E7EB' : '#38a9c2', color: aiLoading ? '#9CA3AF' : '#fff', border: 'none', fontWeight: 600, fontFamily: 'inherit' }}>
            {aiLoading ? 'Thinking…' : aiRecs.length ? 'Refresh' : 'Get AI Insights'}
          </button>
        </div>

        {aiError && (
          <div style={{ fontSize: 13, color: '#EF4444', background: '#FEE2E2', borderRadius: 8, padding: '10px 12px', marginBottom: 10 }}>
            {aiError}
          </div>
        )}

        {aiRecs.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {aiRecs.map((rec, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, padding: '10px 12px', background: '#f9f9f7', borderRadius: 8, borderLeft: '3px solid #38a9c2' }}>
                <span style={{ fontSize: 16, color: '#38a9c2', flexShrink: 0, marginTop: 1 }}>✦</span>
                <span style={{ fontSize: 13, color: '#374151', lineHeight: 1.6 }}>{rec}</span>
              </div>
            ))}
          </div>
        ) : !aiLoading && !aiError && (
          <div style={{ fontSize: 13, color: '#9CA3AF', textAlign: 'center', padding: '1.5rem 0' }}>
            Click "Get AI Insights" to get personalized recommendations for your shop.
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Wire `Insights` into the Finance tab render**

Find the tab render block at the bottom of `Finance()` and add:

```jsx
{tab === 'Insights'        && <Insights />}
```

- [ ] **Step 5: Verify build is clean**

```bash
cd frontend && node_modules/.bin/vite build 2>&1 | grep -E "error|Error|✓ built"
```
Expected: `✓ built in X.XXs` with no errors.

---

## Task 8: Deploy backend to Railway

The backend changes (new endpoints + `targets` table) must be live on Railway before the frontend can load real data.

- [ ] **Step 1: Stage and commit backend changes**

```bash
git add backend/routes/finance.js backend/server.js frontend/src/api.js frontend/src/pages/Finance.jsx frontend/src/components/Icons.jsx frontend/src/components/Sidebar.jsx frontend/src/App.jsx
git commit -m "Add Finance module: P&L, break-even, targets, projections, AI insights"
```

- [ ] **Step 2: Push to trigger Railway auto-deploy**

```bash
git push
```

- [ ] **Step 3: Verify Railway deploy completes**

Watch Railway logs for `✓ loaded /finance`. Confirm by visiting your Railway URL and checking `GET /finance/dashboard` returns JSON (not HTML).

- [ ] **Step 4: Smoke test each endpoint**

From browser console or Insomnia with your Bearer token:
```
GET  /finance/targets?year=2026       → { weekly:0, monthly:0, annual:0 }
GET  /finance/breakeven?year=2026&month=5  → { fixedCosts, breakEvenLoads, ... }
GET  /finance/projections?year=2026&month=5 → { monthEndProjection, annualProjection, ... }
POST /finance/insights (with context body) → { recommendations: [...] }
```

---

## Task 9: End-to-end verification

- [ ] **Step 1: Open Finance → Insights tab in the browser**

Confirm all 4 sections render (Sales Targets, Break-Even, Projections, AI).

- [ ] **Step 2: Set a monthly target**

Click "Set target" under Monthly Target → type `15000` → press Enter. Confirm the progress bar updates.

- [ ] **Step 3: Check break-even status**

If you have expenses entered for the month, the break-even gauge should show loads completed vs. loads needed. If no expenses yet, it shows "No data yet" message — expected.

- [ ] **Step 4: Verify projections**

Month-end projection should be (MTD revenue ÷ day of month) × days in month. Verify it roughly matches your actual data.

- [ ] **Step 5: Get AI recommendations**

Click "Get AI Insights". Should receive 4–5 bullet points within ~5 seconds. If you see "AI not configured" error, add `GEMINI_API_KEY` to Railway environment variables.

---

## Self-Review

**Spec coverage:**
- ✅ Break-even analysis — Task 3 + Task 7 (Insights component)
- ✅ Weekly/monthly/annual targets with progress bars — Task 1, 2, 7
- ✅ Revenue projections (month-end, annual, daily, weekly rates) — Task 4 + Task 7
- ✅ AI recommendations via Gemini — Task 5 + Task 7
- ✅ Deployment — Task 8
- ✅ E2E verification — Task 9

**No placeholders:** All code blocks are complete and runnable.

**Type consistency:** `PESO`, `PCT`, `cardStyle`, `FULL_MONTHS` are defined in the existing Finance.jsx file and reused in Insights. The Insights component uses the same `api.js` pattern as other tabs.
