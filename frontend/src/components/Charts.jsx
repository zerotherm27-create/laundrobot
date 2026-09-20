import { useState } from 'react';
import { MONTHS, FULL_MONTHS, PESO, PCT, KPESO } from '../utils/format.js';

// ─── Chart Primitives ─────────────────────────────────────────────────────────
// Shared by Finance.jsx, Overview.jsx, and Reports.jsx so chart math/styling
// lives in one place instead of being reimplemented per page.

/**
 * 12-month grouped bar chart: Revenue (teal) + Expenses (red) bars,
 * Net Profit trend line (green/red dots). Hover + tap tooltip.
 */
export function TrendChart({ months }) {
  const [hov, setHov] = useState(null);

  const hasData = months && months.some(
    m => (parseFloat(m.netRevenue) || 0) > 0 || (parseFloat(m.opExpenses) || 0) > 0
  );

  if (!months || !months.length || !hasData) {
    return (
      <div style={{
        height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#6B7280', fontSize: 13, background: '#f9f9f7', borderRadius: 8,
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
                <text x={PL - 4} y={y + 3.5} textAnchor="end" fontSize="9" fill="#6B7280">
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
            <g key={i} onMouseEnter={() => setHov(i)} onClick={() => setHov(h => h === i ? null : i)} style={{ cursor: 'default' }}>
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
              <text x={cx} y={VH - 6} textAnchor="middle" fontSize="9"
                fill={isH ? '#374151' : '#6B7280'}
                fontWeight={isH ? '600' : '400'}>
                {MONTHS[m.month - 1]}
              </text>
            </g>
          );
        })}

        {/* Net Profit trend line */}
        <polyline points={profitPts} fill="none" stroke="#047857"
          strokeWidth="1.5" strokeLinejoin="round" />

        {/* Net Profit dots */}
        {months.map((m, i) => {
          const np = parseFloat(m.netProfit) || 0;
          const cx = PL + i * bSlot + bSlot / 2;
          const cy = np >= 0 ? ys(np) : PT + plotH;
          return (
            <circle key={i} cx={cx} cy={cy} r={hov === i ? 4 : 2.5}
              fill={np >= 0 ? '#047857' : '#EF4444'}
              stroke="#fff" strokeWidth="1" />
          );
        })}
      </svg>

      {/* Hover/tap tooltip */}
      {hov !== null && (() => {
        const m  = months[hov];
        const np = parseFloat(m.netProfit) || 0;
        const lp = ((hov + 0.5) / 12) * 100;
        return (
          <div style={{
            position: 'absolute', top: 8,
            left: `${lp}%`,
            transform: hov >= months.length - 3 ? 'translateX(calc(-100% - 6px))' : 'translateX(6px)',
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
            <div style={{ color: '#6B7280', fontSize: 10, marginTop: 1 }}>
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
          { color: '#047857', shape: 'line', label: 'Net Profit' },
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
export function DonutChart({ segments, size = 92, center }) {
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
      {center?.top    && <text x={CX} y={CY - 5}  textAnchor="middle" fontSize="8"   fill="#6B7280">{center.top}</text>}
      {center?.bottom && <text x={CX} y={CY + 8}  textAnchor="middle" fontSize="9.5" fontWeight="700" fill="#111827">{center.bottom}</text>}
    </svg>
  );
}

/**
 * Horizontal proportional bar rows with color dot, label, and value.
 */
export function HorizBars({ items, compact = false, formatValue = PESO }) {
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
                    <span style={{ color: '#6B7280', marginLeft: 6, fontSize: 10 }}>{item.sub}</span>
                  )}
                </span>
              </div>
              <span style={{ fontSize: compact ? 11 : 12, color: '#6B7280', fontVariantNumeric: 'tabular-nums' }}>
                {formatValue(item.value)}
                {max > 1 && (
                  <span style={{ color: '#6B7280', marginLeft: 4, fontSize: 10 }}>
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

// ─── Retention Chart ──────────────────────────────────────────────────────────
// Grouped bar chart: new customers (green) + repeat customers (teal) per month

export function RetentionChart({ months }) {
  const [hov, setHov] = useState(null);

  const hasData = months && months.some(m => (m.total || 0) > 0);
  if (!months || !months.length || !hasData) {
    return (
      <div style={{
        height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#6B7280', fontSize: 13, background: '#f9f9f7', borderRadius: 8,
      }}>
        No customer data yet for this period.
      </div>
    );
  }

  const VW = 640, VH = 180;
  const PL = 36, PR = 12, PT = 14, PB = 28;
  const plotW = VW - PL - PR;
  const plotH = VH - PT - PB;

  const maxVal = Math.max(...months.map(m => (m.newCustomers || 0) + (m.repeatCustomers || 0)), 1);
  const bSlot  = plotW / 12;
  const gW     = bSlot * 0.72;
  const bW     = (gW - 2) / 2;
  const ys     = v => PT + plotH - Math.max(0, Math.min(v, maxVal) / maxVal * plotH);

  // Y-axis ticks — at most 5 integer ticks
  const tickCount = Math.min(maxVal, 5);
  const tickStep  = Math.ceil(maxVal / tickCount);
  const ticks     = Array.from({ length: Math.floor(maxVal / tickStep) + 1 }, (_, i) => i * tickStep);

  return (
    <div style={{ position: 'relative', userSelect: 'none' }}>
      <svg
        viewBox={`0 0 ${VW} ${VH}`}
        style={{ width: '100%', height: VH, display: 'block' }}
        onMouseLeave={() => setHov(null)}
      >
        {/* Grid + Y labels */}
        {ticks.map((v, i) => {
          const y = ys(v);
          return (
            <g key={i}>
              <line x1={PL} y1={y} x2={VW - PR} y2={y}
                stroke={i === 0 ? '#E5E7EB' : '#F3F4F6'}
                strokeWidth={i === 0 ? '1' : '0.5'} />
              {v > 0 && (
                <text x={PL - 4} y={y + 3.5} textAnchor="end" fontSize="9" fill="#6B7280">{v}</text>
              )}
            </g>
          );
        })}

        {/* Bars */}
        {months.map((m, i) => {
          const nc  = m.newCustomers    || 0;
          const rc  = m.repeatCustomers || 0;
          const cx  = PL + i * bSlot + bSlot / 2;
          const bx  = cx - gW / 2;
          const isH = hov === i;
          const ncH = Math.max(0, (nc / maxVal) * plotH);
          const rcH = Math.max(0, (rc / maxVal) * plotH);

          return (
            <g key={i} onMouseEnter={() => setHov(i)} onClick={() => setHov(h => h === i ? null : i)} style={{ cursor: 'default' }}>
              {isH && (
                <rect x={PL + i * bSlot} y={PT} width={bSlot} height={plotH}
                  fill="#38a9c2" fillOpacity="0.05" rx="2" />
              )}
              {/* New customers bar */}
              <rect x={bx}           y={ys(nc)} width={bW} height={ncH}
                fill="#047857" rx="2" opacity={isH ? 1 : 0.82} />
              {/* Repeat customers bar */}
              <rect x={bx + bW + 2}  y={ys(rc)} width={bW} height={rcH}
                fill="#38a9c2" rx="2" opacity={isH ? 1 : 0.82} />
              {/* Month label */}
              <text x={cx} y={VH - 6} textAnchor="middle" fontSize="9"
                fill={isH ? '#374151' : '#6B7280'}
                fontWeight={isH ? '600' : '400'}>
                {MONTHS[m.month - 1]}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Hover/tap tooltip */}
      {hov !== null && (() => {
        const m   = months[hov];
        const ret = m.total > 0 ? ((m.repeatCustomers / m.total) * 100).toFixed(0) : 0;
        const lp  = ((hov + 0.5) / 12) * 100;
        return (
          <div style={{
            position: 'absolute', top: 8,
            left: `${lp}%`,
            transform: hov >= months.length - 3 ? 'translateX(calc(-100% - 6px))' : 'translateX(6px)',
            background: '#1F2937', color: '#F9FAFB', borderRadius: 8,
            padding: '8px 12px', fontSize: 11, lineHeight: 1.9,
            whiteSpace: 'nowrap', zIndex: 20, pointerEvents: 'none',
            boxShadow: '0 4px 16px rgba(0,0,0,0.28)',
          }}>
            <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 2 }}>{FULL_MONTHS[m.month - 1]}</div>
            <div style={{ color: '#6EE7B7' }}>New: {m.newCustomers || 0}</div>
            <div style={{ color: '#93C5FD' }}>Repeat: {m.repeatCustomers || 0}</div>
            <div style={{ color: '#F9FAFB', fontWeight: 600 }}>Total: {m.total || 0}</div>
            <div style={{ color: '#6B7280', fontSize: 10, marginTop: 1 }}>Retention: {ret}%</div>
          </div>
        );
      })()}

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 8 }}>
        {[
          { color: '#047857', label: 'New Customers' },
          { color: '#38a9c2', label: 'Repeat Customers' },
        ].map(l => (
          <span key={l.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#6B7280' }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: l.color, display: 'inline-block' }} />
            {l.label}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Mini Bar Chart ───────────────────────────────────────────────────────────
// Generic single-series bar chart for variable-length data (e.g. Reports'
// daily revenue, which can be anywhere from a few days to ~14). Unlike
// TrendChart this has no fixed 12-slot assumption and only one metric.

export function MiniBarChart({ data, labelKey, valueKey, color = '#38a9c2', height = 120, formatValue = v => v }) {
  const [hov, setHov] = useState(null);

  if (!data || !data.length) {
    return (
      <div style={{
        height, display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#6B7280', fontSize: 13, background: '#f9f9f7', borderRadius: 8,
      }}>
        No data for this period
      </div>
    );
  }

  const VW = Math.max(320, data.length * 40), VH = height;
  const PL = 8, PR = 8, PT = 14, PB = 24;
  const plotW = VW - PL - PR;
  const plotH = VH - PT - PB;

  const maxVal = Math.max(...data.map(d => parseFloat(d[valueKey]) || 0), 1);
  const bSlot  = plotW / data.length;
  const bW     = bSlot * 0.6;
  const ys     = v => PT + plotH - Math.max(0, Math.min(parseFloat(v) || 0, maxVal) / maxVal * plotH);

  return (
    <div style={{ position: 'relative', userSelect: 'none' }}>
      <svg viewBox={`0 0 ${VW} ${VH}`} style={{ width: '100%', height: VH, display: 'block' }}
        onMouseLeave={() => setHov(null)}>
        <line x1={PL} y1={PT + plotH} x2={VW - PR} y2={PT + plotH} stroke="#E5E7EB" strokeWidth="1" />
        {data.map((d, i) => {
          const v   = parseFloat(d[valueKey]) || 0;
          const cx  = PL + i * bSlot + bSlot / 2;
          const bx  = cx - bW / 2;
          const isH = hov === i;
          return (
            <g key={i} onMouseEnter={() => setHov(i)} onClick={() => setHov(h => h === i ? null : i)} style={{ cursor: 'default' }}>
              {isH && <rect x={PL + i * bSlot} y={PT} width={bSlot} height={plotH} fill={color} fillOpacity="0.06" rx="2" />}
              <rect x={bx} y={ys(v)} width={bW} height={Math.max(0, (v / maxVal) * plotH)}
                fill={color} rx="2" opacity={isH ? 1 : 0.82} />
              <text x={cx} y={VH - 6} textAnchor="middle" fontSize="9"
                fill={isH ? '#374151' : '#6B7280'} fontWeight={isH ? '600' : '400'}>
                {String(d[labelKey]).slice(0, 5)}
              </text>
            </g>
          );
        })}
      </svg>
      {hov !== null && (() => {
        const d  = data[hov];
        const lp = ((hov + 0.5) / data.length) * 100;
        return (
          <div style={{
            position: 'absolute', top: 8, left: `${lp}%`,
            transform: hov >= data.length - 3 ? 'translateX(calc(-100% - 6px))' : 'translateX(6px)',
            background: '#1F2937', color: '#F9FAFB', borderRadius: 8,
            padding: '6px 10px', fontSize: 11, lineHeight: 1.7,
            whiteSpace: 'nowrap', zIndex: 20, pointerEvents: 'none',
            boxShadow: '0 4px 16px rgba(0,0,0,0.28)',
          }}>
            <div style={{ fontWeight: 700, marginBottom: 1 }}>{d[labelKey]}</div>
            <div>{formatValue(d[valueKey])}</div>
          </div>
        );
      })()}
    </div>
  );
}
