import { useEffect, useState } from 'react';
import { getOrders, updateOrderStatus } from '../api.js';
import { Avatar } from '../components/Avatar.jsx';
import { STATUS_COLORS, STATUS_BG } from '../components/StatusBadge.jsx';

const STATUSES = ['NEW ORDER','FOR PICK UP','PROCESSING','FOR DELIVERY','COMPLETED'];
const STATUS_ICONS  = { 'NEW ORDER':'⭐','FOR PICK UP':'⬆️','PROCESSING':'⚙️','FOR DELIVERY':'🚚','COMPLETED':'✅' };
const STATUS_LABELS = { 'NEW ORDER':'New','FOR PICK UP':'For Pick Up','PROCESSING':'Processing','FOR DELIVERY':'For Delivery','COMPLETED':'Completed' };

function groupByBookingRef(orders) {
  const map = new Map();
  for (const o of orders) {
    const key = o.booking_ref || o.id;
    if (!map.has(key)) map.set(key, { ...o, price: 0, services: [], orderIds: [] });
    const g = map.get(key);
    g.price += Number(o.price);
    g.services.push({ service_name: o.service_name, price: Number(o.price) });
    g.orderIds.push(o.id);
  }
  return Array.from(map.values());
}

export default function Kanban() {
  const [orders,     setOrders]     = useState([]);
  const [dragIds,    setDragIds]    = useState(null);
  const [dragOver,   setDragOver]   = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [expanded,   setExpanded]   = useState(new Set()); // card IDs in expanded view
  const [modalOrder, setModalOrder] = useState(null);      // order shown in detail modal

  useEffect(() => {
    getOrders()
      .then(r => { setOrders(r.data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  async function moveStatus(orderIds, status) {
    const ids = Array.isArray(orderIds) ? orderIds : [orderIds];
    setOrders(prev => prev.map(o => ids.includes(o.id) ? { ...o, status } : o));
    try { await Promise.all(ids.map(id => updateOrderStatus(id, status))); }
    catch { getOrders().then(r => setOrders(r.data)); }
  }

  function move(g, dir, e) {
    e.stopPropagation();
    const next = STATUSES[STATUSES.indexOf(g.status) + dir];
    if (next) moveStatus(g.orderIds, next);
  }

  function toggleCard(gKey, e) {
    e.stopPropagation();
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(gKey)) next.delete(gKey); else next.add(gKey);
      return next;
    });
  }

  function setColExpanded(colGroups, expand) {
    setExpanded(prev => {
      const next = new Set(prev);
      colGroups.forEach(g => {
        const key = g.booking_ref || g.id;
        expand ? next.add(key) : next.delete(key);
      });
      return next;
    });
  }

  function openModal(o, e) {
    e.stopPropagation();
    setModalOrder(o);
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
              {[1,2].map(i => <div key={i} className="skeleton" style={{ height: 80, marginBottom: 8, borderRadius: 10 }} />)}
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
        <p style={{ fontSize: 13, color: '#374151', marginTop: 2 }}>Drag cards or use arrows to move orders. Click any card to view full details.</p>
      </div>

      <div className="kanban-wrapper">
      <div className="kanban-board" style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10, alignItems: 'start' }}>
        {STATUSES.map(status => {
          const col = groupByBookingRef(orders.filter(o => o.status === status));
          const isDragTarget = dragOver === status;
          const allExpanded  = col.length > 0 && col.every(g => expanded.has(g.booking_ref || g.id));

          return (
            <div key={status}
              onDragOver={e => { e.preventDefault(); setDragOver(status); }}
              onDragLeave={() => setDragOver(null)}
              onDrop={e => { e.preventDefault(); if (dragIds) moveStatus(dragIds, status); setDragIds(null); setDragOver(null); }}
              style={{
                background: isDragTarget ? '#EFF6FF' : '#F7F7F5',
                borderRadius: 12, padding: '10px 8px', minHeight: 200,
                border: isDragTarget ? '1.5px dashed #38a9c2' : '1.5px solid transparent',
                transition: 'background .15s, border-color .15s',
              }}>

              {/* Column header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, paddingBottom: 8, borderBottom: '0.5px solid #E8E8E0' }}>
                <div style={{ width: 26, height: 26, borderRadius: 7, background: STATUS_BG[status], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0 }}>
                  {STATUS_ICONS[status]}
                </div>
                <span style={{ fontSize: 11, fontWeight: 600, color: '#374151', flex: 1, lineHeight: 1.2 }}>
                  {STATUS_LABELS[status]}
                </span>
                {col.length > 0 && (
                  <button
                    onClick={() => setColExpanded(col, !allExpanded)}
                    title={allExpanded ? 'Minimize all' : 'Expand all'}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#374151', padding: '2px 3px', borderRadius: 4, lineHeight: 1, flexShrink: 0 }}>
                    {allExpanded ? '⊟' : '⊞'}
                  </button>
                )}
                <span style={{ fontSize: 11, background: STATUS_COLORS[status], color: '#fff', borderRadius: 20, padding: '2px 8px', fontWeight: 600, flexShrink: 0 }}>
                  {col.length}
                </span>
              </div>

              {/* Cards */}
              {col.map(g => {
                const gKey = g.booking_ref || g.id;
                const isExpanded = expanded.has(gKey);
                return (
                  <div key={gKey}
                    draggable
                    onDragStart={() => setDragIds(g.orderIds)}
                    onDragEnd={() => { setDragIds(null); setDragOver(null); }}
                    onClick={e => openModal(g, e)}
                    style={{
                      background: '#fff',
                      border: '0.5px solid #E8E8E0',
                      borderLeft: `3px solid ${STATUS_COLORS[status]}`,
                      borderRadius: 10, padding: '9px 10px',
                      marginBottom: 8, cursor: 'pointer',
                      opacity: dragIds?.some(id => g.orderIds.includes(id)) ? 0.45 : 1,
                      boxShadow: dragIds?.some(id => g.orderIds.includes(id)) ? 'none' : 'var(--shadow-xs)',
                      transition: 'opacity .15s, box-shadow .15s, transform .15s',
                      userSelect: 'none',
                    }}
                    onMouseEnter={e => { if (!dragIds) { e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; e.currentTarget.style.transform = 'translateY(-1px)'; } }}
                    onMouseLeave={e => { e.currentTarget.style.boxShadow = 'var(--shadow-xs)'; e.currentTarget.style.transform = 'translateY(0)'; }}
                  >
                    {/* Always-visible header row */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <Avatar name={g.customer_name || '?'} size={26} bg={STATUS_BG[status]} color={STATUS_COLORS[status]} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {g.customer_name || 'Unknown'}
                        </div>
                        <div style={{ fontSize: 10, color: '#374151', fontFamily: 'monospace' }}>{g.booking_ref || g.id}</div>
                      </div>
                      <button onClick={e => toggleCard(gKey, e)}
                        title={isExpanded ? 'Minimize' : 'Expand'}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', fontSize: 11, padding: '2px', lineHeight: 1, flexShrink: 0 }}>
                        {isExpanded ? '▲' : '▼'}
                      </button>
                    </div>

                    {/* Price + paid — always visible */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 7 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: STATUS_COLORS[status] }}>
                        ₱{Number(g.price).toLocaleString()}
                      </span>
                      <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 20, fontWeight: 600, background: g.paid ? '#EAF3DE' : '#FCEBEB', color: g.paid ? '#3B6D11' : '#A32D2D' }}>
                        {g.paid ? 'Paid' : 'Unpaid'}
                      </span>
                    </div>

                    {/* Expanded content */}
                    {isExpanded && (
                      <>
                        {g.services.length > 1 ? (
                          <div style={{ marginTop: 6 }}>
                            {g.services.map((s, i) => (
                              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#374151', marginTop: i === 0 ? 0 : 3 }}>
                                <span>{s.service_name}</span>
                                <span style={{ fontWeight: 600 }}>₱{s.price.toLocaleString()}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          g.services[0]?.service_name && (
                            <div style={{ fontSize: 11, color: '#374151', marginTop: 6, fontWeight: 500 }}>{g.services[0].service_name}</div>
                          )
                        )}
                        {g.pickup_date && (
                          <div style={{ fontSize: 10, color: '#374151', marginTop: 4 }}>
                            📅 {new Date(g.pickup_date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </div>
                        )}
                        {/* Move buttons */}
                        <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
                          <button
                            onClick={e => move(g, -1, e)}
                            disabled={STATUSES.indexOf(g.status) === 0}
                            style={{
                              flex: 1, padding: '4px', fontSize: 11, borderRadius: 6, cursor: 'pointer',
                              background: 'transparent', border: '0.5px solid #E0E0D8', color: '#374151',
                              opacity: STATUSES.indexOf(g.status) === 0 ? 0.3 : 1,
                              fontFamily: 'inherit', fontWeight: 500,
                            }}>◀</button>
                          <button
                            onClick={e => move(g, 1, e)}
                            disabled={STATUSES.indexOf(g.status) === STATUSES.length - 1}
                            style={{
                              flex: 1, padding: '4px', fontSize: 11, borderRadius: 6, cursor: 'pointer',
                              background: 'transparent', border: '0.5px solid #E0E0D8', color: '#374151',
                              opacity: STATUSES.indexOf(g.status) === STATUSES.length - 1 ? 0.3 : 1,
                              fontFamily: 'inherit', fontWeight: 500,
                            }}>▶</button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}

              {col.length === 0 && (
                <div style={{ textAlign: 'center', padding: '24px 0', color: '#374151', fontSize: 12 }}>
                  <div style={{ fontSize: 22, marginBottom: 6 }}>📭</div>
                  No orders
                </div>
              )}
            </div>
          );
        })}
      </div>
      </div>

      {/* ── Order Detail Modal ── */}
      {modalOrder && (
        <div className="modal-overlay" onClick={() => setModalOrder(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}
            style={{ width: 420, padding: '1.5rem', maxHeight: '90vh', overflowY: 'auto' }}>

            {/* Modal header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16, color: '#111827' }}>Order Details</div>
                <div style={{ fontSize: 12, color: '#374151', fontFamily: 'monospace', marginTop: 2 }}>{modalOrder.booking_ref || modalOrder.id}</div>
              </div>
              <button onClick={() => setModalOrder(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: '#374151', lineHeight: 1, padding: 0 }}>×</button>
            </div>

            {/* Customer */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: '#F7F9FC', borderRadius: 10, marginBottom: 16 }}>
              <Avatar name={modalOrder.customer_name || '?'} size={42} />
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: '#111827' }}>{modalOrder.customer_name || 'Unknown'}</div>
                <div style={{ fontSize: 12, color: '#374151', marginTop: 2 }}>{modalOrder.customer_phone || 'No phone'}</div>
              </div>
            </div>

            {/* Detail rows */}
            {[
              ['Service',  modalOrder.services?.length > 1
                ? modalOrder.services.map(s => s.service_name).join(', ')
                : (modalOrder.services?.[0]?.service_name || modalOrder.service_name || '—')],
              ['Address',  modalOrder.address || modalOrder.customer_address || '—'],
              ['Weight',   modalOrder.weight ? modalOrder.weight + ' kg' : '—'],
              ['Amount',   '₱' + Number(modalOrder.price).toLocaleString()],
              ['Pickup',   modalOrder.pickup_date ? new Date(modalOrder.pickup_date).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' }) : '—'],
              ['Notes',    modalOrder.notes || '—'],
              ['Paid',     modalOrder.paid ? '✓ Paid' : '✗ Unpaid'],
            ].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '7px 0', borderTop: '0.5px solid #F0F0EC', fontSize: 13 }}>
                <span style={{ color: '#374151', flexShrink: 0 }}>{k}</span>
                <span style={{ fontWeight: 500, textAlign: 'right', color: k === 'Paid' ? (modalOrder.paid ? '#3B6D11' : '#A32D2D') : '#111827', wordBreak: 'break-word' }}>{v}</span>
              </div>
            ))}

            {modalOrder.xendit_invoice_url && (
              <a href={modalOrder.xendit_invoice_url} target="_blank" rel="noreferrer"
                style={{ display: 'block', marginTop: 10, padding: '8px', textAlign: 'center', background: '#EAF3DE', color: '#3B6D11', borderRadius: 8, textDecoration: 'none', fontSize: 13, fontWeight: 600 }}>
                💳 View Payment Link
              </a>
            )}

            {/* Status update */}
            <div style={{ marginTop: 16, paddingTop: 14, borderTop: '0.5px solid #E8E8E0' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 8 }}>Update Status</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {STATUSES.map(s => (
                  <button key={s} onClick={() => {
                    moveStatus(modalOrder.orderIds, s);
                    setModalOrder(prev => ({ ...prev, status: s }));
                  }} style={{
                    padding: '5px 10px', fontSize: 11, borderRadius: 6, cursor: 'pointer',
                    background: modalOrder.status === s ? STATUS_COLORS[s] : STATUS_BG[s],
                    color: modalOrder.status === s ? '#fff' : STATUS_COLORS[s],
                    border: '0.5px solid ' + STATUS_COLORS[s],
                    fontWeight: modalOrder.status === s ? 600 : 400,
                    fontFamily: 'inherit',
                  }}>{s}</button>
                ))}
              </div>
            </div>

            <div style={{ marginTop: 8, fontSize: 11, color: '#9CA3AF', textAlign: 'center' }}>
              Created {modalOrder.created_at ? new Date(modalOrder.created_at).toLocaleDateString('en-PH', { dateStyle: 'medium' }) : '—'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
