import { useEffect, useState, useCallback } from 'react';
import {
  getFinanceDashboard, getFinancePricingGuide, updateServiceCost,
  getFinanceDailySales, getFinanceExpenses, upsertExpense, getFinanceMonthlySummary,
  getFinanceTargets, upsertTarget, getFinanceBreakeven, getFinanceProjections, getFinanceInsights,
} from '../api.js';

const TABS = ['Dashboard', 'Pricing Guide', 'Daily Sales', 'Expenses', 'Monthly Summary', 'Insights'];
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const FULL_MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const EXPENSE_CATEGORIES = [
  { category: 'Utilities',            labels: ['Electricity', 'Water', 'LPG Gas'] },
  { category: 'Supplies',             labels: ['Detergent', 'Fabric Conditioner', 'Plastic Bags', 'Hangers'] },
  { category: 'Personnel',            labels: ['Wages', 'SSS', 'PhilHealth', 'Pag-IBIG'] },
  { category: 'Facility & Equipment', labels: ['Rent', 'Washer Maintenance', 'Dryer Maintenance', 'Equipment Depreciation'] },
  { category: 'Marketing & Admin',    labels: ['Internet', 'Printing/Packaging', 'Marketing'] },
  { category: 'Other',                labels: ['Miscellaneous'] },
];

const PESO  = n => `₱${Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const PCT   = n => `${Number(n || 0).toFixed(1)}%`;
const KPESO = v => {
  const n = parseFloat(v) || 0;
  if (n >= 1_000_000) return `₱${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `₱${(n / 1_000).toFixed(0)}k`;
  return `₱${Math.round(n)}`;
};

const CAT_COLORS = ['#38a9c2', '#7F77DD', '#059669', '#BA7517', '#EF4444', '#9CA3AF'];
const SVC_COLORS = ['#38a9c2', '#7F77DD', '#059669', '#BA7517', '#EF4444'];

