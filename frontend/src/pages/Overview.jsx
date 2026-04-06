import { useEffect, useState } from 'react';
import { getOrders } from '../api.js';
import { Avatar } from '../components/Avatar.jsx';
import { StatusBadge, STATUS_COLORS } from '../components/StatusBadge.jsx';

const STATUSES = ['NEW ORDER','FOR PICK UP','PROCESSING','FOR DELIVERY','COMPLETED'];

export default function Overview() {
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    getOrders().then(r => setOrders(r.data)).catch(() => {});
  }, []);

  const revenue = orders.filter(o => o.paid).reduce((s, o) => s + Number(o.price), 0);
  const active = orders.filter(o => o.status !== 'COMPLETED').length;
  const today = new Date().toISOString().slice(0, 10);
  const todayOrders = orders.filter(o => o.created_at?.slice(0, 10) === today).length;

  return (
    <div>
      <h2 style={{ fontSize: 18, fontWeight: 500, marginBottom: '1.25rem' }}>Overview</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: '1.5rem' }}>
        {[
          { label: 'Total Revenue', val: '₱' + revenue.toLocaleString(), color: '#378ADD' },
          { label: 'Total Orders', val: orders.length, color: '#7F77DD' },
          { label: 'Active Orders', val: active, color: '#BA7517' },
          { label: 'Orders Today', val: todayOrders, color: '#1D9E75' },
        ].map(m => (
          <div key={m.label} style={{ background: '#f5f5f3', borderRadius: 8, padding: '1rem' }}>
            <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>{m.label}</div>
            <div style={{ fontSize: 26, fontWeight: 500, color: m.color }}>{m.val}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div style={{ background: '#fff', border: '0.5px solid #e8e8e0', borderRadius: 12, padding: '1rem' }}>
          <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 14 }}>Orders by status</div>
          {STATUSES.map(s => {
            const count = orders.filter(o => o.status === s).length;
            const pct = orders.length ? Math.round((count / orders.length) * 100) : 0;
            return (
              <div key={s} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                  <span style={{ color: '#666' }}>{s}</span>
                  <span style={{ fontWeight: 500 }}>{count}</span>
                </div>
                <div style={{ height: 6, background: '#f0f0ec', borderRadius: 4 }}>
                  <div style={{ height: 6, borderRadius: 4, width: pct + '%', background: STATUS_COLORS[s], transition: 'width 0.4s' }} />
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ background: '#fff', border: '0.5px solid #e8e8e0', borderRadius: 12, padding: '1rem' }}>
          <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 12 }}>Recent orders</div>
          {orders.slice(0, 7).map(o => (
            <div key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <Avatar name={o.customer_name || '?'} size={30} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{o.customer_name}</div>
                <div style={{ fontSize: 11, color: '#888' }}>{o.service_name}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 2 }}>₱{Number(o.price).toLocaleString()}</div>
                <StatusBadge status={o.status} />
              </div>
            </div>
          ))}
          {orders.length === 0 && <div style={{ fontSize: 13, color: '#aaa', textAlign: 'center', padding: '2rem 0' }}>No orders yet</div>}
        </div>
      </div>
    </div>
  );
}