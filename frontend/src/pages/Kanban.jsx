import { useEffect, useState } from 'react';
import { getOrders, updateOrderStatus, updateOrder, cancelOrder, sendInvoice, getMyTenantSettings } from '../api.js';
import { pdf } from '@react-pdf/renderer';
import InvoiceDocument from '../components/InvoiceDocument.jsx';
import { Avatar } from '../components/Avatar.jsx';
import { STATUS_COLORS, STATUS_BG } from '../components/StatusBadge.jsx';

const STATUSES = ['NEW ORDER','FOR PICK UP','PROCESSING','FOR DELIVERY','COMPLETED'];
const STATUS_ICONS  = { 'NEW ORDER':'⭐','FOR PICK UP':'⬆️','PROCESSING':'⚙️','FOR DELIVERY':'🚚','COMPLETED':'✅' };
const STATUS_LABELS = { 'NEW ORDER':'New','FOR PICK UP':'For Pick Up','PROCESSING':'Processing','FOR DELIVERY':'For Delivery','COMPLETED':'Completed' };

// Which statuses use pickup_date for urgency vs delivery_date
const PICKUP_STATUSES   = new Set(['NEW ORDER', 'FOR PICK UP']);
const DELIVERY_STATUSES = new Set(['PROCESSING', 'FOR DELIVERY']);

// ── Urgency helpers ─────────────────────────────────────────────────────────

function startOfDay(d) {
  const x = new Date(d); x.setHours(0,0,0,0); return x;
}

function getUrgency(g) {
  if (g.status === 'COMPLETED') return 'normal';

  const today    = startOfDay(new Date());
  const tomorrow = startOfDay(new Date()); tomorrow.setDate(tomorrow.getDate() + 1);
  const in3      = startOfDay(new Date()); in3.setDate(in3.getDate() + 3);

  const usePickup   = PICKUP_STATUSES.has(g.status);
  const useDelivery = DELIVERY_STATUSES.has(g.status);

  let dateStr = usePickup ? g.pickup_date : useDelivery ? g.delivery_date : null;
  if (!dateStr) return 'normal';

  const d = startOfDay(new Date(dateStr));
  if (isNaN(d.getTime())) return 'normal';

  if (d < today)                          return 'overdue';
  if (d.getTime() === today.getTime())    return 'due-today';
  if (d.getTime() === tomorrow.getTime()) return 'due-tomorrow';
  if (d <= in3)                           return 'upcoming';
  return 'normal';
}

const URGENCY_META = {
  'overdue':      { label: 'Overdue',    border: '#DC2626', bg: '#FCEBEB', color: '#A32D2D', dot: '🔴' },
  'due-today':    { label: 'Due Today',  border: '#D97706', bg: '#FEF3C7', color: '#92400E', dot: '🟡' },
  'due-tomorrow': { label: 'Tomorrow',   border: '#F59E0B', bg: '#FFF7ED', color: '#C2410C', dot: '🟠' },
  'upcoming':     { label: 'Soon',       border: '#60A5FA', bg: '#EFF6FF', color: '#1D4ED8', dot: '🔵' },
  'normal':       { label: '',           border: null,      bg: null,      color: null,      dot: '' },
};

const URGENCY_SORT = { 'overdue': 0, 'due-today': 1, 'due-tomorrow': 2, 'upcoming': 3, 'normal': 4 };

function sortByUrgency(groups) {
  return [...groups].sort((a, b) => {
    const ua = URGENCY_SORT[getUrgency(a)];
    const ub = URGENCY_SORT[getUrgency(b)];
    if (ua !== ub) return ua - ub;
    // Within same urgency, sort by relevant date ascending
    const da = new Date(a.delivery_date || a.pickup_date || 0);
    const db = new Date(b.delivery_date || b.pickup_date || 0);
    return da - db;
  });
}