const cardStyle = { background: '#fff', border: '0.5px solid #e8e8e0', borderRadius: 12, padding: '1rem' };
const thStyle   = { textAlign: 'left', fontSize: 12, color: '#6B7280', fontWeight: 600, padding: '8px 12px', whiteSpace: 'nowrap' };
const tdStyle   = { fontSize: 13, color: '#111827', padding: '8px 12px', borderTop: '0.5px solid #f0f0ec' };
const tdNum     = { ...tdStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums' };

// ─── Chart Primitives ─────────────────────────────────────────────────────────

/**
 * 12-month grouped bar chart: Revenue (teal) + Expenses (red) bars,
 * Net Profit trend line (green/red dots). Hover tooltip.
 */
function TrendChart({ months }) {
  const [hov, setHov] = useState(null);

  const hasData = months && months.some(
    m => (parseFloat(m.netRevenue) || 0) > 0 || (parseFloat(m.opExpenses) || 0) > 0
  );

  if (!months || !months.length || !hasData) {
    return (
      <div style={{
        height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#9CA3AF', fontSize: 13, background: '#f9f9f7', borderRadius: 8,
      }}>
        No data yet — record orders and add expenses to see the annual trend.
      </div>
    );
  }

  const VW = 640, VH = 190;
  const PL = 54, PR = 12, PT = 14, PB = 28;
  const plotW = VW - PL - PR;
  const plotH = VH - PT - PB;

  const maxVal = Math.max(
    ...months.flatMap(m => [parseFloat(m.netRevenue) || 0, parseFloat(m.opExpenses) || 0]),
    100
  );

  const bSlot = plotW / 12;
  const gW    = bSlot * 0.70;
  const bW    = (gW - 2) / 2;
  const ys    = v => PT + plotH - Math.max(0, Math.min(parseFloat(v) || 0, maxVal) / maxVal * plotH);

  // Pre-compute profit line points
  const profitPts = months.map((m, i) => {
    const np = parseFloat(m.netProfit) || 0;
    const cx = PL + i * bSlot + bSlot / 2;
    const cy = np >= 0 ? ys(np) : PT + plotH;
    return `${cx},${cy}`;
  }).join(' ');

  return (
    <div style={{ position: 'relative', userSelect: 'none' }}>
      <svg
        viewBox={`0 0 ${VW} ${VH}`}
        style={{ width: '100%', height: VH, display: 'block' }}
        onMouseLeave={() => setHov(null)}
      >
        {/* Grid lines + Y-axis labels */}
        {[0, 0.25, 0.5, 0.75, 1].map((frac, i) => {
          const v = frac * maxVal;
          const y = ys(v);
          return (
            <g key={i}>
              <line x1={PL} y1={y} x2={VW - PR} y2={y}
                stroke={i === 0 ? '#E5E7EB' : '#F3F4F6'}
                strokeWidth={i === 0 ? '1' : '0.5'} />
              {i > 0 && (
                <text x={PL - 4} y={y + 3.5} textAnchor="end" fontSize="8" fill="#9CA3AF">
                  {KPESO(v)}
                </text>
              )}
            </g>
          );
        })}

        {/* Bars */}
        {months.map((m, i) => {
          const rev  = parseFloat(m.netRevenue) || 0;
          const exp  = parseFloat(m.opExpenses) || 0;
          const cx   = PL + i * bSlot + bSlot / 2;
          const bx   = cx - gW / 2;
          const isH  = hov === i;
          const revH = Math.max(0, (rev / maxVal) * plotH);
          const expH = Math.max(0, (exp / maxVal) * plotH);

          return (
            <g key={i} onMouseEnter={() => setHov(i)} style={{ cursor: 'default' }}>
              {isH && (
                <rect x={PL + i * bSlot} y={PT} width={bSlot} height={plotH}
                  fill="#38a9c2" fillOpacity="0.05" rx="2" />
              )}
              {/* Revenue bar */}
              <rect x={bx}       y={ys(rev)} width={bW} height={revH}
                fill="#38a9c2" rx="2" opacity={isH ? 1 : 0.85} />
              {/* Expense bar */}
              <rect x={bx + bW + 2} y={ys(exp)} width={bW} height={expH}
                fill="#EF4444" rx="2" opacity={isH ? 0.9 : 0.70} />
              {/* Month label */}
              <text x={cx} y={VH - 6} textAnchor="middle" fontSize="8"
                fill={isH ? '#374151' : '#9CA3AF'}
                fontWeight={isH ? '600' : '400'}>
                {MONTHS[m.month - 1]}
              </text>
            </g>
          );
        })}

        {/* Net Profit trend line */}
        <polyline points={profitPts} fill="none" stroke="#059669"
          strokeWidth="1.5" strokeLinejoin="round" />

        {/* Net Profit dots */}
        {months.map((m, i) => {
          const np = parseFloat(m.netProfit) || 0;
          const cx = PL + i * bSlot + bSlot / 2;
          const cy = np >= 0 ? ys(np) : PT + plotH;
          return (
            <circle key={i} cx={cx} cy={cy} r={hov === i ? 4 : 2.5}
              fill={np >= 0 ? '#059669' : '#EF4444'}
              stroke="#fff" strokeWidth="1" />
          );
        })}
      </svg>

      {/* Hover tooltip */}
      {hov !== null && (() => {
        const m  = months[hov];
        const np = parseFloat(m.netProfit) || 0;
        const lp = ((hov + 0.5) / 12) * 100;
        return (
          <div style={{
            position: 'absolute', top: 8,
            left: `${lp}%`,
            transform: hov >= 9 ? 'translateX(calc(-100% - 6px))' : 'translateX(6px)',
            background: '#1F2937', color: '#F9FAFB', borderRadius: 8,
            padding: '8px 12px', fontSize: 11, lineHeight: 1.9,
            whiteSpace: 'nowrap', zIndex: 20, pointerEvents: 'none',
            boxShadow: '0 4px 16px rgba(0,0,0,0.28)',
          }}>
            <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 2 }}>
              {FULL_MONTHS[m.month - 1]}
            </div>
            <div style={{ color: '#93C5FD' }}>Revenue: {PESO(m.netRevenue)}</div>
            <div style={{ color: '#FCA5A5' }}>Expenses: {PESO(m.opExpenses)}</div>
            <div style={{ color: np >= 0 ? '#6EE7B7' : '#FCA5A5', fontWeight: 600 }}>
              Net Profit: {PESO(np)}
            </div>
            <div style={{ color: '#9CA3AF', fontSize: 10, marginTop: 1 }}>
              Margin: {PCT(m.marginPct)} · {m.loadCount || 0} orders
            </div>
          </div>
        );
      })()}

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 10 }}>
        {[
          { color: '#38a9c2', shape: 'bar',  label: 'Revenue' },
          { color: '#EF4444', shape: 'bar',  label: 'Expenses' },
          { color: '#059669', shape: 'line', label: 'Net Profit' },
        ].map(l => (
          <span key={l.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#6B7280' }}>
            {l.shape === 'bar'
              ? <span style={{ width: 10, height: 10, borderRadius: 2, background: l.color, display: 'inline-block' }} />
              : (
                <svg width="16" height="10" viewBox="0 0 16 10" style={{ display: 'block' }}>
                  <line x1="0" y1="5" x2="16" y2="5" stroke={l.color} strokeWidth="2" />
                  <circle cx="8" cy="5" r="2.5" fill={l.color} />
                </svg>
              )
            }
            {l.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * Donut chart using SVG stroke-dasharray.
 * Segments are drawn clockwise starting from 12 o'clock (via rotate(-90)).
 */
function DonutChart({ segments, size = 92, center }) {
  const total = segments.reduce((s, seg) => s + Math.max(0, parseFloat(seg.value) || 0), 0);
  if (!total) return null;

  const R = 34, CX = 50, CY = 50, SW = 15;
  const C = 2 * Math.PI * R;

  let cum = 0;
  const arcs = segments.map(seg => {
    const v    = Math.max(0, parseFloat(seg.value) || 0);
    const dash = (v / total) * C;
    const off  = -cum; // negative of accumulated = shift start clockwise
    cum += dash;
    return { color: seg.color, dash, off };
  });

  return (
    <svg viewBox="0 0 100 100" width={size} height={size} style={{ display: 'block', flexShrink: 0 }}>
      {/* Track */}
      <circle cx={CX} cy={CY} r={R} fill="none" stroke="#F3F4F6" strokeWidth={SW} />
      {/* Segments */}
      {arcs.map((arc, i) => (
        <circle key={i} cx={CX} cy={CY} r={R} fill="none"
          stroke={arc.color} strokeWidth={SW}
          strokeDasharray={`${arc.dash} ${C - arc.dash}`}
          strokeDashoffset={arc.off}
          transform={`rotate(-90 ${CX} ${CY})`}
        />
      ))}
      {/* Center label */}
      {center?.top    && <text x={CX} y={CY - 5}  textAnchor="middle" fontSize="8"   fill="#9CA3AF">{center.top}</text>}
      {center?.bottom && <text x={CX} y={CY + 8}  textAnchor="middle" fontSize="9.5" fontWeight="700" fill="#111827">{center.bottom}</text>}
    </svg>
  );
}

/**
 * Horizontal proportional bar rows with color dot, label, and value.
 */
function HorizBars({ items, compact = false }) {
  const max = Math.max(...items.map(i => parseFloat(i.value) || 0), 1);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: compact ? 8 : 12 }}>
      {items.map((item, i) => {
        const pct = Math.max(0, (parseFloat(item.value) || 0) / max * 100);
        return (
          <div key={i}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <span style={{
                  width: 8, height: 8, borderRadius: 2,
                  background: item.color || '#38a9c2',
                  display: 'inline-block', flexShrink: 0,
                }} />
                <span style={{ fontSize: compact ? 11 : 12, color: '#374151' }}>
                  {item.label}
                  {item.sub && (
                    <span style={{ color: '#9CA3AF', marginLeft: 6, fontSize: 10 }}>{item.sub}</span>
                  )}
                </span>
              </div>
              <span style={{ fontSize: compact ? 11 : 12, color: '#6B7280', fontVariantNumeric: 'tabular-nums' }}>
                {PESO(item.value)}
                {max > 1 && (
                  <span style={{ color: '#9CA3AF', marginLeft: 4, fontSize: 10 }}>
                    ({pct.toFixed(0)}%)
                  </span>
                )}
              </span>
            </div>
            <div style={{ height: compact ? 5 : 7, background: '#F3F4F6', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{
                height: '100%', width: `${pct}%`,
                background: item.color || '#38a9c2',
                borderRadius: 4, transition: 'width 0.55s ease',
              }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

function Dashboard() {
  const now = new Date();
  const [year,    setYear]    = useState(now.getFullYear());
  const [month,   setMonth]   = useState(now.getMonth() + 1);
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getFinanceDashboard(year, month)
      .then(r => setData(
        r.data && typeof r.data === 'object' && !Array.isArray(r.data) ? r.data : null
      ))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [year, month]);

  const rev = parseFloat(data?.revenue)          || 0;
  const exp = parseFloat(data?.expenses)         || 0;
  const net = parseFloat(data?.netProfit)        || 0;
  const mrg = parseFloat(data?.profitMargin)     || 0;
  const cnt = Number(data?.loadCount             ?? 0);
  const avg = parseFloat(data?.avgRevenuePerLoad) || 0;

  const kpis = data ? [
    { label: 'MTD Revenue',        val: PESO(rev), color: '#38a9c2' },
    { label: 'MTD Expenses',       val: PESO(exp), color: '#EF4444' },
    { label: 'Net Profit',         val: PESO(net), color: net >= 0 ? '#059669' : '#EF4444' },
    { label: 'Profit Margin',      val: PCT(mrg),  color: mrg >= 0 ? '#059669' : '#EF4444' },
    { label: 'Total Orders',       val: cnt.toLocaleString(), color: '#7F77DD' },
    { label: 'Avg Revenue / Load', val: PESO(avg), color: '#BA7517' },
  ] : [];

  // Donut: profit (green) vs expenses (red)
  const donutSegs = [
    { value: Math.max(0, net), color: '#059669' },
    { value: exp,              color: '#EF4444' },
  ].filter(s => s.value > 0);

  return (
    <div>
      {/* Period selectors */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        <select value={month} onChange={e => setMonth(Number(e.target.value))}
          style={{ padding: '6px 10px', borderRadius: 6, border: '0.5px solid #ccc', fontSize: 13, fontFamily: 'inherit', cursor: 'pointer' }}>
          {FULL_MONTHS.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
        </select>
        <select value={year} onChange={e => setYear(Number(e.target.value))}
          style={{ padding: '6px 10px', borderRadius: 6, border: '0.5px solid #ccc', fontSize: 13, fontFamily: 'inherit', cursor: 'pointer' }}>
          {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map(y => <option key={y}>{y}</option>)}
        </select>
      </div>

      {loading ? <div style={{ color: '#6B7280', fontSize: 14 }}>Loading…</div> : (
        <>
          {/* KPI grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 16 }}>
            {kpis.map(k => (
              <div key={k.label} style={{ ...cardStyle, padding: '1.25rem' }}>
                <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 6 }}>{k.label}</div>
                <div style={{ fontSize: 26, fontWeight: 600, color: k.color }}>{k.val}</div>
              </div>
            ))}
          </div>

          {/* Financial Snapshot card */}
          {data && (rev > 0 || exp > 0) && (
            <div style={{ ...cardStyle, padding: '1.25rem' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 16 }}>
                {FULL_MONTHS[month - 1]} Financial Snapshot
              </div>
              <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>

                {/* Comparison bars */}
                <div style={{ flex: 1, minWidth: 200, display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {[
                    { label: 'Revenue',    value: rev, color: '#38a9c2', pct: 100 },
                    { label: 'Expenses',   value: exp, color: '#EF4444', pct: rev > 0 ? (exp / rev) * 100 : 0 },
                    { label: 'Net Profit', value: net, color: net >= 0 ? '#059669' : '#EF4444',
                      pct: rev > 0 ? (Math.max(0, net) / rev) * 100 : 0 },
                  ].map(item => (
                    <div key={item.label}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                        <span style={{ fontSize: 12, color: '#374151', fontWeight: 500 }}>{item.label}</span>
                        <span style={{ fontSize: 12, color: item.color, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                          {PESO(item.value)}
                        </span>
                      </div>
                      <div style={{ height: 9, background: '#F3F4F6', borderRadius: 5, overflow: 'hidden' }}>
                        <div style={{
                          height: '100%',
                          width: `${Math.max(0, Math.min(100, item.pct))}%`,
                          background: item.color, borderRadius: 5,
                          transition: 'width 0.55s ease',
                        }} />
                      </div>
                    </div>
                  ))}

                  {/* Expense ratio callout */}
                  {rev > 0 && (
                    <div style={{
                      marginTop: 4, padding: '8px 12px', borderRadius: 8,
                      background: net >= 0 ? '#F0FDF4' : '#FFF5F5',
                      fontSize: 12, color: net >= 0 ? '#059669' : '#EF4444',
                    }}>
                      {net >= 0
                        ? `✓ Profitable — keeping ${PCT(mrg)} of every peso earned`
                        : `! Expenses exceed revenue by ${PESO(Math.abs(net))}`}
                    </div>
                  )}
                </div>

                {/* Donut chart */}
                {rev > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                    <DonutChart
                      size={104}
                      segments={donutSegs}
                      center={{ top: 'Margin', bottom: PCT(mrg) }}
                    />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {[
                        { color: '#059669', label: 'Profit' },
                        { color: '#EF4444', label: 'Expenses' },
                      ].map(l => (
                        <span key={l.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10, color: '#6B7280' }}>
                          <span style={{ width: 8, height: 8, borderRadius: 2, background: l.color, display: 'inline-block' }} />
                          {l.label}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Pricing Guide ────────────────────────────────────────────────────────────

function PricingGuide() {
  const [rows,    setRows]    = useState([]);
  const [editing, setEditing] = useState({});
  const [saving,  setSaving]  = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getFinancePricingGuide()
      .then(r => setRows(Array.isArray(r.data) ? r.data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function startEdit(id, current) {
    setEditing(p => ({ ...p, [id]: String(current ?? 0) }));
  }

  async function saveEdit(id) {
    const val = editing[id];
    if (val == null) return;
    setSaving(p => ({ ...p, [id]: true }));
    try {
      await updateServiceCost(id, parseFloat(val) || 0);
      setRows(p => p.map(r => {
        if (r.id !== id) return r;
        const price      = parseFloat(r.price) || 0;
        const cost       = parseFloat(val) || 0;
        const grossMargin = price - cost;
        const margin_pct  = price > 0 ? (grossMargin / price) * 100 : 0;
        return { ...r, cost_per_unit: cost, gross_margin: grossMargin, margin_pct };
      }));
    } catch { alert('Failed to save cost.'); }
    setSaving(p => ({ ...p, [id]: false }));
    setEditing(p => { const n = { ...p }; delete n[id]; return n; });
  }

  if (loading) return <div style={{ color: '#6B7280', fontSize: 14 }}>Loading…</div>;

  // Best margin for relative bar scaling
  const bestMpct = Math.max(...rows.map(r => parseFloat(r.margin_pct) || 0), 1);

  return (
    <div style={cardStyle}>
      <div style={{ fontSize: 13, color: '#6B7280', marginBottom: '0.75rem' }}>
        Set the cost per unit for each service. Gross margin and margin % are auto-calculated.
        Click any <strong>Cost/Unit</strong> cell to edit.
      </div>
      <div style={{ background: '#F0F9FF', border: '0.5px solid #BAE6FD', borderRadius: 8, padding: '10px 14px', marginBottom: '1rem', fontSize: 12, color: '#0369A1', lineHeight: 1.7 }}>
        💡 <strong>How to set Cost / Unit:</strong> Add up everything it costs to complete one order — detergent,
        fabric conditioner, gas (dryer), electricity, and water. For example: if your total cost per load is
        <strong> ₱60</strong>, enter <strong>60</strong>. The system shows gross margin automatically.<br />
        <span style={{ color: '#0284C7' }}>Tip: Update this whenever supply prices change.</span>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f9f9f7' }}>
              {['Service', 'Category', 'Unit', 'Price', 'Cost / Unit', 'Gross Margin', 'Margin %'].map(h => (
                <th key={h} style={thStyle}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(r => {
              const isEditing = r.id in editing;
              const mpct      = parseFloat(r.margin_pct) || 0;
              const mpctColor = mpct >= 50 ? '#059669' : mpct >= 20 ? '#BA7517' : '#EF4444';
              const barPct    = Math.max(0, Math.min(100, (mpct / bestMpct) * 100));

              return (
                <tr key={r.id}>
                  <td style={tdStyle}>{r.name}</td>
                  <td style={{ ...tdStyle, color: '#6B7280' }}>{r.category_name || '—'}</td>
                  <td style={{ ...tdStyle, color: '#6B7280' }}>{r.unit}</td>
                  <td style={tdNum}>{PESO(r.price)}</td>
                  <td style={{ ...tdNum, cursor: 'pointer' }}
                    onClick={() => !isEditing && startEdit(r.id, r.cost_per_unit)}>
                    {isEditing ? (
                      <input
                        autoFocus type="number" min="0" step="0.01"
                        value={editing[r.id]}
                        onChange={e => setEditing(p => ({ ...p, [r.id]: e.target.value }))}
                        onBlur={() => saveEdit(r.id)}
                        onKeyDown={e => {
                          if (e.key === 'Enter')  saveEdit(r.id);
                          if (e.key === 'Escape') setEditing(p => { const n = { ...p }; delete n[r.id]; return n; });
                        }}
                        style={{ width: 80, padding: '3px 6px', borderRadius: 4, border: '1px solid #38a9c2', fontSize: 13, textAlign: 'right', fontFamily: 'inherit' }}
                        disabled={saving[r.id]}
                      />
                    ) : (
                      <span style={{ borderBottom: '1px dashed #ccc' }}>{PESO(r.cost_per_unit)}</span>
                    )}
                  </td>
                  <td style={tdNum}>{PESO(r.gross_margin)}</td>
                  <td style={{ ...tdNum, color: mpctColor, fontWeight: 600 }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      <span>{PCT(r.margin_pct)}</span>
                      {/* Inline margin bar */}
                      <div style={{ width: 52, height: 5, background: '#F3F4F6', borderRadius: 3, overflow: 'hidden', flexShrink: 0 }}>
                        <div style={{ height: '100%', width: `${barPct}%`, background: mpctColor, borderRadius: 3 }} />
                      </div>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Daily Sales Log ──────────────────────────────────────────────────────────

function DailySales() {
  const todayStr = new Date().toISOString().slice(0, 10);
  const [date,    setDate]    = useState(todayStr);
  const [rows,    setRows]    = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    getFinanceDailySales(date)
      .then(r => setRows(Array.isArray(r.data) ? r.data : []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [date]);

  useEffect(() => { load(); }, [load]);

  const totals = rows.reduce((s, r) => ({
    gross: s.gross + (r.gross_amount || 0),
    net:   s.net   + (r.net_amount   || 0),
    paid:  s.paid  + (r.paid ? r.net_amount : 0),
  }), { gross: 0, net: 0, paid: 0 });

  // Service revenue breakdown
  const svcMap = {};
  rows.forEach(r => {
    const key = r.service_name || 'Unknown';
    if (!svcMap[key]) svcMap[key] = { label: key, value: 0, count: 0 };
    svcMap[key].value += parseFloat(r.net_amount) || 0;
    svcMap[key].count += 1;
  });
  const svcBars = Object.values(svcMap)
    .filter(s => s.value > 0)
    .sort((a, b) => b.value - a.value)
    .map((s, i) => ({ ...s, color: SVC_COLORS[i % SVC_COLORS.length], sub: `${s.count} order${s.count !== 1 ? 's' : ''}` }));

  // Payment method breakdown
  const pmMap = {};
  rows.forEach(r => {
    const key = (r.payment_mode || r.source || 'other').replace(/_/g, ' ');
    if (!pmMap[key]) pmMap[key] = 0;
    pmMap[key] += parseFloat(r.net_amount) || 0;
  });
  const pmBars = Object.entries(pmMap)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([label, value], i) => ({ label, value, color: CAT_COLORS[i % CAT_COLORS.length] }));

  function exportCSV() {
    const headers = ['Date', 'Customer', 'Service', 'Weight/Qty', 'Unit Price', 'Discount', 'Gross', 'Net', 'Payment', 'Status'];
    const data = rows.map(r => [
      new Date(r.created_at).toLocaleString('en-PH'),
      r.customer_name || '—', r.service_name || '—',
      r.weight ?? '—', r.price, r.promo_discount || 0,
      r.gross_amount, r.net_amount,
      r.payment_mode || r.source || '—', r.status,
    ]);
    const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csv = [headers, ...data].map(row => row.map(esc).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(blob), download: `sales-${date}.csv`,
    });
    a.click();
  }

  return (
    <div>
      {/* Controls */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <input type="date" value={date} onChange={e => setDate(e.target.value)}
          style={{ padding: '6px 10px', borderRadius: 6, border: '0.5px solid #ccc', fontSize: 13, fontFamily: 'inherit' }} />
        <button onClick={exportCSV}
          style={{ padding: '6px 14px', fontSize: 13, borderRadius: 6, cursor: 'pointer', background: '#EAF3DE', color: '#3B6D11', border: '0.5px solid #C0DD97', fontWeight: 500 }}>
          Export CSV
        </button>
      </div>

      {/* Summary strip */}
      <div style={{ display: 'flex', gap: 12, marginBottom: '1rem', flexWrap: 'wrap' }}>
        {[
          { label: 'Transactions', val: rows.length },
          { label: 'Gross Sales',  val: PESO(totals.gross) },
          { label: 'Net Sales',    val: PESO(totals.net) },
          { label: 'Paid',         val: PESO(totals.paid), color: '#059669' },
        ].map(s => (
          <div key={s.label} style={{ background: '#f9f9f7', borderRadius: 8, padding: '10px 16px', minWidth: 120 }}>
            <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 3 }}>{s.label}</div>
            <div style={{ fontSize: 18, fontWeight: 600, color: s.color || '#111827' }}>{s.val}</div>
          </div>
        ))}
      </div>

      {/* Breakdown charts */}
      {!loading && rows.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: svcBars.length > 1 && pmBars.length > 1 ? '1fr 1fr' : '1fr', gap: 12, marginBottom: 16 }}>
          {svcBars.length > 0 && (
            <div style={{ ...cardStyle }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 12 }}>Revenue by Service</div>
              <HorizBars items={svcBars} compact />
            </div>
          )}
          {pmBars.length > 1 && (
            <div style={{ ...cardStyle }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 12 }}>Revenue by Payment Method</div>
              <HorizBars items={pmBars} compact />
            </div>
          )}
        </div>
      )}

      {/* Transactions table */}
      <div style={cardStyle}>
        {loading ? (
          <div style={{ color: '#6B7280', fontSize: 14 }}>Loading…</div>
        ) : rows.length === 0 ? (
          <div style={{ color: '#6B7280', fontSize: 13, textAlign: 'center', padding: '2rem 0' }}>
            No transactions for this date.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f9f9f7' }}>
                  {['Time', 'Customer', 'Service', 'Weight / Qty', 'Unit Price', 'Discount', 'Gross Amount', 'Net Amount', 'Payment', 'Status'].map(h => (
                    <th key={h} style={thStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id}>
                    <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>
                      {new Date(r.created_at).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td style={tdStyle}>{r.customer_name || '—'}</td>
                    <td style={tdStyle}>{r.service_name || '—'}</td>
                    <td style={tdNum}>{r.weight != null ? `${r.weight} ${r.unit || ''}`.trim() : '—'}</td>
                    <td style={tdNum}>{PESO(r.price)}</td>
                    <td style={{ ...tdNum, color: r.promo_discount > 0 ? '#EF4444' : '#6B7280' }}>
                      {r.promo_discount > 0 ? `-${PESO(r.promo_discount)}` : '—'}
                    </td>
                    <td style={tdNum}>{PESO(r.gross_amount)}</td>
                    <td style={{ ...tdNum, fontWeight: 600 }}>{PESO(r.net_amount)}</td>
                    <td style={{ ...tdStyle, textTransform: 'capitalize', color: '#6B7280' }}>
                      {(r.payment_mode || r.source || '—').replace(/_/g, ' ')}
                    </td>
                    <td style={tdStyle}>
                      <span style={{
                        fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                        background: r.status === 'COMPLETED' ? '#D1FAE5' : r.status === 'CANCELLED' ? '#FEE2E2' : '#FEF3C7',
                        color:      r.status === 'COMPLETED' ? '#059669' : r.status === 'CANCELLED' ? '#EF4444' : '#B45309',
                      }}>{r.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Monthly Expenses ─────────────────────────────────────────────────────────

function Expenses() {
  const [year,    setYear]    = useState(new Date().getFullYear());
  const [expData, setExpData] = useState([]);
  const [editing, setEditing] = useState({});
  const [saving,  setSaving]  = useState({});
  const [loading, setLoading] = useState(true);

  function load(y) {
    setLoading(true);
    getFinanceExpenses(y)
      .then(r => setExpData(Array.isArray(r.data) ? r.data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(year); }, [year]);

  function getAmount(label, month) {
    const key = `${label}-${month}`;
    if (key in editing) return editing[key];
    const row = expData.find(e => e.label === label && e.month === month);
    return row ? String(row.amount) : '0';
  }

  function rowTotal(label) {
    return Array.from({ length: 12 }, (_, i) => {
      const key = `${label}-${i + 1}`;
      if (key in editing) return parseFloat(editing[key]) || 0;
      const row = expData.find(e => e.label === label && e.month === i + 1);
      return parseFloat(row?.amount) || 0;
    }).reduce((s, v) => s + v, 0);
  }

  function colTotal(month) {
    return EXPENSE_CATEGORIES.flatMap(c => c.labels).reduce((s, label) => {
      const key = `${label}-${month}`;
      if (key in editing) return s + (parseFloat(editing[key]) || 0);
      const row = expData.find(e => e.label === label && e.month === month);
      return s + (parseFloat(row?.amount) || 0);
    }, 0);
  }

  async function commitCell(label, month, category) {
    const key = `${label}-${month}`;
    const val = editing[key];
    if (val == null) return;
    setSaving(p => ({ ...p, [key]: true }));
    try {
      const saved = await upsertExpense({ year, month, category, label, amount: parseFloat(val) || 0 });
      setExpData(p => {
        const filtered = p.filter(e => !(e.label === label && e.month === month));
        return [...filtered, saved.data];
      });
    } catch { /* silently keep local state */ }
    setSaving(p => ({ ...p, [key]: false }));
    setEditing(p => { const n = { ...p }; delete n[key]; return n; });
  }

  const grandTotal = Array.from({ length: 12 }, (_, i) => colTotal(i + 1)).reduce((s, v) => s + v, 0);
  const now = new Date();

  // Category totals for breakdown chart
  const catBars = EXPENSE_CATEGORIES.map(({ category, labels }, ci) => {
    const total = labels.reduce((s, label) => {
      return s + Array.from({ length: 12 }, (_, mi) => {
        const row = expData.find(e => e.label === label && e.month === mi + 1);
        return parseFloat(row?.amount) || 0;
      }).reduce((a, b) => a + b, 0);
    }, 0);
    return { label: category, value: total, color: CAT_COLORS[ci] };
  }).filter(c => c.value > 0);

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: '1rem' }}>
        <select value={year} onChange={e => setYear(Number(e.target.value))}
          style={{ padding: '6px 10px', borderRadius: 6, border: '0.5px solid #ccc', fontSize: 13, fontFamily: 'inherit', cursor: 'pointer' }}>
          {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map(y => <option key={y}>{y}</option>)}
        </select>
        <span style={{ fontSize: 12, color: '#6B7280' }}>Click any cell to edit amounts (₱)</span>
      </div>

      {/* Category breakdown chart */}
      {!loading && catBars.length > 0 && (
        <div style={{ ...cardStyle, marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>
              {year} Expense Breakdown by Category
            </div>
            <div style={{ fontSize: 12, color: '#6B7280', fontVariantNumeric: 'tabular-nums' }}>
              Total: {PESO(grandTotal)}
            </div>
          </div>
          <HorizBars items={catBars} />
        </div>
      )}

      {loading ? <div style={{ color: '#6B7280', fontSize: 14 }}>Loading…</div> : (
        <div style={{ ...cardStyle, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#f9f9f7' }}>
                <th style={{ ...thStyle, minWidth: 160 }}>Category / Expense</th>
                {MONTHS.map(m => <th key={m} style={{ ...thStyle, textAlign: 'right', minWidth: 72 }}>{m}</th>)}
                <th style={{ ...thStyle, textAlign: 'right', minWidth: 80 }}>Annual</th>
              </tr>
            </thead>
            <tbody>
              {EXPENSE_CATEGORIES.map(({ category, labels }) => (
                <>
                  <tr key={`cat-${category}`} style={{ background: '#f5f5f3' }}>
                    <td colSpan={14} style={{ ...tdStyle, fontWeight: 700, color: '#374151', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', paddingTop: 10, paddingBottom: 4 }}>
                      {category}
                    </td>
                  </tr>
                  {labels.map(label => (
                    <tr key={label}>
                      <td style={{ ...tdStyle, paddingLeft: 20 }}>{label}</td>
                      {Array.from({ length: 12 }, (_, i) => {
                        const m        = i + 1;
                        const key      = `${label}-${m}`;
                        const isEditing = key in editing;
                        const isSaving  = saving[key];
                        return (
                          <td key={m} style={{ ...tdNum, cursor: 'pointer' }}
                            onClick={() => !isEditing && setEditing(p => ({ ...p, [key]: getAmount(label, m) }))}>
                            {isEditing ? (
                              <input
                                autoFocus type="number" min="0" step="1"
                                value={editing[key]}
                                onChange={e => setEditing(p => ({ ...p, [key]: e.target.value }))}
                                onBlur={() => commitCell(label, m, category)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter')  commitCell(label, m, category);
                                  if (e.key === 'Escape') setEditing(p => { const n = { ...p }; delete n[key]; return n; });
                                }}
                                disabled={isSaving}
                                style={{ width: 64, padding: '2px 4px', borderRadius: 4, border: '1px solid #38a9c2', fontSize: 12, textAlign: 'right', fontFamily: 'inherit' }}
                              />
                            ) : (
                              <span style={{ color: parseFloat(getAmount(label, m)) > 0 ? '#111827' : '#D1D5DB' }}>
                                {parseFloat(getAmount(label, m)) > 0
                                  ? Number(getAmount(label, m)).toLocaleString('en-PH')
                                  : '—'}
                              </span>
                            )}
                          </td>
                        );
                      })}
                      <td style={{ ...tdNum, fontWeight: 600 }}>
                        {rowTotal(label) > 0 ? Number(rowTotal(label)).toLocaleString('en-PH', { minimumFractionDigits: 0 }) : '—'}
                      </td>
                    </tr>
                  ))}
                </>
              ))}
              {/* Totals row */}
              <tr style={{ background: '#f5f5f3', borderTop: '2px solid #e8e8e0' }}>
                <td style={{ ...tdStyle, fontWeight: 700 }}>Total Expenses</td>
                {Array.from({ length: 12 }, (_, i) => (
                  <td key={i + 1} style={{ ...tdNum, fontWeight: 700 }}>
                    {colTotal(i + 1) > 0 ? Number(colTotal(i + 1)).toLocaleString('en-PH', { minimumFractionDigits: 0 }) : '—'}
                  </td>
                ))}
                <td style={{ ...tdNum, fontWeight: 700, color: '#EF4444' }}>
                  {Number(grandTotal).toLocaleString('en-PH', { minimumFractionDigits: 0 })}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Monthly Summary (P&L) ────────────────────────────────────────────────────

function MonthlySummary() {
  const [year,    setYear]    = useState(new Date().getFullYear());
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getFinanceMonthlySummary(year)
      .then(r => setData(r.data?.months ? r.data : null))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [year]);

  const now = new Date();

  function exportCSV() {
    if (!data) return;
    const headers = ['Month', 'Gross Sales', 'Discounts', 'Net Revenue', 'COGS', 'Gross Profit', 'Op. Expenses', 'Net Profit', 'Margin %', 'YTD Cumulative'];
    const rows = data.months.map(m => [
      FULL_MONTHS[m.month - 1],
      m.grossSales, m.discounts, m.netRevenue, m.cogs,
      m.grossProfit, m.opExpenses, m.netProfit,
      (m.marginPct).toFixed(1) + '%', m.ytdCumulative,
    ]);
    const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csv = [headers, ...rows].map(r => r.map(esc).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(blob), download: `pl-${year}.csv`,
    });
    a.click();
  }

  const totals = data?.months.reduce((s, m) => ({
    grossSales:  s.grossSales  + m.grossSales,
    discounts:   s.discounts   + m.discounts,
    netRevenue:  s.netRevenue  + m.netRevenue,
    cogs:        s.cogs        + m.cogs,
    grossProfit: s.grossProfit + m.grossProfit,
    opExpenses:  s.opExpenses  + m.opExpenses,
    netProfit:   s.netProfit   + m.netProfit,
    loadCount:   s.loadCount   + m.loadCount,
  }), { grossSales: 0, discounts: 0, netRevenue: 0, cogs: 0, grossProfit: 0, opExpenses: 0, netProfit: 0, loadCount: 0 });

  const totalMargin = totals && totals.netRevenue > 0
    ? (totals.netProfit / totals.netRevenue) * 100 : 0;

  // Annual summary donut (profit vs expenses)
  const annualDonutSegs = totals ? [
    { value: Math.max(0, totals.netProfit), color: '#059669' },
    { value: totals.opExpenses,             color: '#EF4444' },
  ].filter(s => s.value > 0) : [];

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: '1rem' }}>
        <select value={year} onChange={e => setYear(Number(e.target.value))}
          style={{ padding: '6px 10px', borderRadius: 6, border: '0.5px solid #ccc', fontSize: 13, fontFamily: 'inherit', cursor: 'pointer' }}>
          {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map(y => <option key={y}>{y}</option>)}
        </select>
        {data && (
          <button onClick={exportCSV}
            style={{ padding: '6px 14px', fontSize: 13, borderRadius: 6, cursor: 'pointer', background: '#EAF3DE', color: '#3B6D11', border: '0.5px solid #C0DD97', fontWeight: 500 }}>
            Export CSV
          </button>
        )}
      </div>

      {loading ? <div style={{ color: '#6B7280', fontSize: 14 }}>Loading…</div> : !data ? null : (
        <>
          {/* Annual overview: TrendChart + summary donut */}
          <div style={{ ...cardStyle, marginBottom: 16, padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>{year} Annual Trend</div>
                <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>Hover any month for details</div>
              </div>
              {/* Annual KPI pills */}
              {totals && (
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {[
                    { label: 'Revenue',    value: PESO(totals.netRevenue),  color: '#38a9c2' },
                    { label: 'Expenses',   value: PESO(totals.opExpenses),  color: '#EF4444' },
                    { label: 'Net Profit', value: PESO(totals.netProfit),   color: totals.netProfit >= 0 ? '#059669' : '#EF4444' },
                    { label: 'Margin',     value: PCT(totalMargin),         color: totalMargin >= 0 ? '#059669' : '#EF4444' },
                  ].map(p => (
                    <div key={p.label} style={{ background: '#f9f9f7', borderRadius: 8, padding: '6px 12px', textAlign: 'center' }}>
                      <div style={{ fontSize: 10, color: '#9CA3AF' }}>{p.label}</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: p.color }}>{p.value}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <TrendChart months={data.months} />

            {/* Annual donut + top months */}
            {totals && annualDonutSegs.length > 0 && (
              <div style={{ display: 'flex', gap: 20, marginTop: 20, paddingTop: 16, borderTop: '0.5px solid #f0f0ec', flexWrap: 'wrap', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <DonutChart
                    size={80}
                    segments={annualDonutSegs}
                    center={{ top: 'Margin', bottom: PCT(totalMargin) }}
                  />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {[
                      { color: '#059669', label: 'Profit', value: PESO(Math.max(0, totals.netProfit)) },
                      { color: '#EF4444', label: 'Expenses', value: PESO(totals.opExpenses) },
                    ].map(l => (
                      <span key={l.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#6B7280' }}>
                        <span style={{ width: 8, height: 8, borderRadius: 2, background: l.color, display: 'inline-block' }} />
                        {l.label}: <strong style={{ color: l.color }}>{l.value}</strong>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Top 3 profit months */}
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 8 }}>Best months by net profit</div>
                  {[...data.months]
                    .filter(m => (parseFloat(m.netProfit) || 0) > 0)
                    .sort((a, b) => b.netProfit - a.netProfit)
                    .slice(0, 3)
                    .map((m, i) => (
                      <div key={m.month} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                        <span style={{ fontSize: 11, color: '#9CA3AF', width: 14, textAlign: 'right' }}>#{i + 1}</span>
                        <span style={{ fontSize: 12, color: '#374151', width: 32 }}>{MONTHS[m.month - 1]}</span>
                        <div style={{ flex: 1, height: 5, background: '#F3F4F6', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{
                            height: '100%',
                            width: `${Math.min(100, (m.netProfit / Math.max(...data.months.map(x => x.netProfit), 1)) * 100)}%`,
                            background: '#059669', borderRadius: 3,
                          }} />
                        </div>
                        <span style={{ fontSize: 11, color: '#059669', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                          {PESO(m.netProfit)}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>

          {/* P&L table */}
          <div style={{ ...cardStyle, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f9f9f7' }}>
                  {['Month', 'Gross Sales', 'Discounts', 'Net Revenue', 'COGS', 'Gross Profit', 'Op. Expenses', 'Net Profit', 'Margin %', 'YTD Profit', 'Orders'].map(h => (
                    <th key={h} style={thStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.months.map(m => {
                  const isNeg = m.netProfit < 0;
                  return (
                    <tr key={m.month} style={{ background: isNeg ? '#FFF5F5' : undefined }}>
                      <td style={{ ...tdStyle, fontWeight: 500 }}>{MONTHS[m.month - 1]}</td>
                      <td style={tdNum}>{PESO(m.grossSales)}</td>
                      <td style={{ ...tdNum, color: m.discounts > 0 ? '#EF4444' : '#6B7280' }}>
                        {m.discounts > 0 ? `-${PESO(m.discounts)}` : '—'}
                      </td>
                      <td style={tdNum}>{PESO(m.netRevenue)}</td>
                      <td style={{ ...tdNum, color: '#6B7280' }}>{m.cogs > 0 ? PESO(m.cogs) : '—'}</td>
                      <td style={tdNum}>{PESO(m.grossProfit)}</td>
                      <td style={{ ...tdNum, color: m.opExpenses > 0 ? '#EF4444' : '#6B7280' }}>
                        {m.opExpenses > 0 ? PESO(m.opExpenses) : '—'}
                      </td>
                      <td style={{ ...tdNum, fontWeight: 700, color: isNeg ? '#EF4444' : '#059669' }}>
                        {PESO(m.netProfit)}
                      </td>
                      <td style={{ ...tdNum, fontWeight: 600, color: m.marginPct >= 0 ? '#059669' : '#EF4444' }}>
                        {PCT(m.marginPct)}
                      </td>
                      <td style={{ ...tdNum, color: m.ytdCumulative >= 0 ? '#38a9c2' : '#EF4444' }}>
                        {PESO(m.ytdCumulative)}
                      </td>
                      <td style={{ ...tdNum, color: '#6B7280' }}>{m.loadCount || '—'}</td>
                    </tr>
                  );
                })}

                {/* Annual totals */}
                {totals && (
                  <tr style={{ background: '#f5f5f3', borderTop: '2px solid #e8e8e0' }}>
                    <td style={{ ...tdStyle, fontWeight: 700 }}>Full Year {year}</td>
                    <td style={{ ...tdNum, fontWeight: 700 }}>{PESO(totals.grossSales)}</td>
                    <td style={{ ...tdNum, fontWeight: 700, color: '#EF4444' }}>
                      {totals.discounts > 0 ? `-${PESO(totals.discounts)}` : '—'}
                    </td>
                    <td style={{ ...tdNum, fontWeight: 700 }}>{PESO(totals.netRevenue)}</td>
                    <td style={{ ...tdNum, fontWeight: 700, color: '#6B7280' }}>{totals.cogs > 0 ? PESO(totals.cogs) : '—'}</td>
                    <td style={{ ...tdNum, fontWeight: 700 }}>{PESO(totals.grossProfit)}</td>
                    <td style={{ ...tdNum, fontWeight: 700, color: '#EF4444' }}>
                      {totals.opExpenses > 0 ? PESO(totals.opExpenses) : '—'}
                    </td>
                    <td style={{ ...tdNum, fontWeight: 700, color: totals.netProfit >= 0 ? '#059669' : '#EF4444' }}>
                      {PESO(totals.netProfit)}
                    </td>
                    <td style={{ ...tdNum, fontWeight: 700, color: totalMargin >= 0 ? '#059669' : '#EF4444' }}>
                      {PCT(totalMargin)}
                    </td>
                    <td style={tdNum}>—</td>
                    <td style={{ ...tdNum, color: '#6B7280', fontWeight: 700 }}>{totals.loadCount}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Insights ─────────────────────────────────────────────────────────────────

function Insights() {
  const now = new Date();
  const [year,  setYear]  = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const [targets,      setTargets]      = useState({ weekly: 0, monthly: 0, annual: 0 });
  const [breakeven,    setBreakeven]    = useState(null);
  const [projections,  setProjections]  = useState(null);
  const [dashboard,    setDashboard]    = useState(null);
  const [aiRecs,       setAiRecs]       = useState([]);
  const [aiLoading,    setAiLoading]    = useState(false);
  const [aiError,      setAiError]      = useState('');
  const [loading,      setLoading]      = useState(true);
  const [editTarget,   setEditTarget]   = useState({});
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
      const r = await getFinanceInsights({ dashboard, breakeven, projections, targets, topServices: null });
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

  const progressPct   = (actual, target) => target > 0 ? Math.min(100, (actual / target) * 100) : 0;
  const projMonthPct  = projections && targets.monthly > 0
    ? Math.min(100, (projections.monthEndProjection / targets.monthly) * 100) : 0;

  const targetDefs = [
    { key: 'weekly',  label: 'Weekly Target',  tip: 'avg ₱/week' },
    { key: 'monthly', label: 'Monthly Target',  tip: 'revenue goal/month' },
    { key: 'annual',  label: 'Annual Target',   tip: 'yearly revenue goal' },
  ];

  if (loading) return <div style={{ color: '#6B7280', fontSize: 14 }}>Loading…</div>;

  const beLoads      = breakeven?.breakEvenLoads ?? null;
  const currentLoads = breakeven?.loadCount || 0;
  const beGauge      = beLoads ? Math.min(100, (currentLoads / beLoads) * 100) : 0;
  const beColor      = beGauge >= 100 ? '#059669' : beGauge >= 70 ? '#BA7517' : '#EF4444';

  // Break-even donut: current loads vs needed
  const beDonutSegs = beLoads ? [
    { value: Math.min(currentLoads, beLoads), color: beColor },
    { value: Math.max(0, beLoads - currentLoads), color: '#F3F4F6' },
  ] : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Period selectors */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <select value={month} onChange={e => setMonth(Number(e.target.value))}
          style={{ padding: '6px 10px', borderRadius: 6, border: '0.5px solid #ccc', fontSize: 13, fontFamily: 'inherit', cursor: 'pointer' }}>
          {FULL_MONTHS.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
        </select>
        <select value={year} onChange={e => setYear(Number(e.target.value))}
          style={{ padding: '6px 10px', borderRadius: 6, border: '0.5px solid #ccc', fontSize: 13, fontFamily: 'inherit', cursor: 'pointer' }}>
          {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map(y => <option key={y}>{y}</option>)}
        </select>
      </div>

      {/* Sales Targets */}
      <div style={cardStyle}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 14, color: '#111827' }}>Sales Targets</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
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
                      <input autoFocus type="number" min="0" step="100"
                        value={editTarget[key]}
                        onChange={e => setEditTarget(p => ({ ...p, [key]: e.target.value }))}
                        onBlur={() => saveTarget(key)}
                        onKeyDown={e => {
                          if (e.key === 'Enter')  saveTarget(key);
                          if (e.key === 'Escape') setEditTarget(p => { const n = { ...p }; delete n[key]; return n; });
                        }}
                        disabled={savingTarget[key]}
                        style={{ width: 100, padding: '3px 6px', borderRadius: 4, border: '1px solid #38a9c2', fontSize: 13, textAlign: 'right', fontFamily: 'inherit' }}
                      />
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

      {/* Break-Even Analysis */}
      <div style={cardStyle}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: '#111827' }}>Break-Even Analysis</div>
        {!breakeven ? (
          <div style={{ fontSize: 13, color: '#6B7280' }}>No data yet. Add expenses and set service costs to enable break-even analysis.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Status badge */}
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: beColor + '18', borderRadius: 20, padding: '4px 12px', alignSelf: 'flex-start' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: beColor }}>
                {beGauge >= 100 ? '✅ Above break-even' : beGauge >= 70 ? '⚠️ Almost there' : '❌ Below break-even'}
              </span>
            </div>

            {beLoads && (
              <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
                {/* Donut gauge */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <DonutChart
                    size={80}
                    segments={beDonutSegs}
                    center={{ top: 'orders', bottom: `${currentLoads}` }}
                  />
                  <span style={{ fontSize: 10, color: '#9CA3AF' }}>of {beLoads} needed</span>
                </div>

                {/* Details */}
                <div style={{ flex: 1, minWidth: 140 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 12, color: '#6B7280' }}>{currentLoads} of {beLoads} orders</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: beColor }}>{beGauge.toFixed(0)}%</span>
                  </div>
                  <div style={{ height: 10, background: '#F3F4F6', borderRadius: 5, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${beGauge}%`, background: beColor, borderRadius: 5, transition: 'width 0.4s ease' }} />
                  </div>
                </div>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[
                { label: 'Fixed Costs',         val: PESO(breakeven.fixedCosts) },
                { label: 'Break-even Revenue',  val: breakeven.breakEvenRevenue ? PESO(breakeven.breakEvenRevenue) : '—' },
                { label: 'Contribution / Load', val: PESO(breakeven.contributionMargin) },
                { label: 'Max Promo Headroom',  val: PCT(breakeven.promoHeadroom), note: 'before losing money' },
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

      {/* Projections */}
      <div style={cardStyle}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: '#111827' }}>Projections</div>
        {!projections ? (
          <div style={{ fontSize: 13, color: '#6B7280' }}>No order data yet for projections.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8 }}>
              {[
                { label: `${FULL_MONTHS[month - 1]} projection`, val: PESO(projections.monthEndProjection), sub: `${projections.daysRemaining} days remaining`, color: projMonthPct >= 100 ? '#059669' : '#38a9c2' },
                { label: 'Annual projection',   val: PESO(projections.annualProjection), sub: 'based on last 3 months', color: '#7F77DD' },
                { label: 'Daily revenue rate',  val: PESO(projections.dailyRate),        sub: "today's pace",          color: '#BA7517' },
                { label: 'Weekly revenue rate', val: PESO(projections.weeklyRate),       sub: 'projected this week',   color: '#1D9E75' },
              ].map(c => (
                <div key={c.label} style={{ background: '#f9f9f7', borderRadius: 8, padding: '10px 12px' }}>
                  <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 2 }}>{c.label}</div>
                  <div style={{ fontSize: 16, fontWeight: 600, color: c.color }}>{c.val}</div>
                  <div style={{ fontSize: 10, color: '#9CA3AF' }}>{c.sub}</div>
                </div>
              ))}
            </div>

            {/* Monthly target progress */}
            {targets.monthly > 0 && projections.monthEndProjection > 0 && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                  <span style={{ fontSize: 12, color: '#374151' }}>Monthly target progress (projected)</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: projMonthPct >= 100 ? '#059669' : '#EF4444' }}>
                    {projMonthPct.toFixed(0)}%
                  </span>
                </div>
                <div style={{ height: 8, background: '#F3F4F6', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${projMonthPct}%`, background: projMonthPct >= 100 ? '#059669' : '#38a9c2', borderRadius: 4, transition: 'width 0.4s ease' }} />
                </div>
                <div style={{ fontSize: 12, marginTop: 6, color: projMonthPct >= 100 ? '#059669' : '#EF4444', fontWeight: 500, padding: '8px 12px', background: projMonthPct >= 100 ? '#D1FAE5' : '#FEE2E2', borderRadius: 8 }}>
                  {projMonthPct >= 100
                    ? `✅ On track to meet your monthly target of ${PESO(targets.monthly)}`
                    : `⚠️ Projected to reach ${PCT(projMonthPct)} of your ${PESO(targets.monthly)} monthly target`}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* AI Recommendations */}
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

// ─── Main Finance Page ────────────────────────────────────────────────────────

export default function Finance() {
  const [tab, setTab] = useState('Dashboard');

  return (
    <div>
      <h2 style={{ fontSize: 18, fontWeight: 500, marginBottom: '1.25rem' }}>Finance</h2>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 4, marginBottom: '1.25rem', borderBottom: '0.5px solid #e8e8e0', flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '8px 16px', fontSize: 13, borderRadius: '6px 6px 0 0', cursor: 'pointer',
            background:   tab === t ? '#fff'         : 'transparent',
            color:        tab === t ? '#38a9c2'      : '#6B7280',
            border:       tab === t ? '0.5px solid #e8e8e0' : '0.5px solid transparent',
            borderBottom: tab === t ? '1px solid #fff' : 'none',
            fontWeight:   tab === t ? 600 : 400,
            marginBottom: tab === t ? -1  : 0,
            fontFamily: 'inherit',
          }}>{t}</button>
        ))}
      </div>

      {tab === 'Dashboard'       && <Dashboard />}
      {tab === 'Pricing Guide'   && <PricingGuide />}
      {tab === 'Daily Sales'     && <DailySales />}
      {tab === 'Expenses'        && <Expenses />}
      {tab === 'Monthly Summary' && <MonthlySummary />}
      {tab === 'Insights'        && <Insights />}
    </div>
  );
}
