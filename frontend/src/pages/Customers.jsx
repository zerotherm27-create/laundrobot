import { useEffect, useState } from 'react';
import { getCustomers, deleteCustomer } from '../api.js';
import { Avatar } from '../components/Avatar.jsx';

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [hideUnknown, setHideUnknown] = useState(true);
  const [sortBy, setSortBy] = useState('default');

  useEffect(() => {
    getCustomers().then(r => { setCustomers(r.data); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const filtered = customers
    .filter(c => !hideUnknown || (c.name && c.phone))
    .filter(c =>
      c.name?.toLowerCase().includes(search.toLowerCase()) ||
      c.phone?.includes(search) ||
      c.email?.toLowerCase().includes(search.toLowerCase()) ||
      c.fb_id?.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      if (sortBy === 'spent')    return Number(b.total_spent || 0) - Number(a.total_spent || 0);
      if (sortBy === 'quantity') return Number(b.total_orders || 0) - Number(a.total_orders || 0);
      return 0;
    });

  function downloadCSV() {
    const headers = ['Name', 'Phone', 'Email', 'Address', 'FB Messenger', 'Total Orders', 'Total Spent', 'Customer Since'];
    const rows = customers.map(c => [
      c.name || '',
      c.phone || '',
      c.email || '',
      c.address || '',
      c.fb_id || '',
      c.total_orders || 0,
      Number(c.total_spent || 0).toFixed(2),
      c.created_at ? new Date(c.created_at).toLocaleDateString() : '',
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `customers-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <h2 style={{ fontSize: 18, fontWeight: 500 }}>Customers</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 13, color: '#374151' }}>{customers.length} total customers</span>
          <button onClick={downloadCSV} disabled={!customers.length}
            style={{ padding: '6px 14px', fontSize: 13, borderRadius: 6, border: '0.5px solid #ccc', background: '#fff', cursor: 'pointer', color: '#374151', fontFamily: 'inherit' }}>
            ⬇ Download CSV
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, phone, email, or Messenger ID..."
          style={{ padding: '6px 12px', fontSize: 13, borderRadius: 6, border: '0.5px solid #ccc', width: 300 }} />
        <select value={sortBy} onChange={e => setSortBy(e.target.value)}
          style={{ padding: '6px 10px', fontSize: 13, borderRadius: 6, border: '0.5px solid #ccc', background: '#fff', color: '#374151', cursor: 'pointer' }}>
          <option value="default">Sort: Default</option>
          <option value="spent">Most Spent</option>
          <option value="quantity">Most Orders</option>
        </select>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#374151', cursor: 'pointer' }}>
          <input type="checkbox" checked={hideUnknown} onChange={e => setHideUnknown(e.target.checked)} />
          Hide unknown customers
        </label>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 320px' : '1fr', gap: 16 }}>
        <div style={{ background: '#fff', border: '0.5px solid #e8e8e0', borderRadius: 12, overflow: 'hidden' }}>
          {loading ? <div style={{ padding: '2rem', color: '#374151', fontSize: 14 }}>Loading...</div> : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f5f5f3' }}>
                  {['Customer','Phone','Email','FB Messenger','Orders','Spent'].map(h => (
                    <th key={h} style={{ padding: '9px 12px', textAlign: 'left', fontWeight: 500, fontSize: 12, color: '#374151' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => (
                  <tr key={c.id} onClick={() => setSelected(selected?.id === c.id ? null : c)}
                    style={{ borderTop: '0.5px solid #f0f0ec', cursor: 'pointer', background: selected?.id === c.id ? '#f0f6ff' : 'transparent' }}>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Avatar name={c.name || '?'} size={30} bg="#EEEDFE" color="#534AB7" />
                        <span style={{ fontWeight: 500 }}>{c.name || 'Unknown'}</span>
                      </div>
                    </td>
                    <td style={{ padding: '10px 12px', color: '#374151' }}>{c.phone || '—'}</td>
                    <td style={{ padding: '10px 12px', color: '#1a7d94' }}>{c.email || '—'}</td>
                    <td style={{ padding: '10px 12px', color: '#374151' }}>{c.fb_id ? '@' + c.fb_id : '—'}</td>
                    <td style={{ padding: '10px 12px', fontWeight: 500 }}>{c.total_orders || 0}</td>
                    <td style={{ padding: '10px 12px', fontWeight: 500, color: '#3B6D11' }}>₱{Number(c.total_spent || 0).toLocaleString()}</td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: '#374151', fontSize: 13 }}>No customers found</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Customer detail panel */}
        {selected && (
          <div style={{ background: '#fff', border: '0.5px solid #e8e8e0', borderRadius: 12, padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ fontWeight: 500, fontSize: 15 }}>Customer details</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button onClick={async () => {
                  if (!confirm(`Delete ${selected.name || 'this customer'}? This cannot be undone.`)) return;
                  try {
                    await deleteCustomer(selected.id);
                    setCustomers(prev => prev.filter(c => c.id !== selected.id));
                    setSelected(null);
                  } catch { alert('Failed to delete customer.'); }
                }} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 5, border: '0.5px solid #F09595', background: '#FCEBEB', color: '#A32D2D', cursor: 'pointer' }}>
                  Delete
                </button>
                <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#374151' }}>×</button>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <Avatar name={selected.name || '?'} size={48} bg="#EEEDFE" color="#534AB7" />
              <div>
                <div style={{ fontWeight: 500, fontSize: 16 }}>{selected.name || 'Unknown'}</div>
                <div style={{ fontSize: 12, color: '#374151' }}>Customer since {new Date(selected.created_at).toLocaleDateString()}</div>
              </div>
            </div>
            {[
              ['Phone', selected.phone || '—'],
              ['Email', selected.email || '—'],
              ['FB Messenger', selected.fb_id ? '@' + selected.fb_id : '—'],
              ['Address', selected.address || '—'],
              ['Total orders', selected.total_orders || 0],
              ['Total spent', '₱' + Number(selected.total_spent || 0).toLocaleString()],
            ].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderTop: '0.5px solid #f0f0ec', fontSize: 13 }}>
                <span style={{ color: '#374151' }}>{k}</span>
                <span style={{ fontWeight: 500 }}>{v}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}