import { useEffect, useState } from 'react';
import { getOrders, updateOrderStatus, deleteOrder } from '../api.js';
import { Avatar } from '../components/Avatar.jsx';
import { StatusBadge, STATUS_COLORS, STATUS_BG } from '../components/StatusBadge.jsx';

const STATUSES = ['NEW ORDER','FOR PICK UP','PROCESSING','FOR DELIVERY','COMPLETED'];

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [selected, setSelected] = useState(null);
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getOrders()
      .then(r => { setOrders(r.data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  async function handleStatusUpdate(id, status) {
    await updateOrderStatus(id, status);
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status } : o));
    setSelected(prev => prev?.id === id ? { ...prev, status } : prev);
  }

  async function handleDelete(id) {
    if (!confirm('Delete this order?')) return;
    await deleteOrder(id);
    setOrders(prev => prev.filter(o => o.id !== id));
    setSelected(null);
  }

  const filtered = orders.filter(o => {
    const ms = filterStatus === 'ALL' || o.status === filterStatus;
    const mq = o.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
                o.id?.toLowerCase().includes(search.toLowerCase());
    return ms && mq;
  });

  return (
    <div>
      <h2 style={{ fontSize: 18, fontWeight: 500, marginBottom: '1.25rem' }}>Orders</h2>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search name or order ID..."
          style={{ padding: '6px 12px', fontSize: 13, borderRadius: 6, border: '0.5px solid #ccc', width: 210 }}
        />
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          style={{ padding: '6px 10px', fontSize: 13, borderRadius: 6, border: '0.5px solid #ccc' }}
        >
          <option value="ALL">All statuses</option>
          {STATUSES.map(s => <option key={s}>{s}</option>)}
        </select>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 380px' : '1fr', gap: 16 }}>
        {/* Table */}
        <div style={{ background: '#fff', border: '0.5px solid #e8e8e0', borderRadius: 12, overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: '2rem', color: '#aaa', fontSize: 14 }}>Loading...</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f5f5f3' }}>
                  {['Order','Customer','Service','Pickup','Status','Paid'].map(h => (
                    <th key={h} style={{ padding: '9px 12px', textAlign: 'left', fontWeight: 500, fontSize: 12, color: '#888' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(o => (
                  <tr
                    key={o.id}
                    onClick={() => setSelected(selected?.id === o.id ? null : o)}
                    style={{ cursor: 'pointer', background: selected?.id === o.id ? '#f0f6ff' : 'transparent', borderTop: '0.5px solid #f0f0ec' }}
                  >
                    <td style={{ padding: '9px 12px', fontWeight: 500, color: '#185FA5' }}>{o.id}</td>
                    <td style={{ padding: '9px 12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <Avatar name={o.customer_name || '?'} size={26} />
                        {o.customer_name}
                      </div>
                    </td>
                    <td style={{ padding: '9px 12px', color: '#666' }}>{o.service_name}</td>
                    <td style={{ padding: '9px 12px', color: '#888', fontSize: 11 }}>
                      {o.pickup_date ? new Date(o.pickup_date).toLocaleString() : '—'}
                    </td>
                    <td style={{ padding: '9px 12px' }}><StatusBadge status={o.status} /></td>
                    <td style={{ padding: '9px 12px' }}>
                      <span style={{
                        fontSize: 11, padding: '2px 7px', borderRadius: 4,
                        background: o.paid ? '#EAF3DE' : '#FCEBEB',
                        color: o.paid ? '#3B6D11' : '#A32D2D'
                      }}>
                        {o.paid ? 'Paid' : 'Unpaid'}
                      </span>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: '#aaa', fontSize: 13 }}>
                      No orders found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Detail panel */}
        {selected && (
          <div style={{ background: '#fff', border: '0.5px solid #e8e8e0', borderRadius: 12, padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 16 }}>
              <div>
                <div style={{ fontWeight: 500, fontSize: 15 }}>{selected.id}</div>
                <div style={{ fontSize: 12, color: '#888' }}>
                  {selected.created_at ? new Date(selected.created_at).toLocaleString() : ''}
                </div>
              </div>
              <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#aaa' }}>×</button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <Avatar name={selected.customer_name || '?'} size={40} />
              <div>
                <div style={{ fontWeight: 500 }}>{selected.customer_name}</div>
                <div style={{ fontSize: 12, color: '#888' }}>{selected.customer_phone || 'No phone'}</div>
              </div>
            </div>

            {[
              ['Address', selected.address || selected.customer_address || '—'],
              ['Service', selected.service_name],
              ['Weight', selected.weight ? selected.weight + ' kg' : '—'],
              ['Amount', '₱' + Number(selected.price).toLocaleString()],
              ['Pickup', selected.pickup_date ? new Date(selected.pickup_date).toLocaleString() : '—'],
              ['FB Messenger', selected.fb_id ? '@' + selected.fb_id : '—'],
            ].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderTop: '0.5px solid #f0f0ec', fontSize: 13 }}>
                <span style={{ color: '#888' }}>{k}</span>
                <span style={{ fontWeight: 500 }}>{v}</span>
              </div>
            ))}

            {selected.xendit_invoice_url && (
              <a href={selected.xendit_invoice_url} target="_blank" rel="noreferrer"
                style={{ display: 'block', marginTop: 12, padding: '7px', fontSize: 13, borderRadius: 6, background: '#EAF3DE', color: '#3B6D11', textAlign: 'center', textDecoration: 'none' }}>
                View payment link
              </a>
            )}

            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>Update status</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {STATUSES.map(s => (
                  <button key={s} onClick={() => handleStatusUpdate(selected.id, s)} style={{
                    padding: '4px 9px', fontSize: 11, borderRadius: 4, cursor: 'pointer',
                    background: selected.status === s ? STATUS_COLORS[s] : STATUS_BG[s],
                    color: selected.status === s ? '#fff' : STATUS_COLORS[s],
                    border: '0.5px solid ' + STATUS_COLORS[s],
                    fontWeight: selected.status === s ? 500 : 400,
                  }}>{s}</button>
                ))}
              </div>
            </div>

            <button
              onClick={() => handleDelete(selected.id)}
              style={{ marginTop: 14, width: '100%', padding: '8px', fontSize: 13, borderRadius: 6, cursor: 'pointer', background: '#FCEBEB', border: '0.5px solid #F09595', color: '#A32D2D' }}>
              Delete order
            </button>
          </div>
        )}
      </div>
    </div>
  );
}