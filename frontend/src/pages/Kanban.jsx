import { useEffect, useState } from 'react';
import { getOrders, updateOrderStatus } from '../api.js';
import { Avatar } from '../components/Avatar.jsx';
import { STATUS_COLORS, STATUS_BG } from '../components/StatusBadge.jsx';

const STATUSES = ['NEW ORDER','FOR PICK UP','PROCESSING','FOR DELIVERY','COMPLETED'];
const STATUS_ICONS  = { 'NEW ORDER':'⭐','FOR PICK UP':'⬆️','PROCESSING':'⚙️','FOR DELIVERY':'🚚','COMPLETED':'✅' };
const STATUS_LABELS = { 'NEW ORDER':'New','FOR PICK UP':'For Pick Up','PROCESSING':'Processing','FOR DELIVERY':'For Delivery','COMPLETED':'Completed' };

export default function Kanban() {
  const [orders,  setOrders]  = useState([]);
  const [dragId,  setDragId]  = useState(null);
  const [dragOver, setDragOver] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getOrders()
      .then(r => { setOrders(r.data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  async function moveStatus(id, status) {
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status } : o));
    try { await updateOrderStatus(id, status); }
    catch { getOrders().then(r => setOrders(r.data)); }
  }

  function move(id, dir) {
    const o    = orders.find(x => x.id === id);
    const next = STATUSES[STATUSES.indexOf(o.status) + dir];
    if (next) moveStatus(id, next);
  }

  if (loading) {
    return (
      <div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          <div className="skeleton" style={{ height: 22, width: 120 }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10 }}>
          {STATUSES.map(s => (
            <div key={s} style={{ background: '#F7F7F5', borderRadius: 12, padding: 10 }}>
              <div className="skeleton" style={{ height: 28, marginBottom: 10 }} />
              {[1,2].map(i => <div key={i} className="skeleton" style={{ height: 110, marginBottom: 8, borderRadius: 10 }} />)}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-up">
      <div style={{ marginBottom: '1.25rem' }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#111827', letterSpacing: '-.3px' }}>Kanban Board</h1>
        <p style={{ fontSize: 13, color: '#9CA3AF', marginTop: 2 }}>Drag cards or use arrows to move orders through stages.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10, alignItems: 'start' }}>
        {STATUSES.map(status => {
          const col = orders.filter(o => o.status === status);
          const isDragTarget = dragOver === status;
          return (
            <div key={status}
              onDragOver={e => { e.preventDefault(); setDragOver(status); }}
              onDragLeave={() => setDragOver(null)}
              onDrop={e => { e.preventDefault(); if (dragId) moveStatus(dragId, status); setDragId(null); setDragOver(null); }}
              style={{
                background: isDragTarget ? '#EFF6FF' : '#F7F7F5',
                borderRadius: 12, padding: '10px 8px', minHeight: 200,
                border: isDragTarget ? '1.5px dashed #378ADD' : '1.5px solid transparent',
                transition: 'background .15s, border-color .15s',
              }}>

              {/* Column header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10, paddingBottom: 8, borderBottom: '0.5px solid #E8E8E0' }}>
                <div style={{ width: 26, height: 26, borderRadius: 7, background: STATUS_BG[status], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>
                  {STATUS_ICONS[status]}
                </div>
                <span style={{ fontSize: 11, fontWeight: 600, color: '#374151', flex: 1, lineHeight: 1.2 }}>
                  {STATUS_LABELS[status]}
                </span>
                <span style={{ fontSize: 11, background: STATUS_COLORS[status], color: '#fff', borderRadius: 20, padding: '2px 8px', fontWeight: 600 }}>
                  {col.length}
                </span>
              </div>

              {/* Cards */}
              {col.map(o => (
                <div key={o.id}
                  draggable
                  onDragStart={() => setDragId(o.id)}
                  onDragEnd={() => { setDragId(null); setDragOver(null); }}
                  style={{
                    background: '#fff',
                    border: '0.5px solid #E8E8E0',
                    borderLeft: `3px solid ${STATUS_COLORS[status]}`,
                    borderRadius: 10, padding: '10px 10px',
                    marginBottom: 8, cursor: 'grab',
                    opacity: dragId === o.id ? 0.45 : 1,
                    boxShadow: dragId === o.id ? 'none' : 'var(--shadow-xs)',
                    transition: 'opacity .15s, box-shadow .15s, transform .15s',
                    userSelect: 'none',
                  }}
                  onMouseEnter={e => { if (dragId !== o.id) e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                  onMouseLeave={e => { e.currentTarget.style.boxShadow = 'var(--shadow-xs)'; e.currentTarget.style.transform = 'translateY(0)'; }}
                >
                  {/* Customer row */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 7 }}>
                    <Avatar name={o.customer_name || '?'} size={26} bg={STATUS_BG[status]} color={STATUS_COLORS[status]} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {o.customer_name || 'Unknown'}
                      </div>
                      <div style={{ fontSize: 10, color: '#9CA3AF', fontFamily: 'monospace' }}>{o.id}</div>
                    </div>
                  </div>

                  <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 6, fontWeight: 500 }}>{o.service_name}</div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: STATUS_COLORS[status] }}>
                      ₱{Number(o.price).toLocaleString()}
                    </span>
                    <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 20, fontWeight: 600, background: o.paid ? '#EAF3DE' : '#FCEBEB', color: o.paid ? '#3B6D11' : '#A32D2D' }}>
                      {o.paid ? 'Paid' : 'Unpaid'}
                    </span>
                  </div>

                  {o.pickup_date && (
                    <div style={{ fontSize: 10, color: '#9CA3AF', marginBottom: 8 }}>
                      📅 {new Date(o.pickup_date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </div>
                  )}

                  {/* Move buttons */}
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button
                      onClick={() => move(o.id, -1)}
                      disabled={STATUSES.indexOf(o.status) === 0}
                      style={{
                        flex: 1, padding: '4px', fontSize: 11, borderRadius: 6, cursor: 'pointer',
                        background: 'transparent', border: '0.5px solid #E0E0D8', color: '#9CA3AF',
                        opacity: STATUSES.indexOf(o.status) === 0 ? 0.3 : 1,
                        fontFamily: 'inherit', fontWeight: 500,
                      }}>◀</button>
                    <button
                      onClick={() => move(o.id, 1)}
                      disabled={STATUSES.indexOf(o.status) === STATUSES.length - 1}
                      style={{
                        flex: 1, padding: '4px', fontSize: 11, borderRadius: 6, cursor: 'pointer',
                        background: 'transparent', border: '0.5px solid #E0E0D8', color: '#9CA3AF',
                        opacity: STATUSES.indexOf(o.status) === STATUSES.length - 1 ? 0.3 : 1,
                        fontFamily: 'inherit', fontWeight: 500,
                      }}>▶</button>
                  </div>
                </div>
              ))}

              {col.length === 0 && (
                <div style={{ textAlign: 'center', padding: '24px 0', color: '#D1D5DB', fontSize: 12 }}>
                  <div style={{ fontSize: 22, marginBottom: 6 }}>📭</div>
                  No orders
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
