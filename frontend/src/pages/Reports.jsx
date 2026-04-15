import { useEffect, useState } from 'react';
import { getOrders } from '../api.js';

const PERIODS = ['Daily', 'Weekly', 'Monthly', 'Annually'];

function getRange(period) {
  const now = new Date();
  const start = new Date();
  if (period === 'Daily') start.setDate(now.getDate() - 1);
  else if (period === 'Weekly') start.setDate(now.getDate() - 7);
  else if (period === 'Monthly') start.setMonth(now.getMonth() - 1);
  else if (period === 'Annually') start.setFullYear(now.getFullYear() - 1);
  return start;
}

export default function Reports() {
  const [orders, setOrders] = useState([]);
  const [period, setPeriod] = useState('Monthly');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getOrders().then(r => { setOrders(r.data); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const start = getRange(period);
  const filtered = orders.filter(o => new Date(o.created_at) >= start);

  const revenue = filtered.filter(o => o.paid).reduce((s, o) => s + Number(o.price), 0);
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
    if (o.paid) acc[name].revenue += Number(o.price);
    return acc;
  }, {});

  // Group by status
  const byStatus = ['NEW ORDER','FOR PICK UP','PROCESSING','FOR DELIVERY','COMPLETED'].map(s => ({
    status: s,
    count: filtered.filter(o => o.status === s).length,
  }));

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

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <h2 style={{ fontSize: 18, fontWeight: 500 }}>Reports</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          {PERIODS.map(p => (
            <button key={p} onClick={() => setPeriod(p)} style={{
              padding: '6px 14px', fontSize: 13, borderRadius: 6, cursor: 'pointer',
              background: period === p ? '#378ADD' : 'transparent',
              color: period === p ? '#fff' : '#666',
              border: '0.5px solid ' + (period === p ? '#378ADD' : '#ccc'),
            }}>{p}</button>
          ))}
          <button onClick={exportCSV} style={{ padding: '6px 14px', fontSize: 13, borderRadius: 6, cursor: 'pointer', background: '#EAF3DE', color: '#3B6D11', border: '0.5px solid #C0DD97', fontWeight: 500 }}>
            Export CSV
          </button>
        </div>
      </div>

      {loading ? <div style={{ color: '#aaa', fontSize: 14 }}>Loading...</div> : (
        <>
          {/* Summary cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: '1.5rem' }}>
            {[
              { label: 'Total Revenue', val: '₱' + revenue.toLocaleString(), color: '#378ADD' },
              { label: 'Total Orders', val: totalOrders, color: '#7F77DD' },
              { label: 'Completed', val: completedOrders, color: '#639922' },
              { label: 'Avg Order Value', val: '₱' + Number(avgOrderValue).toLocaleString(), color: '#1D9E75' },
            ].map(m => (
              <div key={m.label} style={{ background: '#f5f5f3', borderRadius: 8, padding: '1rem' }}>
                <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>{m.label}</div>
                <div style={{ fontSize: 24, fontWeight: 500, color: m.color }}>{m.val}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            {/* Revenue chart */}
            <div style={{ background: '#fff', border: '0.5px solid #e8e8e0', borderRadius: 12, padding: '1rem' }}>
              <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 14 }}>Revenue over time</div>
              {days.length === 0 ? (
                <div style={{ color: '#aaa', fontSize: 13, textAlign: 'center', padding: '2rem 0' }}>No data for this period</div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 120 }}>
                  {days.map(([day, val]) => (
                    <div key={day} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                      <div style={{ fontSize: 9, color: '#888' }}>₱{Math.round(val.revenue / 1000)}k</div>
                      <div style={{ width: '100%', background: '#378ADD', borderRadius: '3px 3px 0 0', height: Math.max(4, (val.revenue / maxRevenue) * 90) + 'px' }} />
                      <div style={{ fontSize: 8, color: '#aaa', transform: 'rotate(-45deg)', whiteSpace: 'nowrap' }}>
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
                  <span style={{ fontSize: 12, color: '#666' }}>{status}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 80, height: 6, background: '#f0f0ec', borderRadius: 4 }}>
                      <div style={{ height: 6, borderRadius: 4, width: totalOrders ? (count / totalOrders * 100) + '%' : '0%', background: '#378ADD' }} />
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 500, minWidth: 20 }}>{count}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {/* Top services */}
            <div style={{ background: '#fff', border: '0.5px solid #e8e8e0', borderRadius: 12, padding: '1rem' }}>
              <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 14 }}>Top services</div>
              {Object.entries(byService).sort((a, b) => b[1].revenue - a[1].revenue).map(([name, val]) => (
                <div key={name} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderTop: '0.5px solid #f0f0ec', fontSize: 13 }}>
                  <span style={{ color: '#666' }}>{name}</span>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 500, color: '#3B6D11' }}>₱{val.revenue.toLocaleString()}</div>
                    <div style={{ fontSize: 11, color: '#888' }}>{val.count} orders</div>
                  </div>
                </div>
              ))}
              {Object.keys(byService).length === 0 && <div style={{ color: '#aaa', fontSize: 13, textAlign: 'center', padding: '1rem 0' }}>No data</div>}
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
                  <span style={{ color: '#888' }}>{k}</span>
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