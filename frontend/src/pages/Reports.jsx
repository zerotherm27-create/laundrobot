import { useEffect, useState } from 'react';
import { getOrders, getMyTenantSettings } from '../api.js';
import { useUpgrade } from '../context/UpgradeContext.jsx';

const PERIODS = ['Daily', 'Weekly', 'Monthly', 'Annually'];

function getRange(period) {
  const now = new Date();
  const start = new Date();
  if      (period === 'Daily')    { start.setHours(0, 0, 0, 0); }          // today midnight → now
  else if (period === 'Weekly')   { start.setDate(now.getDate() - 7); }
  else if (period === 'Monthly')  { start.setMonth(now.getMonth() - 1); }
  else if (period === 'Annually') { start.setFullYear(now.getFullYear() - 1); }
  return start;
}

export default function Reports() {
  const [orders, setOrders] = useState([]);
  const [period, setPeriod] = useState('Monthly');
  const [loading, setLoading] = useState(true);
  const [tenantPlan, setTenantPlan] = useState('starter');
  const { openUpgradeModal } = useUpgrade();

  useEffect(() => {
    getOrders()
      .then(r => {
        setOrders(r.data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
    getMyTenantSettings().then(r => setTenantPlan(r.data.plan || 'starter')).catch(() => {});
  }, []);

  const start = getRange(period);
  const filtered = orders.filter(o => new Date(o.created_at) >= start);

  const revenue = filtered.filter(o => o.paid).reduce((s, o) =>
    s + Number(o.price) + Number(o.delivery_fee || 0) - Number(o.promo_discount || 0), 0);
  const totalOrders = filtered.length;
  const completedOrders = filtered.filter(o => o.status === 'COMPLETED').length;
  const pendingOrders = filtered.filter(o => o.status !== 'COMPLETED').length;
  const unpaidOrders = filtered.filter(o => !o.paid).length;
  const avgOrderValue = totalOrders ? (revenue / totalOrders).toFixed(2) : 0;

  // Group by service
  const byService = filtered.reduce((acc, o) => {
    const name = o.service_name || 'Unknown';
    if (!acc[name]) acc[name] = { count: 0, revenue: 0 };
    acc[name].count++;
    if (o.paid) acc[name].revenue += Number(o.price) + Number(o.delivery_fee || 0) - Number(o.promo_discount || 0);
    return acc;
  }, {});

  // Group by source (booking channel)
  const sourceMap = { walk_in: 0, web: 0, messenger: 0, other: 0 };
  for (const o of filtered) {
    const src = o.source || 'web';
    if (src === 'walk_in') sourceMap.walk_in++;
    else if (src === 'web') sourceMap.web++;
    else if (src === 'messenger') sourceMap.messenger++;
    else sourceMap.other++;
  }
  const sourceRevenue = { walk_in: 0, web: 0, messenger: 0, other: 0 };
  for (const o of filtered.filter(o => o.paid)) {
    const src = o.source || 'web';
    const key = src === 'walk_in' ? 'walk_in' : src === 'web' ? 'web' : src === 'messenger' ? 'messenger' : 'other';
    sourceRevenue[key] += Number(o.price) + Number(o.delivery_fee || 0) - Number(o.promo_discount || 0);
  }

  // Group by status
  const byStatus = ['NEW ORDER','FOR PICK UP','PROCESSING','FOR DELIVERY','COMPLETED'].map(s => ({
    status: s,
    count: filtered.filter(o => o.status === s).length,
  }));

  // Customer retention — within the filtered period
  // "New" = customer whose first ever order (across all orders) falls within the period
  // "Repeat" = had at least one order before the period start
  const periodStart = start;
  const customerFirstOrder = {};
  for (const o of orders) {
    if (!o.customer_id) continue;
    const d = new Date(o.created_at);
    if (!customerFirstOrder[o.customer_id] || d < customerFirstOrder[o.customer_id]) {
      customerFirstOrder[o.customer_id] = d;
    }
  }
  const periodCustomerIds = [...new Set(filtered.filter(o => o.customer_id).map(o => o.customer_id))];
  const retentionNewCount    = periodCustomerIds.filter(id => customerFirstOrder[id] >= periodStart).length;
  const retentionRepeatCount = periodCustomerIds.filter(id => customerFirstOrder[id] <  periodStart).length;
  const retentionTotal       = periodCustomerIds.length;
  const retentionRate        = retentionTotal > 0 ? (retentionRepeatCount / retentionTotal) * 100 : 0;
  const allTimeCustomers     = Object.keys(customerFirstOrder).length;

  // Group orders by day for chart
  const byDay = filtered.reduce((acc, o) => {
    const day = new Date(o.created_at).toLocaleDateString();
    if (!acc[day]) acc[day] = { orders: 0, revenue: 0 };
    acc[day].orders++;
    if (o.paid) acc[day].revenue += Number(o.price);
    return acc;
  }, {});
  const days = Object.entries(byDay).slice(-14);
  const maxRevenue = Math.max(...days.map(([, v]) => v.revenue), 1);

  function exportCSV() {
    const headers = ['Order ID','Customer','Service','Status','Amount','Paid','Date'];
    const rows = filtered.map(o => [
      o.id, o.customer_name, o.service_name, o.status,
      o.price, o.paid ? 'Yes' : 'No',
      new Date(o.created_at).toLocaleDateString()
    ]);
    const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csv = [headers, ...rows].map(r => r.map(esc).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `laundrobot-report-${period.toLowerCase()}.csv`;
    a.click();
  }

  if (!['growth', 'pro'].includes(tenantPlan)) {
    return (
      <div>
        <h2 style={{ fontSize: 18, fontWeight: 500, marginBottom: '1.25rem' }}>Reports</h2>
        <div style={{ background: '#fff', border: '0.5px solid #e8e8e0', borderRadius: 12, padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 4 }}>Revenue reports & analytics</div>
              <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.6 }}>
                Track revenue, order volume, and trends over time. Available on <strong>Growth</strong> and above.
              </div>
            </div>
            <div style={{ display: 'inline-flex', alignItems: 'center', background: '#059669', borderRadius: 20, padding: '3px 10px', flexShrink: 0 }}>
              <span style={{ fontSize: 10, fontWeight: 800, color: '#fff' }}>GROWTH</span>
            </div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
            {['Daily / weekly / monthly view', 'Revenue breakdown by service', 'CSV export', 'Order count trends'].map(f => (
              <div key={f} style={{ fontSize: 11, color: '#374151', background: '#F3F4F6', borderRadius: 20, padding: '3px 10px' }}>✓ {f}</div>
            ))}
          </div>
          <button onClick={openUpgradeModal}
            style={{ width: '100%', padding: '10px', borderRadius: 8, background: '#059669', color: '#fff', fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 6 }}>
            View plans & upgrade →
          </button>
          <div style={{ fontSize: 10, color: '#9CA3AF', textAlign: 'center' }}>₱1,666/month · 2 months free · Cancel anytime</div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <h2 style={{ fontSize: 18, fontWeight: 500 }}>Reports</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          {PERIODS.map(p => (
            <button key={p} onClick={() => setPeriod(p)} style={{
              padding: '6px 14px', fontSize: 13, borderRadius: 6, cursor: 'pointer',
              background: period === p ? '#38a9c2' : 'transparent',
              color: period === p ? '#fff' : '#666',
              border: '0.5px solid ' + (period === p ? '#38a9c2' : '#ccc'),
            }}>{p}</button>
          ))}
          <button onClick={exportCSV} style={{ padding: '6px 14px', fontSize: 13, borderRadius: 6, cursor: 'pointer', background: '#EAF3DE', color: '#3B6D11', border: '0.5px solid #C0DD97', fontWeight: 500 }}>
            Export CSV
          </button>
        </div>
      </div>

      {loading ? <div style={{ color: '#374151', fontSize: 14 }}>Loading...</div> : (
        <>
          {/* Summary cards */}
          <div className="stat-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: '1.5rem' }}>
            {[
              { label: 'Total Revenue', val: '₱' + revenue.toLocaleString(), color: '#38a9c2' },
              { label: 'Total Orders', val: totalOrders, color: '#7F77DD' },
              { label: 'Completed', val: completedOrders, color: '#639922' },
              { label: 'Avg Order Value', val: '₱' + Number(avgOrderValue).toLocaleString(), color: '#1D9E75' },
            ].map(m => (
              <div key={m.label} style={{ background: '#f5f5f3', borderRadius: 8, padding: '1rem' }}>
                <div style={{ fontSize: 12, color: '#374151', marginBottom: 4 }}>{m.label}</div>
                <div style={{ fontSize: 24, fontWeight: 500, color: m.color }}>{m.val}</div>
              </div>
            ))}
          </div>

          <div className="chart-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            {/* Revenue chart */}
            <div style={{ background: '#fff', border: '0.5px solid #e8e8e0', borderRadius: 12, padding: '1rem' }}>
              <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 14 }}>Revenue over time</div>
              {days.length === 0 ? (
                <div style={{ color: '#374151', fontSize: 13, textAlign: 'center', padding: '2rem 0' }}>No data for this period</div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 120 }}>
                  {days.map(([day, val]) => (
                    <div key={day} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                      <div style={{ fontSize: 9, color: '#374151' }}>₱{Math.round(val.revenue / 1000)}k</div>
                      <div style={{ width: '100%', background: '#38a9c2', borderRadius: '3px 3px 0 0', height: Math.max(4, (val.revenue / maxRevenue) * 90) + 'px' }} />
                      <div style={{ fontSize: 8, color: '#374151', transform: 'rotate(-45deg)', whiteSpace: 'nowrap' }}>
                        {day.slice(0, 5)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Orders by status */}
            <div style={{ background: '#fff', border: '0.5px solid #e8e8e0', borderRadius: 12, padding: '1rem' }}>
              <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 14 }}>Orders by status</div>
              {byStatus.map(({ status, count }) => (
                <div key={status} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <span style={{ fontSize: 12, color: '#374151' }}>{status}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 80, height: 6, background: '#f0f0ec', borderRadius: 4 }}>
                      <div style={{ height: 6, borderRadius: 4, width: totalOrders ? (count / totalOrders * 100) + '%' : '0%', background: '#38a9c2' }} />
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 500, minWidth: 20 }}>{count}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Booking channel breakdown */}
          <div style={{ background: '#fff', border: '0.5px solid #e8e8e0', borderRadius: 12, padding: '1rem', marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 14 }}>Booking channel</div>
            <div className="stat-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
              {[
                { key: 'walk_in',   label: 'Walk-in',          icon: '🛒', color: '#166534', bg: '#EAF3DE' },
                { key: 'web',       label: 'Web Booking',       icon: '🌐', color: '#1D4ED8', bg: '#EFF6FF' },
                { key: 'messenger', label: 'Messenger',         icon: '💬', color: '#7F77DD', bg: '#F0EFFC' },
              ].map(({ key, label, icon, color, bg }) => (
                <div key={key} style={{ background: bg, borderRadius: 10, padding: '14px', textAlign: 'center' }}>
                  <div style={{ fontSize: 22, marginBottom: 4 }}>{icon}</div>
                  <div style={{ fontSize: 11, color, fontWeight: 600, marginBottom: 6 }}>{label}</div>
                  <div style={{ fontSize: 24, fontWeight: 800, color, lineHeight: 1 }}>{sourceMap[key]}</div>
                  <div style={{ fontSize: 11, color, marginTop: 4, opacity: 0.8 }}>₱{sourceRevenue[key].toLocaleString()}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Customer Retention */}
          <div style={{ background: '#fff', border: '0.5px solid #e8e8e0', borderRadius: 12, padding: '1rem', marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 14 }}>Customer Retention</div>
            <div className="stat-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px,1fr))', gap: 10, marginBottom: 16 }}>
              {[
                { label: 'Active Customers',  val: retentionTotal,       color: '#374151', bg: '#F9FAFB' },
                { label: 'New Customers',      val: retentionNewCount,    color: '#059669', bg: '#F0FDF4' },
                { label: 'Repeat Customers',   val: retentionRepeatCount, color: '#38a9c2', bg: '#F0F9FF' },
                { label: 'Retention Rate',     val: retentionTotal > 0 ? `${retentionRate.toFixed(0)}%` : '—',
                  color: retentionRate >= 50 ? '#059669' : '#BA7517', bg: '#FFFBEB' },
                { label: 'All-Time Customers', val: allTimeCustomers,     color: '#7F77DD', bg: '#F5F3FF' },
              ].map(s => (
                <div key={s.label} style={{ background: s.bg, borderRadius: 8, padding: '10px 12px' }}>
                  <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 3 }}>{s.label}</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.val}</div>
                </div>
              ))}
            </div>

            {/* Horizontal split bar: new vs repeat */}
            {retentionTotal > 0 && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#6B7280', marginBottom: 5 }}>
                  <span>New <strong style={{ color: '#059669' }}>{retentionNewCount}</strong></span>
                  <span>Repeat <strong style={{ color: '#38a9c2' }}>{retentionRepeatCount}</strong></span>
                </div>
                <div style={{ height: 10, background: '#F3F4F6', borderRadius: 6, overflow: 'hidden', display: 'flex' }}>
                  <div style={{ height: '100%', width: `${(retentionNewCount / retentionTotal) * 100}%`, background: '#059669', transition: 'width .5s' }} />
                  <div style={{ height: '100%', width: `${(retentionRepeatCount / retentionTotal) * 100}%`, background: '#38a9c2', transition: 'width .5s' }} />
                </div>
                <div style={{ display: 'flex', gap: 14, marginTop: 8 }}>
                  {[{ c: '#059669', l: 'New' }, { c: '#38a9c2', l: 'Repeat' }].map(x => (
                    <span key={x.l} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#6B7280' }}>
                      <span style={{ width: 8, height: 8, borderRadius: 2, background: x.c, display: 'inline-block' }} />
                      {x.l}
                    </span>
                  ))}
                  <span style={{ fontSize: 11, color: '#6B7280', marginLeft: 'auto' }}>
                    {retentionRate.toFixed(0)}% return rate
                  </span>
                </div>
              </div>
            )}
            {retentionTotal === 0 && (
              <div style={{ textAlign: 'center', color: '#9CA3AF', fontSize: 13, padding: '1rem 0' }}>No customer data for this period.</div>
            )}
          </div>

          <div className="chart-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {/* Top services */}
            <div style={{ background: '#fff', border: '0.5px solid #e8e8e0', borderRadius: 12, padding: '1rem' }}>
              <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 14 }}>Top services</div>
              {Object.entries(byService).sort((a, b) => b[1].revenue - a[1].revenue).map(([name, val]) => (
                <div key={name} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderTop: '0.5px solid #f0f0ec', fontSize: 13 }}>
                  <span style={{ color: '#374151' }}>{name}</span>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 500, color: '#3B6D11' }}>₱{val.revenue.toLocaleString()}</div>
                    <div style={{ fontSize: 11, color: '#374151' }}>{val.count} orders</div>
                  </div>
                </div>
              ))}
              {Object.keys(byService).length === 0 && <div style={{ color: '#374151', fontSize: 13, textAlign: 'center', padding: '1rem 0' }}>No data</div>}
            </div>

            {/* Summary stats */}
            <div style={{ background: '#fff', border: '0.5px solid #e8e8e0', borderRadius: 12, padding: '1rem' }}>
              <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 14 }}>Summary</div>
              {[
                ['Period', period],
                ['Total orders', totalOrders],
                ['Completed', completedOrders],
                ['Pending', pendingOrders],
                ['Unpaid orders', unpaidOrders],
                ['Total revenue', '₱' + revenue.toLocaleString()],
                ['Avg order value', '₱' + Number(avgOrderValue).toLocaleString()],
              ].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderTop: '0.5px solid #f0f0ec', fontSize: 13 }}>
                  <span style={{ color: '#374151' }}>{k}</span>
                  <span style={{ fontWeight: 500 }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}