function fmtDate(str) {
  if (!str) return '—';
  return new Date(str).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
}
function fmtDateTime(str) {
  if (!str) return '—';
  return new Date(str).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ── Group helper ────────────────────────────────────────────────────────────

function groupByBookingRef(orders) {
  const map = new Map();
  for (const o of orders) {
    const key = o.booking_ref || o.id;
    if (!map.has(key)) map.set(key, { ...o, price: 0, services: [], orderIds: [] });
    const g = map.get(key);
    g.price += Number(o.price);
    g.services.push({
      service_name: o.service_name,
      price: Number(o.price),
      weight: o.weight,
      service_unit_price: o.service_unit_price,
      service_unit: o.service_unit,
      custom_selections: o.custom_selections,
    });
    g.orderIds.push(o.id);
    if (o.promo_code && !g.promo_code) g.promo_code = o.promo_code;
    if (Number(o.promo_discount) > 0 && !g.promo_discount) g.promo_discount = Number(o.promo_discount);
    if (Number(o.delivery_fee) > 0 && !g.delivery_fee) g.delivery_fee = Number(o.delivery_fee);
  }
  return Array.from(map.values());
}

// ── Component ───────────────────────────────────────────────────────────────

export default function Kanban() {
  const [orders,     setOrders]     = useState([]);
  const [dragIds,    setDragIds]    = useState(null);
  const [dragOver,   setDragOver]   = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [expanded,   setExpanded]   = useState(new Set());
  const [modalOrder, setModalOrder] = useState(null);
  const [alertDismissed, setAlertDismissed] = useState(false);
  const [cancelling,    setCancelling]    = useState(false);
  const [cancelResult,  setCancelResult]  = useState(null);
  const [shopInfo,       setShopInfo]       = useState(null);
  const [invoiceSending, setInvoiceSending] = useState(false);
  const [invoiceResult,  setInvoiceResult]  = useState('');

  // Delivery date override state (inside modal)
  const [editingDelivery, setEditingDelivery] = useState(false);
  const [deliveryInput,   setDeliveryInput]   = useState('');
  const [deliverySaving,  setDeliverySaving]  = useState(false);

  useEffect(() => {
    getOrders()
      .then(r => { setOrders(r.data); setLoading(false); })
      .catch(() => setLoading(false));
    getMyTenantSettings().then(r => setShopInfo(r.data)).catch(() => {});
  }, []);

  async function moveStatus(orderIds, status) {
    const ids = Array.isArray(orderIds) ? orderIds : [orderIds];
    setOrders(prev => prev.map(o => ids.includes(o.id) ? { ...o, status } : o));
    try { await Promise.all(ids.map(id => updateOrderStatus(id, status))); }
    catch { getOrders().then(r => setOrders(r.data)); }
  }

  async function handleMarkPaid() {
    if (!confirm(`Mark ${modalOrder.booking_ref || modalOrder.id} as PAID?`)) return;
    try {
      await Promise.all(modalOrder.orderIds.map(id => updateOrder(id, { paid: true })));
      setModalOrder(prev => prev ? { ...prev, paid: true } : prev);
      setOrders(prev => prev.map(o => modalOrder.orderIds.includes(o.id) ? { ...o, paid: true } : o));
    } catch (e) { alert('Failed: ' + (e.response?.data?.error || e.message)); }
  }

  async function handleDownloadInvoice() {
    if (!shopInfo || !modalOrder) return;
    const blob = await pdf(<InvoiceDocument order={modalOrder} shop={shopInfo} />).toBlob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `invoice-${modalOrder.booking_ref || modalOrder.id}.pdf`; a.click();
    URL.revokeObjectURL(url);
  }

  async function handleSendInvoice() {
    const email = modalOrder?.customer_email;
    if (!email) { alert('No email on file for this customer.'); return; }
    if (!shopInfo) return;
    setInvoiceSending(true); setInvoiceResult('');
    try {
      const blob = await pdf(<InvoiceDocument order={modalOrder} shop={shopInfo} />).toBlob();
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result.split(',')[1];
        try {
          await sendInvoice(modalOrder.orderIds[0], base64, email);
          setInvoiceResult('ok');
        } catch (e) { setInvoiceResult('err:' + (e.response?.data?.error || e.message)); }
        setInvoiceSending(false);
      };
      reader.readAsDataURL(blob);
    } catch (e) { setInvoiceResult('err:' + e.message); setInvoiceSending(false); }
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

  function openModal(g, e) {
    e.stopPropagation();
    setModalOrder(g);
    setEditingDelivery(false);
    setDeliveryInput(g.delivery_date ? g.delivery_date.slice(0, 10) : '');
    setCancelResult(null);
    setInvoiceResult('');
  }

  async function saveDeliveryDate() {
    if (!modalOrder || !deliveryInput) return;
    setDeliverySaving(true);
    try {
      const iso = new Date(deliveryInput).toISOString();
      await Promise.all(modalOrder.orderIds.map(id => updateOrder(id, { delivery_date: iso })));
      setOrders(prev => prev.map(o =>
        modalOrder.orderIds.includes(o.id) ? { ...o, delivery_date: iso } : o
      ));
      setModalOrder(prev => ({ ...prev, delivery_date: iso }));
      setEditingDelivery(false);
    } catch { alert('Failed to update delivery date'); }
    setDeliverySaving(false);
  }

  // ── Urgency summary counts (all non-completed, non-new-order) ──
  const allGroups = groupByBookingRef(orders);
  const urgencyCounts = allGroups.reduce((acc, g) => {
    const u = getUrgency(g);
    if (u !== 'normal') acc[u] = (acc[u] || 0) + 1;
    return acc;
  }, {});
  const hasAlerts = Object.keys(urgencyCounts).length > 0;

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
      <div style={{ marginBottom: '1rem' }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#111827', letterSpacing: '-.3px' }}>Kanban Board</h1>
        <p style={{ fontSize: 13, color: '#374151', marginTop: 2 }}>Drag cards or use arrows to move orders. Click any card to view full details.</p>
      </div>

      {/* ── Urgency alert bar ── */}
      {hasAlerts && !alertDismissed && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, padding: '10px 14px', borderRadius: 10,
          background: urgencyCounts['overdue'] ? '#FCEBEB' : '#FEF3C7',
          border: `1px solid ${urgencyCounts['overdue'] ? '#FECACA' : '#FCD34D'}` }}>
          <span style={{ fontSize: 16 }}>{urgencyCounts['overdue'] ? '🚨' : '⚠️'}</span>
          <div style={{ flex: 1, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {urgencyCounts['overdue'] && (
              <span style={{ fontSize: 13, fontWeight: 600, color: '#A32D2D' }}>
                🔴 {urgencyCounts['overdue']} overdue
              </span>
            )}
            {urgencyCounts['due-today'] && (
              <span style={{ fontSize: 13, fontWeight: 600, color: '#92400E' }}>
                🟡 {urgencyCounts['due-today']} due today
              </span>
            )}
            {urgencyCounts['due-tomorrow'] && (
              <span style={{ fontSize: 13, fontWeight: 600, color: '#C2410C' }}>
                🟠 {urgencyCounts['due-tomorrow']} due tomorrow
              </span>
            )}
            {urgencyCounts['upcoming'] && (
              <span style={{ fontSize: 13, fontWeight: 500, color: '#1D4ED8' }}>
                🔵 {urgencyCounts['upcoming']} upcoming
              </span>
            )}
          </div>
          <button onClick={() => setAlertDismissed(true)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#9CA3AF', padding: 0, lineHeight: 1 }}>×</button>
        </div>
      )}

      <div className="kanban-wrapper">
      <div className="kanban-board" style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10, alignItems: 'start' }}>
        {STATUSES.map(status => {
          const raw = groupByBookingRef(orders.filter(o => o.status === status));
          const col = sortByUrgency(raw);
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
                  <button onClick={() => setColExpanded(col, !allExpanded)} title={allExpanded ? 'Minimize all' : 'Expand all'}
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
                const gKey     = g.booking_ref || g.id;
                const isExpanded = expanded.has(gKey);
                const urgency  = getUrgency(g);
                const umeta    = URGENCY_META[urgency];
                const cardBorderLeft = umeta.border
                  ? `3px solid ${umeta.border}`
                  : `3px solid ${STATUS_COLORS[status]}`;

                // Which date label to show on card
                const showDate = PICKUP_STATUSES.has(g.status)
                  ? g.pickup_date
                  : DELIVERY_STATUSES.has(g.status)
                    ? g.delivery_date
                    : null;

                return (
                  <div key={gKey}
                    draggable
                    onDragStart={() => setDragIds(g.orderIds)}
                    onDragEnd={() => { setDragIds(null); setDragOver(null); }}
                    onClick={e => openModal(g, e)}
                    className={urgency === 'overdue' ? 'card-overdue' : ''}
                    style={{
                      background: '#fff',
                      border: '0.5px solid #E8E8E0',
                      borderLeft: cardBorderLeft,
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
                    {/* Always-visible header */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <Avatar name={g.customer_name || '?'} size={26} bg={STATUS_BG[status]} color={STATUS_COLORS[status]} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {g.customer_name || 'Unknown'}
                        </div>
                        <div style={{ fontSize: 10, color: '#374151', fontFamily: 'monospace' }}>{g.booking_ref || g.id}</div>
                      </div>
                      <button onClick={e => toggleCard(gKey, e)} title={isExpanded ? 'Minimize' : 'Expand'}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', fontSize: 11, padding: '2px', lineHeight: 1, flexShrink: 0 }}>
                        {isExpanded ? '▲' : '▼'}
                      </button>
                    </div>

                    {/* Urgency badge — always visible when urgent */}
                    {urgency !== 'normal' && (
                      <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 5, padding: '3px 7px', borderRadius: 6, background: umeta.bg }}>
                        <span style={{ fontSize: 10 }}>{umeta.dot}</span>
                        <span style={{ fontSize: 10, fontWeight: 700, color: umeta.color }}>{umeta.label}</span>
                        {showDate && (
                          <span style={{ fontSize: 10, color: umeta.color, marginLeft: 'auto', opacity: 0.85 }}>
                            {fmtDate(showDate)}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Price + paid */}
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
                          <div style={{ fontSize: 10, color: '#374151', marginTop: 5 }}>
                            📅 Pickup: {fmtDateTime(g.pickup_date)}
                          </div>
                        )}
                        {g.delivery_date && g.status !== 'COMPLETED' && (
                          <div style={{ fontSize: 10, marginTop: 3, fontWeight: 600, color: URGENCY_META[getUrgency(g)].color || '#374151' }}>
                            🚚 Deliver by: {fmtDate(g.delivery_date)}
                          </div>
                        )}
                        {/* Move buttons */}
                        <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
                          <button onClick={e => move(g, -1, e)} disabled={STATUSES.indexOf(g.status) === 0}
                            style={{ flex: 1, padding: '4px', fontSize: 11, borderRadius: 6, cursor: 'pointer', background: 'transparent', border: '0.5px solid #E0E0D8', color: '#374151', opacity: STATUSES.indexOf(g.status) === 0 ? 0.3 : 1, fontFamily: 'inherit', fontWeight: 500 }}>◀</button>
                          <button onClick={e => move(g, 1, e)} disabled={STATUSES.indexOf(g.status) === STATUSES.length - 1}
                            style={{ flex: 1, padding: '4px', fontSize: 11, borderRadius: 6, cursor: 'pointer', background: 'transparent', border: '0.5px solid #E0E0D8', color: '#374151', opacity: STATUSES.indexOf(g.status) === STATUSES.length - 1 ? 0.3 : 1, fontFamily: 'inherit', fontWeight: 500 }}>▶</button>
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

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16, color: '#111827' }}>Order Details</div>
                <div style={{ fontSize: 12, color: '#374151', fontFamily: 'monospace', marginTop: 2 }}>{modalOrder.booking_ref || modalOrder.id}</div>
              </div>
              {/* Urgency badge in modal header */}
              {getUrgency(modalOrder) !== 'normal' && (() => {
                const u = URGENCY_META[getUrgency(modalOrder)];
                return (
                  <div style={{ padding: '4px 10px', borderRadius: 20, background: u.bg, fontSize: 12, fontWeight: 700, color: u.color }}>
                    {u.dot} {u.label}
                  </div>
                );
              })()}
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

            {/* Info rows */}
            {[
              ['Address', modalOrder.address || modalOrder.customer_address || '—'],
              ['Pickup',  modalOrder.pickup_date ? fmtDateTime(modalOrder.pickup_date) : '—'],
              ['Notes',   modalOrder.notes || '—'],
            ].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '7px 0', borderTop: '0.5px solid #F0F0EC', fontSize: 13 }}>
                <span style={{ color: '#374151', flexShrink: 0 }}>{k}</span>
                <span style={{ fontWeight: 500, textAlign: 'right', color: '#111827', wordBreak: 'break-word' }}>{v}</span>
              </div>
            ))}

            {/* ── Full transaction breakdown ── */}
            <div style={{ borderTop: '0.5px solid #F0F0EC', marginTop: 6, paddingTop: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 8 }}>Order Breakdown</div>

              {/* Services */}
              {modalOrder.services?.length > 1
                ? modalOrder.services.map((s, i) => (
                    <div key={i} style={{ marginBottom: 6 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 500 }}>
                        <span>{s.service_name || 'Service'}</span>
                        <span>₱{(Number(s.price) - (i === 0 ? Number(modalOrder.delivery_fee || 0) : 0)).toLocaleString()}</span>
                      </div>
                      {s.weight > 0 && s.service_unit_price > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#6B7280', paddingLeft: 8, paddingTop: 2 }}>
                          <span>{s.weight} {s.service_unit || 'unit'} × ₱{Number(s.service_unit_price).toLocaleString()}</span>
                        </div>
                      )}
                      {s.custom_selections?.map((sel, j) => sel.value ? (
                        <div key={j} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#6B7280', paddingLeft: 8, paddingTop: 2 }}>
                          <span>{sel.label}: {sel.value}</span>
                          {sel.unit_price > 0 && <span>+₱{Number(sel.unit_price).toLocaleString()}</span>}
                        </div>
                      ) : null)}
                    </div>
                  ))
                : (
                    <div style={{ marginBottom: 6 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 500 }}>
                        <span>{modalOrder.services?.[0]?.service_name || modalOrder.service_name || 'Service'}</span>
                        <span>₱{(Number(modalOrder.price) - Number(modalOrder.delivery_fee || 0)).toLocaleString()}</span>
                      </div>
                      {modalOrder.weight > 0 && modalOrder.services?.[0]?.service_unit_price > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#6B7280', paddingLeft: 8, paddingTop: 2 }}>
                          <span>{modalOrder.weight} {modalOrder.services?.[0]?.service_unit || 'unit'} × ₱{Number(modalOrder.services?.[0]?.service_unit_price).toLocaleString()}</span>
                        </div>
                      )}
                      {modalOrder.services?.[0]?.custom_selections?.map((sel, j) => sel.value ? (
                        <div key={j} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#6B7280', paddingLeft: 8, paddingTop: 2 }}>
                          <span>{sel.label}: {sel.value}</span>
                          {sel.unit_price > 0 && <span>+₱{Number(sel.unit_price).toLocaleString()}</span>}
                        </div>
                      ) : null)}
                    </div>
                  )
              }

              {/* Delivery fee */}
              {Number(modalOrder.delivery_fee) > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 13 }}>
                  <span style={{ color: '#374151' }}>Delivery{modalOrder.delivery_zone ? ` — ${modalOrder.delivery_zone}` : ''}</span>
                  <span style={{ fontWeight: 500 }}>₱{Number(modalOrder.delivery_fee).toLocaleString()}</span>
                </div>
              )}

              {/* Promo */}
              {Number(modalOrder.promo_discount) > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 13 }}>
                  <span style={{ color: '#7C3AED', fontWeight: 600 }}>🎟️ Promo{modalOrder.promo_code ? ` (${modalOrder.promo_code})` : ''}</span>
                  <span style={{ fontWeight: 700, color: '#7C3AED' }}>−₱{Number(modalOrder.promo_discount).toLocaleString()}</span>
                </div>
              )}

              {/* Grand total */}
              {(() => {
                const servicesTotal = (modalOrder.services?.reduce((s, o) => s + Number(o.price), 0) ?? Number(modalOrder.price)) - Number(modalOrder.delivery_fee || 0);
                const grandTotal = servicesTotal + Number(modalOrder.delivery_fee || 0) - Number(modalOrder.promo_discount || 0);
                return (
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: '0.5px solid #e8e8e0', marginTop: 4, fontSize: 14 }}>
                    <span style={{ fontWeight: 700 }}>Total</span>
                    <span style={{ fontWeight: 700, color: '#111827' }}>₱{grandTotal.toLocaleString()}</span>
                  </div>
                );
              })()}

              {/* Paid status */}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 13 }}>
                <span style={{ color: '#374151' }}>Payment</span>
                <span style={{ fontWeight: 600, color: modalOrder.paid ? '#3B6D11' : '#A32D2D' }}>
                  {modalOrder.paid ? '✓ Paid' : '✗ Unpaid'}
                </span>
              </div>
            </div>

            {/* Delivery date row — editable */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '7px 0', borderTop: '0.5px solid #F0F0EC', fontSize: 13 }}>
              <span style={{ color: '#374151', flexShrink: 0 }}>🚚 Deliver by</span>
              {editingDelivery ? (
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input type="date" value={deliveryInput} onChange={e => setDeliveryInput(e.target.value)}
                    style={{ padding: '4px 8px', fontSize: 12, borderRadius: 6, border: '1px solid #D1D5DB', fontFamily: 'inherit' }} />
                  <button onClick={saveDeliveryDate} disabled={deliverySaving}
                    style={{ padding: '4px 10px', fontSize: 11, fontWeight: 600, borderRadius: 5, border: 'none', background: '#38a9c2', color: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>
                    {deliverySaving ? '…' : 'Save'}
                  </button>
                  <button onClick={() => setEditingDelivery(false)}
                    style={{ padding: '4px 8px', fontSize: 11, borderRadius: 5, border: '0.5px solid #ccc', background: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>
                    ✕
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontWeight: 600, color: modalOrder.delivery_date ? URGENCY_META[getUrgency(modalOrder)].color || '#111827' : '#9CA3AF' }}>
                    {modalOrder.delivery_date ? fmtDate(modalOrder.delivery_date) : 'Not set'}
                  </span>
                  <button onClick={() => { setEditingDelivery(true); setDeliveryInput(modalOrder.delivery_date ? modalOrder.delivery_date.slice(0,10) : ''); }}
                    style={{ fontSize: 10, padding: '2px 7px', borderRadius: 4, border: '0.5px solid #D1D5DB', background: '#F7F7F5', cursor: 'pointer', color: '#374151', fontFamily: 'inherit' }}>
                    ✎ Edit
                  </button>
                </div>
              )}
            </div>

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

            {/* ── Mark as Paid ── */}
            {!modalOrder.paid && (
              <button onClick={handleMarkPaid}
                style={{ marginTop: 8, width: '100%', padding: '8px', fontSize: 13, borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, background: '#F0FDF4', border: '0.5px solid #86EFAC', color: '#166534' }}>
                💰 Mark as Paid
              </button>
            )}

            {/* ── Invoice ── */}
            <div style={{ marginTop: 10, paddingTop: 10, borderTop: '0.5px solid #E8E8E0' }}>
              <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 6 }}>Invoice</div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={handleDownloadInvoice} style={{ flex: 1, padding: '8px', fontSize: 12, borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit', background: '#EFF6FF', border: '0.5px solid #BFDBFE', color: '#1D4ED8', fontWeight: 600 }}>
                  📄 Download PDF
                </button>
                <button onClick={handleSendInvoice} disabled={invoiceSending} style={{ flex: 1, padding: '8px', fontSize: 12, borderRadius: 6, cursor: invoiceSending ? 'not-allowed' : 'pointer', fontFamily: 'inherit', background: '#F0FDF4', border: '0.5px solid #86EFAC', color: '#166534', fontWeight: 600 }}>
                  {invoiceSending ? '⏳ Sending…' : '📧 Send to Email'}
                </button>
              </div>
              {invoiceResult === 'ok' && <div style={{ marginTop: 6, fontSize: 12, color: '#166534' }}>✅ Invoice sent to {modalOrder.customer_email}</div>}
              {invoiceResult.startsWith?.('err:') && <div style={{ marginTop: 6, fontSize: 12, color: '#DC2626' }}>⚠️ {invoiceResult.slice(4)}</div>}
            </div>

            {/* ── Cancel Order ── */}
            {modalOrder.status !== 'CANCELLED' && (
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: '0.5px solid #E8E8E0' }}>
                {cancelResult ? (
                  <div style={{
                    padding: '10px 14px', borderRadius: 8, fontSize: 13,
                    background: cancelResult.refund_status === 'success' ? '#EAF3DE' : '#FEF3C7',
                    border: `1px solid ${cancelResult.refund_status === 'success' ? '#86EFAC' : '#FCD34D'}`,
                    color: cancelResult.refund_status === 'success' ? '#166534' : '#92400E',
                  }}>
                    {cancelResult.refund_status === 'success' ? '✅ ' : '⚠️ '}{cancelResult.message}
                  </div>
                ) : (
                  <button
                    onClick={async () => {
                      const isPaid = modalOrder.paid;
                      const confirmMsg = isPaid
                        ? `Cancel this order?\n\nThis order was paid — we'll attempt an auto-refund of ₱${Number(modalOrder.price).toLocaleString()} via Xendit.`
                        : `Cancel this order? This cannot be undone.`;
                      if (!confirm(confirmMsg)) return;
                      setCancelling(true);
                      try {
                        const { data } = await cancelOrder(modalOrder.orderIds[0]);
                        setCancelResult(data);
                        setOrders(prev => prev.map(o =>
                          modalOrder.orderIds.includes(o.id) ? { ...o, status: 'CANCELLED' } : o
                        ));
                        setModalOrder(prev => prev ? { ...prev, status: 'CANCELLED' } : prev);
                      } catch (e) {
                        alert('Error: ' + (e.response?.data?.error || e.message));
                      }
                      setCancelling(false);
                    }}
                    disabled={cancelling}
                    style={{ width: '100%', padding: '8px', fontSize: 13, fontWeight: 600, borderRadius: 7, border: '1px solid #FECACA', background: '#FEF2F2', color: '#DC2626', cursor: cancelling ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
                    {cancelling ? '⏳ Cancelling…' : '✕ Cancel Order'}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
