import { useEffect, useState, useCallback } from 'react';
import { getOrders, getArchivedOrders, archiveOrderMonth, updateOrderStatus, updateOrder, updateBooking, notifyOrderUpdate, deleteOrder, getServices, generatePaymentLink } from '../api.js';
import { Avatar } from '../components/Avatar.jsx';
import { StatusBadge, STATUS_COLORS, STATUS_BG } from '../components/StatusBadge.jsx';
import CreateOrderModal from './CreateOrderModal.jsx';

const STATUSES = ['NEW ORDER','FOR PICK UP','PROCESSING','FOR DELIVERY','COMPLETED'];

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function groupByBookingRef(orders) {
  const map = new Map();
  for (const o of orders) {
    const key = o.booking_ref || o.id;
    if (!map.has(key)) map.set(key, { ...o, price: 0, services: [], orderIds: [] });
    const g = map.get(key);
    g.price += Number(o.price);
    g.services.push({ service_name: o.service_name, price: Number(o.price), custom_selections: o.custom_selections });
    g.orderIds.push(o.id);
  }
  return Array.from(map.values());
}

function groupByMonth(orders) {
  const groups = {};
  for (const o of orders) {
    const d = new Date(o.archived_at || o.created_at);
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    if (!groups[key]) groups[key] = { label: `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`, year: d.getFullYear(), month: d.getMonth()+1, orders: [] };
    groups[key].orders.push(o);
  }
  return Object.values(groups).sort((a, b) => `${b.year}-${b.month}` > `${a.year}-${a.month}` ? 1 : -1);
}

export default function Orders() {
  const [orders, setOrders]           = useState([]);
  const [archived, setArchived]       = useState([]);
  const [services, setServices]       = useState([]);
  const [view, setView]               = useState('active'); // 'active' | 'archives'
  const [selected, setSelected]       = useState(null);
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [search, setSearch]           = useState('');
  const [minAmt, setMinAmt]           = useState('');
  const [maxAmt, setMaxAmt]           = useState('');
  const [loading, setLoading]         = useState(true);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [expandedMonths, setExpandedMonths] = useState({});

  // Edit order
  const [editMode, setEditMode]       = useState(false);
  const [editForm, setEditForm]       = useState({});
  const [editItems, setEditItems]     = useState([]); // booking items [{id?, service_id, price, notes}]
  const [bookingRef, setBookingRef]   = useState(null);
  const [editCustomNote, setEditCustomNote]   = useState('');
  const [editCustomPrice, setEditCustomPrice] = useState('');
  const [editSaving, setEditSaving]   = useState(false);
  const [editErr, setEditErr]         = useState('');
  const [savedDiff, setSavedDiff]     = useState(null);
  const [copySuccess, setCopySuccess] = useState(false);

  // Messenger notify
  const [notifyMsg, setNotifyMsg]     = useState('');
  const [notifySending, setNotifySending] = useState(false);
  const [notifyResult, setNotifyResult]   = useState(''); // 'ok' | 'err:...'

  // Create order modal
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Payment link
  const [payLinkLoading, setPayLinkLoading] = useState(false);
  const [payLinkUrl,     setPayLinkUrl]     = useState('');   // generated or existing
  const [payLinkErr,     setPayLinkErr]     = useState('');
  const [payLinkCopied,  setPayLinkCopied]  = useState(false);

  const loadActive = useCallback(() => {
    setLoading(true);
    getOrders().then(r => setOrders(r.data)).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    getServices().then(r => setServices(r.data)).catch(() => {});
  }, []);

  const loadArchived = useCallback(() => {
    setArchiveLoading(true);
    getArchivedOrders().then(r => setArchived(r.data)).finally(() => setArchiveLoading(false));
  }, []);

  useEffect(() => { loadActive(); }, [loadActive]);

  function switchToArchives() {
    setView('archives');
    setSelected(null);
    if (!archived.length) loadArchived();
  }

  function enterEditMode(order) {
    setEditMode(true);
    setSavedDiff(null);
    setCopySuccess(false);
    setNotifyResult('');
    setNotifyMsg('');
    setEditErr('');

    setEditCustomNote('');
    setEditCustomPrice('');

    if (order.booking_ref) {
      const bookingOrders = orders.filter(o => o.booking_ref === order.booking_ref);
      setBookingRef(order.booking_ref);
      setEditItems(bookingOrders.map(o => ({
        id: o.id,
        service_id: o.service_id ? String(o.service_id) : '',
        price: Number(o.price),
        notes: (o.notes || '').replace(/\[Edited by admin[^\]]*\]/g, '').trim(),
      })));
    } else {
      setBookingRef(null);
      setEditItems([]);
      setEditForm({
        service_id: order.service_id || '',
        weight: order.weight || '',
        price: Number(order.price),
        notes: order.notes || '',
      });
    }
  }

  async function handleEditSave() {
    setEditSaving(true); setEditErr('');
    try {
      if (bookingRef) {
        const { data } = await updateBooking(bookingRef, editItems, editCustomNote, editCustomPrice);
        loadActive();
        setEditMode(false);
        setSavedDiff({ isBooking: true, ...data });
      } else {
        const oldPrice = Number(selected.price);
        const payload = {
          service_id: editForm.service_id || undefined,
          weight: editForm.weight !== '' ? editForm.weight : null,
          price: Number(editForm.price),
          notes: editForm.notes,
        };
        const { data: updated } = await updateOrder(selected.id, payload);
        const newSvc = services.find(s => s.id === Number(editForm.service_id));
        const updatedOrder = { ...selected, ...updated, service_name: newSvc?.name || selected.service_name, price: Number(editForm.price) };
        setOrders(prev => prev.map(o => o.id === selected.id ? updatedOrder : o));
        setSelected(updatedOrder);
        setEditMode(false);
        setSavedDiff({ isBooking: false, old_price: oldPrice, new_price: Number(editForm.price), diff: Number(editForm.price) - oldPrice });
      }
    } catch (e) {
      setEditErr(e.response?.data?.error || 'Failed to save changes.');
    } finally { setEditSaving(false); }
  }

  async function handleNotify() {
    setNotifySending(true); setNotifyResult('');
    try {
      await notifyOrderUpdate(selected.id, {
        old_price: savedDiff.old_price,
        new_price: savedDiff.new_price,
        new_service_name: selected.service_name,
        message_override: notifyMsg || undefined,
      });
      setNotifyResult('ok');
    } catch (e) {
      setNotifyResult('err:' + (e.response?.data?.error || 'Failed to send message.'));
    } finally { setNotifySending(false); }
  }

  async function handleStatusUpdate(orderIds, status) {
    const ids = Array.isArray(orderIds) ? orderIds : [orderIds];
    await Promise.all(ids.map(id => updateOrderStatus(id, status)));
    setOrders(prev => prev.map(o => ids.includes(o.id) ? { ...o, status } : o));
    setSelected(prev => prev ? { ...prev, status } : prev);
  }

  async function handleDelete(orderIds) {
    const ids = Array.isArray(orderIds) ? orderIds : [orderIds];
    if (!confirm(ids.length > 1 ? `Delete this booking (${ids.length} orders)?` : 'Delete this order?')) return;
    await Promise.all(ids.map(id => deleteOrder(id)));
    setOrders(prev => prev.filter(o => !ids.includes(o.id)));
    setSelected(null);
  }

  async function handleManualArchiveMonth(year, month) {
    if (!confirm(`Archive all COMPLETED orders from ${MONTH_NAMES[month-1]} ${year}? They will move to the Archives tab.`)) return;
    try {
      const { data } = await archiveOrderMonth(year, month);
      alert(`Archived ${data.archived} order(s).`);
      loadActive();
      setArchived([]); // force reload next time archives tab is opened
    } catch { alert('Failed to archive.'); }
  }

  // Active orders filter — group first so amount filter applies to booking total
  const filtered = orders.filter(o => {
    if (filterStatus !== 'ALL' && o.status !== filterStatus) return false;
    if (search && !o.customer_name?.toLowerCase().includes(search.toLowerCase()) &&
                  !o.id?.toLowerCase().includes(search.toLowerCase()) &&
                  !o.booking_ref?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  // Collect booking_refs that matched so the full group is always shown together
  const matchedRefs = new Set(filtered.filter(o => o.booking_ref).map(o => o.booking_ref));
  const filteredComplete = orders.filter(o =>
    filtered.includes(o) || (o.booking_ref && matchedRefs.has(o.booking_ref))
  );

  // Group, then apply amount filter on group total
  const groupedFiltered = groupByBookingRef(filteredComplete).filter(g => {
    const amt = Number(g.price);
    if (minAmt !== '' && amt < Number(minAmt)) return false;
    if (maxAmt !== '' && amt > Number(maxAmt)) return false;
    return true;
  });

  // Summarise available months from active COMPLETED orders (for manual archive button)
  const completedMonths = (() => {
    const seen = {};
    for (const o of orders.filter(o => o.status === 'COMPLETED')) {
      const d = new Date(o.created_at);
      const key = `${d.getFullYear()}-${d.getMonth()+1}`;
      if (!seen[key]) seen[key] = { year: d.getFullYear(), month: d.getMonth()+1, label: `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}` };
    }
    return Object.values(seen).sort((a,b) => a.year !== b.year ? b.year-a.year : b.month-a.month);
  })();

  const archivedGroups = groupByMonth(archived);

  const INPUT_S = { padding: '6px 12px', fontSize: 13, borderRadius: 6, border: '0.5px solid #ccc', background: '#fff', fontFamily: 'inherit', outline: 'none' };

  return (
    <div>
      <div className="page-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <h2 style={{ fontSize: 18, fontWeight: 500, margin: 0 }}>Orders</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setShowCreateModal(true)}
            className="btn-primary" style={{ gap: 6 }}>
            ➕ New Order
          </button>
          <button onClick={() => { setView('active'); setSelected(null); }}
            style={{ padding: '6px 14px', fontSize: 13, borderRadius: 6, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              background: view === 'active' ? '#38a9c2' : '#F0F0EC', color: view === 'active' ? '#fff' : '#374151', fontWeight: 600 }}>
            Active
          </button>
          <button onClick={switchToArchives}
            style={{ padding: '6px 14px', fontSize: 13, borderRadius: 6, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              background: view === 'archives' ? '#374151' : '#F0F0EC', color: view === 'archives' ? '#fff' : '#374151', fontWeight: 600 }}>
            📦 Archives
          </button>
        </div>
      </div>

      {/* ── ACTIVE VIEW ── */}
      {view === 'active' && (
        <>
          <div className="filter-row" style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search name, order ID, booking ref…"
              style={{ ...INPUT_S, width: 230 }} />
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={INPUT_S}>
              <option value="ALL">All statuses</option>
              {STATUSES.map(s => <option key={s}>{s}</option>)}
            </select>

            {/* Amount range filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 12, color: '#374151', fontWeight: 500 }}>₱</span>
              <input value={minAmt} onChange={e => setMinAmt(e.target.value)} type="number" min="0"
                placeholder="Min" style={{ ...INPUT_S, width: 80 }} />
              <span style={{ fontSize: 12, color: '#374151' }}>—</span>
              <input value={maxAmt} onChange={e => setMaxAmt(e.target.value)} type="number" min="0"
                placeholder="Max" style={{ ...INPUT_S, width: 80 }} />
              {(minAmt || maxAmt) && (
                <button onClick={() => { setMinAmt(''); setMaxAmt(''); }}
                  style={{ fontSize: 11, padding: '4px 8px', borderRadius: 5, border: '0.5px solid #ccc', background: '#fff', cursor: 'pointer', color: '#374151' }}>✕</button>
              )}
            </div>

            {/* Manual archive button — shown when completed orders exist */}
            {completedMonths.length > 0 && (
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 12, color: '#374151' }}>Archive:</span>
                {completedMonths.map(m => (
                  <button key={`${m.year}-${m.month}`}
                    onClick={() => handleManualArchiveMonth(m.year, m.month)}
                    style={{ fontSize: 11, padding: '4px 10px', borderRadius: 5, border: '0.5px solid #E2E8F0', background: '#F7F7F5', color: '#374151', cursor: 'pointer', fontFamily: 'inherit' }}>
                    📦 {m.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="orders-grid" style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 380px' : '1fr', gap: 16 }}>
            {/* Table */}
            <div style={{ background: '#fff', border: '0.5px solid #e8e8e0', borderRadius: 12, overflow: 'hidden' }}>
              {loading ? (
                <div style={{ padding: '2rem', color: '#374151', fontSize: 14 }}>Loading...</div>
              ) : (
                <div className="table-scroll">
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#f5f5f3' }}>
                      {['Order','Customer','Service','Amount','Pickup','Status','Paid'].map(h => (
                        <th key={h} style={{ padding: '9px 12px', textAlign: 'left', fontWeight: 500, fontSize: 12, color: '#374151' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {groupedFiltered.map(g => {
                      const gKey = g.booking_ref || g.id;
                      const isSelected = (selected?.booking_ref || selected?.id) === gKey;
                      return (
                      <tr key={gKey}
                        onClick={() => { const next = isSelected ? null : g; setSelected(next); setEditMode(false); setSavedDiff(null); setNotifyResult(''); setPayLinkUrl(next?.xendit_invoice_url || ''); setPayLinkErr(''); setPayLinkCopied(false); }}
                        style={{ cursor: 'pointer', background: isSelected ? '#f0f6ff' : 'transparent', borderTop: '0.5px solid #f0f0ec' }}>
                        <td style={{ padding: '9px 12px', fontWeight: 500, color: '#1a7d94' }}>
                          <div>{g.booking_ref || g.id}</div>
                          {g.services.length > 1 && <div style={{ fontSize: 10, color: '#7C3AED', fontWeight: 600 }}>{g.services.length} services</div>}
                        </td>
                        <td style={{ padding: '9px 12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                            <Avatar name={g.customer_name || '?'} size={26} />
                            {g.customer_name}
                          </div>
                        </td>
                        <td style={{ padding: '9px 12px', color: '#374151' }}>
                          {g.services.length > 1
                            ? g.services.map(s => s.service_name).join(', ')
                            : g.services[0]?.service_name}
                        </td>
                        <td style={{ padding: '9px 12px', fontWeight: 600, color: '#111827' }}>₱{Number(g.price).toLocaleString()}</td>
                        <td style={{ padding: '9px 12px', color: '#374151', fontSize: 11 }}>
                          {g.pickup_date ? new Date(g.pickup_date).toLocaleString() : '—'}
                        </td>
                        <td style={{ padding: '9px 12px' }}><StatusBadge status={g.status} /></td>
                        <td style={{ padding: '9px 12px' }}>
                          <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 4,
                            background: g.paid ? '#EAF3DE' : '#FCEBEB', color: g.paid ? '#3B6D11' : '#A32D2D' }}>
                            {g.paid ? 'Paid' : 'Unpaid'}
                          </span>
                        </td>
                      </tr>
                      );
                    })}
                    {groupedFiltered.length === 0 && (
                      <tr><td colSpan={7} style={{ padding: '2rem', textAlign: 'center', color: '#374151', fontSize: 13 }}>No orders found</td></tr>
                    )}
                  </tbody>
                </table>
                </div>
              )}
            </div>

            {/* Detail panel */}
            {selected && (
              <div style={{ background: '#fff', border: '0.5px solid #e8e8e0', borderRadius: 12, padding: '1.25rem', overflowY: 'auto', maxHeight: '85vh' }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 12 }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 15 }}>{selected.booking_ref || selected.id}</div>
                    <div style={{ fontSize: 12, color: '#374151' }}>
                      {selected.created_at ? new Date(selected.created_at).toLocaleString() : ''}
                    </div>
                  </div>
                  <button onClick={() => { setSelected(null); setEditMode(false); setSavedDiff(null); }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#374151' }}>×</button>
                </div>

                {/* Customer */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <Avatar name={selected.customer_name || '?'} size={38} />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{selected.customer_name}</div>
                    <div style={{ fontSize: 12, color: '#374151' }}>{selected.customer_phone || 'No phone'}</div>
                  </div>
                </div>

                {/* Order details — read mode */}
                {!editMode && (
                  <>
                    {[
                      ['Address', selected.address || selected.customer_address || '—'],
                      ['Pickup', selected.pickup_date ? new Date(selected.pickup_date).toLocaleString() : '—'],
                      ['Notes', selected.notes || '—'],
                      ['Via Messenger', selected.fb_id ? '✓ Yes' : '✗ Web booking'],
                    ].map(([k, v]) => (
                      <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderTop: '0.5px solid #f0f0ec', fontSize: 13 }}>
                        <span style={{ color: '#374151', flexShrink: 0, marginRight: 8 }}>{k}</span>
                        <span style={{ fontWeight: 500, textAlign: 'right' }}>{v}</span>
                      </div>
                    ))}

                    {/* Services breakdown */}
                    {selected.services?.length > 1 ? (
                      <div style={{ borderTop: '0.5px solid #f0f0ec', paddingTop: 8, marginTop: 2 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: '#374151', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Services</div>
                        {selected.services.map((s, i) => (
                          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 12 }}>
                            <span>{s.service_name}</span>
                            <span style={{ fontWeight: 600 }}>₱{Number(s.price).toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderTop: '0.5px solid #f0f0ec', fontSize: 13 }}>
                        <span style={{ color: '#374151', flexShrink: 0, marginRight: 8 }}>Service</span>
                        <span style={{ fontWeight: 500, textAlign: 'right' }}>{selected.services?.[0]?.service_name || selected.service_name || '—'}</span>
                      </div>
                    )}

                    {/* Customer selections breakdown */}
                    {selected.custom_selections?.length > 0 && (
                      <div style={{ borderTop: '0.5px solid #f0f0ec', paddingTop: 8, marginTop: 2 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: '#374151', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Order Details</div>
                        {selected.custom_selections.map((sel, i) => {
                          if (!sel.value && sel.value !== 0) return null;
                          const displayVal = typeof sel.value === 'number' || !isNaN(Number(sel.value))
                            ? sel.value
                            : sel.value;
                          return (
                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 12 }}>
                              <span style={{ color: '#6B7280' }}>{sel.label}</span>
                              <span style={{ fontWeight: 500, color: '#111827' }}>{displayVal}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Amount — shown after breakdown */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: '0.5px solid #f0f0ec', fontSize: 13 }}>
                      <span style={{ color: '#374151', flexShrink: 0 }}>Amount</span>
                      <span style={{ fontWeight: 700, color: '#111827', fontSize: 14 }}>₱{Number(selected.price).toLocaleString()}</span>
                    </div>

                    {selected.xendit_invoice_url && (
                      <a href={selected.xendit_invoice_url} target="_blank" rel="noreferrer"
                        style={{ display: 'block', marginTop: 10, padding: '7px', fontSize: 13, borderRadius: 6, background: '#EAF3DE', color: '#3B6D11', textAlign: 'center', textDecoration: 'none' }}>
                        View payment link
                      </a>
                    )}

                    {/* Saved diff / booking summary — shown after edit */}
                    {savedDiff && (
                      savedDiff.isBooking ? (
                        /* Booking summary with copyable text */
                        <div style={{ marginTop: 12, padding: '12px 14px', borderRadius: 8,
                          background: savedDiff.diff > 0 ? '#FEF3C7' : savedDiff.diff < 0 ? '#EAF3DE' : '#F7F7F5',
                          border: `1px solid ${savedDiff.diff > 0 ? '#FCD34D' : savedDiff.diff < 0 ? '#86EFAC' : '#E2E8F0'}` }}>
                          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>
                            {savedDiff.diff > 0 ? '⚠️ Additional payment needed' : savedDiff.diff < 0 ? '✅ Price reduced' : '✓ Booking updated'}
                          </div>
                          <div style={{ fontSize: 12, color: '#374151', marginBottom: 10 }}>
                            ₱{Number(savedDiff.old_total).toLocaleString()} → ₱{Number(savedDiff.new_total).toLocaleString()}
                            {savedDiff.diff !== 0 && (
                              <strong style={{ marginLeft: 6, color: savedDiff.diff > 0 ? '#92400E' : '#166534' }}>
                                ({savedDiff.diff > 0 ? '+' : ''}₱{Number(savedDiff.diff).toLocaleString()})
                              </strong>
                            )}
                          </div>
                          <textarea readOnly value={savedDiff.summary_text}
                            style={{ width: '100%', boxSizing: 'border-box', fontSize: 12, borderRadius: 6, border: '1px solid #E2E8F0', padding: '8px', fontFamily: 'inherit', resize: 'vertical', minHeight: 130, outline: 'none', background: '#fff', color: '#111827' }} />
                          <button onClick={() => { navigator.clipboard.writeText(savedDiff.summary_text); setCopySuccess(true); setTimeout(() => setCopySuccess(false), 2500); }}
                            style={{ marginTop: 6, width: '100%', padding: '8px', fontSize: 13, borderRadius: 6, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600,
                              background: copySuccess ? '#166534' : '#374151', color: '#fff', transition: 'background .2s' }}>
                            {copySuccess ? '✓ Copied!' : '📋 Copy Message'}
                          </button>
                          {savedDiff.payment_url && (
                            <a href={savedDiff.payment_url} target="_blank" rel="noreferrer"
                              style={{ display: 'block', marginTop: 6, padding: '8px', fontSize: 13, borderRadius: 6, background: '#EAF3DE', color: '#3B6D11', textAlign: 'center', textDecoration: 'none', fontWeight: 600 }}>
                              💳 Open New Payment Link
                            </a>
                          )}
                          <div style={{ marginTop: 8, fontSize: 11, color: '#374151' }}>
                            Copy the message above and send it to the customer via Messenger or SMS.
                          </div>
                        </div>
                      ) : (
                        /* Legacy single-order diff panel */
                        <div style={{ marginTop: 12, padding: '12px 14px', borderRadius: 8, background: savedDiff.diff > 0 ? '#FEF3C7' : savedDiff.diff < 0 ? '#EAF3DE' : '#F7F7F5', border: `1px solid ${savedDiff.diff > 0 ? '#FCD34D' : savedDiff.diff < 0 ? '#86EFAC' : '#E2E8F0'}` }}>
                          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>
                            {savedDiff.diff > 0 ? '⚠️ Price increased' : savedDiff.diff < 0 ? '✅ Price decreased' : '✓ Price unchanged'}
                          </div>
                          <div style={{ fontSize: 12, color: '#374151' }}>
                            ₱{savedDiff.old_price.toLocaleString()} → ₱{savedDiff.new_price.toLocaleString()}
                            {savedDiff.diff !== 0 && (
                              <strong style={{ marginLeft: 6, color: savedDiff.diff > 0 ? '#92400E' : '#166534' }}>
                                ({savedDiff.diff > 0 ? '+' : ''}₱{savedDiff.diff.toLocaleString()} difference)
                              </strong>
                            )}
                          </div>
                          {selected.fb_id ? (
                            notifyResult === 'ok' ? (
                              <div style={{ marginTop: 10, fontSize: 12, color: '#166534', fontWeight: 600 }}>✓ Message sent to customer via Messenger</div>
                            ) : (
                              <div style={{ marginTop: 10 }}>
                                <textarea value={notifyMsg} onChange={e => setNotifyMsg(e.target.value)}
                                  placeholder="Optional: customize the message (leave blank for default)"
                                  style={{ width: '100%', boxSizing: 'border-box', fontSize: 12, borderRadius: 6, border: '1px solid #E2E8F0', padding: '8px', fontFamily: 'inherit', resize: 'vertical', minHeight: 70, outline: 'none' }} />
                                {notifyResult.startsWith('err:') && (
                                  <div style={{ fontSize: 11, color: '#A32D2D', marginTop: 4 }}>{notifyResult.slice(4)}</div>
                                )}
                                <button onClick={handleNotify} disabled={notifySending}
                                  style={{ marginTop: 6, width: '100%', padding: '8px', fontSize: 13, borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, background: notifySending ? '#9CA3AF' : '#1877F2', color: '#fff', border: 'none' }}>
                                  {notifySending ? 'Sending…' : '💬 Send Update via Messenger'}
                                </button>
                              </div>
                            )
                          ) : (
                            <div style={{ marginTop: 8, fontSize: 11, color: '#374151' }}>
                              ℹ️ Web booking — contact the customer directly via phone.
                            </div>
                          )}
                        </div>
                      )
                    )}
                  </>
                )}

                {/* ── Payment Link ── */}
                {!editMode && (
                  <div style={{ marginTop: 14, paddingTop: 14, borderTop: '0.5px solid #E8E8E0' }}>
                    <div style={{ fontWeight: 600, fontSize: 12, color: '#374151', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.05em' }}>
                      💳 Payment Link
                    </div>

                    {payLinkUrl ? (
                      /* Show existing / generated link */
                      <div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', background: '#F0FDF4', border: '1px solid #34D399', borderRadius: 8, padding: '9px 12px', marginBottom: 8 }}>
                          <span style={{ flex: 1, fontSize: 11, color: '#065F46', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {payLinkUrl}
                          </span>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(payLinkUrl).then(() => {
                                setPayLinkCopied(true);
                                setTimeout(() => setPayLinkCopied(false), 2000);
                              });
                            }}
                            style={{ flexShrink: 0, padding: '5px 12px', borderRadius: 6, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 600,
                              background: payLinkCopied ? '#1D9E75' : '#38a9c2', color: '#fff', transition: 'background .2s' }}>
                            {payLinkCopied ? '✓ Copied!' : '📋 Copy'}
                          </button>
                        </div>
                        <button
                          onClick={async () => {
                            setPayLinkLoading(true); setPayLinkErr('');
                            try {
                              const { data } = await generatePaymentLink(selected.orderIds[0]);
                              setPayLinkUrl(data.payment_url);
                            } catch (e) { setPayLinkErr(e.response?.data?.error || 'Failed to regenerate link'); }
                            setPayLinkLoading(false);
                          }}
                          disabled={payLinkLoading}
                          style={{ fontSize: 11, color: '#374151', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit', textDecoration: 'underline' }}>
                          {payLinkLoading ? 'Generating…' : '↺ Regenerate link'}
                        </button>
                      </div>
                    ) : (
                      /* No link yet — show generate button */
                      <div>
                        <button
                          onClick={async () => {
                            setPayLinkLoading(true); setPayLinkErr('');
                            try {
                              const { data } = await generatePaymentLink(selected.orderIds[0]);
                              setPayLinkUrl(data.payment_url);
                            } catch (e) { setPayLinkErr(e.response?.data?.error || 'Failed to generate link'); }
                            setPayLinkLoading(false);
                          }}
                          disabled={payLinkLoading}
                          style={{ width: '100%', padding: '8px', fontSize: 12, fontWeight: 600, borderRadius: 7, border: '1px solid #9ED3DC', background: '#E6F5F8', color: '#1a7d94', cursor: payLinkLoading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                          {payLinkLoading
                            ? <><span style={{ width: 12, height: 12, borderRadius: '50%', border: '2px solid #9ED3DC', borderTopColor: '#38a9c2', animation: 'spin .7s linear infinite', display: 'inline-block' }} /> Generating…</>
                            : '💳 Generate Payment Link'}
                        </button>
                        {payLinkErr && <div style={{ fontSize: 11, color: '#A32D2D', marginTop: 6 }}>{payLinkErr}</div>}
                      </div>
                    )}
                  </div>
                )}

                {/* Edit form */}
                {editMode && (
                  <div style={{ marginTop: 4 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: '#1a7d94', marginBottom: 12 }}>
                      ✏️ Edit {bookingRef ? `Booking ${bookingRef}` : 'Order'}
                    </div>

                    {/* Booking items editor */}
                    {bookingRef ? (
                      <>
                        {editItems.map((item, idx) => (
                          <div key={idx} style={{ marginBottom: 10, padding: '10px 12px', background: '#F7F9FC', borderRadius: 8, border: '0.5px solid #E2E8F0' }}>
                            <div style={{ marginBottom: 7 }}>
                              <span style={{ fontSize: 11, fontWeight: 600, color: '#374151' }}>
                                Item {idx + 1} — {item.id}
                              </span>
                            </div>
                            <select value={item.service_id}
                              onChange={e => {
                                const svc = services.find(s => s.id === Number(e.target.value));
                                setEditItems(prev => prev.map((it, i) => i === idx
                                  ? { ...it, service_id: e.target.value, price: svc ? Number(svc.price) : it.price }
                                  : it));
                              }}
                              style={{ width: '100%', padding: '7px 10px', fontSize: 13, borderRadius: 6, border: '1px solid #E2E8F0', fontFamily: 'inherit', marginBottom: 6, outline: 'none' }}>
                              <option value="">— Select service —</option>
                              {services.filter(s => s.active !== false).map(s => (
                                <option key={s.id} value={s.id}>{s.name} — ₱{Number(s.price).toLocaleString()} / {s.unit || 'flat'}</option>
                              ))}
                            </select>
                            <input type="number" min="0" step="1" value={item.price}
                              onChange={e => setEditItems(prev => prev.map((it, i) => i === idx ? { ...it, price: e.target.value } : it))}
                              placeholder="Price (₱)"
                              style={{ width: '100%', boxSizing: 'border-box', padding: '7px 10px', fontSize: 13, borderRadius: 6, border: '1px solid #E2E8F0', fontFamily: 'inherit', marginBottom: 6, outline: 'none' }} />
                            <input type="text" value={item.notes}
                              onChange={e => setEditItems(prev => prev.map((it, i) => i === idx ? { ...it, notes: e.target.value } : it))}
                              placeholder="Notes (optional)"
                              style={{ width: '100%', boxSizing: 'border-box', padding: '7px 10px', fontSize: 13, borderRadius: 6, border: '1px solid #E2E8F0', fontFamily: 'inherit', outline: 'none' }} />
                          </div>
                        ))}

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: '#F0F6FF', borderRadius: 8, marginBottom: 8 }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>New Total</span>
                          <span style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>
                            ₱{editItems.reduce((s, i) => s + (Number(i.price) || 0), 0).toLocaleString('en-PH')}
                          </span>
                        </div>
                        <div style={{ fontSize: 11, color: '#374151', marginBottom: 12, padding: '6px 10px', background: '#FFF8E1', borderRadius: 6, border: '0.5px solid #FCD34D' }}>
                          ⚠️ Same order & booking numbers are kept. Each order will be stamped as edited.
                        </div>

                        {/* Custom note */}
                        <div style={{ marginBottom: 10 }}>
                          <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>
                            Custom Note <span style={{ fontWeight: 400, color: '#9CA3AF' }}>optional — included in summary</span>
                          </label>
                          <textarea value={editCustomNote} onChange={e => setEditCustomNote(e.target.value)}
                            placeholder="e.g. Free pick-up applied. Extra bag added. Special handling required."
                            rows={3}
                            style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', fontSize: 13, borderRadius: 6, border: '1px solid #E2E8F0', fontFamily: 'inherit', resize: 'vertical', outline: 'none' }} />
                        </div>

                        {/* Additional price */}
                        <div style={{ marginBottom: 12 }}>
                          <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>
                            Additional Amount (₱) <span style={{ fontWeight: 400, color: '#9CA3AF' }}>optional — added to total</span>
                          </label>
                          <input type="number" min="0" step="1" value={editCustomPrice}
                            onChange={e => setEditCustomPrice(e.target.value)}
                            placeholder="e.g. 50"
                            style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', fontSize: 13, borderRadius: 6, border: '1px solid #E2E8F0', fontFamily: 'inherit', outline: 'none' }} />
                          {Number(editCustomPrice) > 0 && (
                            <div style={{ fontSize: 11, marginTop: 4, color: '#1a7d94', fontWeight: 600 }}>
                              Grand total: ₱{(editItems.reduce((s, i) => s + (Number(i.price) || 0), 0) + Number(editCustomPrice)).toLocaleString('en-PH')}
                            </div>
                          )}
                        </div>
                      </>
                    ) : (
                      /* Legacy single-order simple editor */
                      <>
                        <div style={{ marginBottom: 10 }}>
                          <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Service</label>
                          <select value={editForm.service_id}
                            onChange={e => {
                              const svc = services.find(s => s.id === Number(e.target.value));
                              setEditForm(p => ({ ...p, service_id: e.target.value, price: svc ? Number(svc.price) : p.price }));
                            }}
                            style={{ width: '100%', padding: '8px 10px', fontSize: 13, borderRadius: 7, border: '1.5px solid #E2E8F0', fontFamily: 'inherit', outline: 'none' }}>
                            <option value="">— Keep current service —</option>
                            {services.map(s => (
                              <option key={s.id} value={s.id}>{s.name} — ₱{Number(s.price).toLocaleString()} / {s.unit || 'flat'}</option>
                            ))}
                          </select>
                        </div>
                        <div style={{ marginBottom: 10 }}>
                          <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Weight (kg) <span style={{ fontWeight: 400, color: '#9CA3AF' }}>optional</span></label>
                          <input type="number" min="0" step="0.1" value={editForm.weight}
                            onChange={e => {
                              const w = parseFloat(e.target.value) || 0;
                              const svc = services.find(s => s.id === Number(editForm.service_id));
                              const isPerKg = svc?.unit?.toLowerCase().includes('kg');
                              setEditForm(p => ({ ...p, weight: e.target.value, price: isPerKg && w > 0 ? Number(svc.price) * w : p.price }));
                            }}
                            placeholder="e.g. 5.5"
                            style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', fontSize: 13, borderRadius: 7, border: '1.5px solid #E2E8F0', fontFamily: 'inherit', outline: 'none' }} />
                        </div>
                        <div style={{ marginBottom: 10 }}>
                          <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Price (₱) <span style={{ fontWeight: 400, color: '#9CA3AF' }}>override</span></label>
                          <input type="number" min="0" step="1" value={editForm.price}
                            onChange={e => setEditForm(p => ({ ...p, price: e.target.value }))}
                            style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', fontSize: 13, borderRadius: 7, border: '1.5px solid #E2E8F0', fontFamily: 'inherit', outline: 'none' }} />
                        </div>
                        <div style={{ marginBottom: 12 }}>
                          <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Notes</label>
                          <textarea value={editForm.notes} onChange={e => setEditForm(p => ({ ...p, notes: e.target.value }))}
                            placeholder="Any notes about this order…"
                            style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', fontSize: 13, borderRadius: 7, border: '1.5px solid #E2E8F0', fontFamily: 'inherit', resize: 'vertical', minHeight: 60, outline: 'none' }} />
                        </div>
                      </>
                    )}

                    {editErr && <div style={{ fontSize: 12, color: '#A32D2D', marginBottom: 8 }}>{editErr}</div>}

                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={handleEditSave} disabled={editSaving}
                        style={{ flex: 2, padding: '9px', fontSize: 13, borderRadius: 7, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, background: editSaving ? '#7dd3e0' : '#38a9c2', color: '#fff' }}>
                        {editSaving ? 'Saving…' : '✓ Save Changes'}
                      </button>
                      <button onClick={() => { setEditMode(false); setEditErr(''); }}
                        style={{ flex: 1, padding: '9px', fontSize: 13, borderRadius: 7, border: '0.5px solid #E2E8F0', cursor: 'pointer', fontFamily: 'inherit', background: '#fff', color: '#374151' }}>
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Status + actions — shown in read mode */}
                {!editMode && (
                  <>
                    <div style={{ marginTop: 14 }}>
                      <div style={{ fontSize: 12, color: '#374151', marginBottom: 8 }}>Update status</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {STATUSES.map(s => (
                          <button key={s} onClick={() => handleStatusUpdate(selected.orderIds, s)} style={{
                            padding: '4px 9px', fontSize: 11, borderRadius: 4, cursor: 'pointer',
                            background: selected.status === s ? STATUS_COLORS[s] : STATUS_BG[s],
                            color: selected.status === s ? '#fff' : STATUS_COLORS[s],
                            border: '0.5px solid ' + STATUS_COLORS[s],
                            fontWeight: selected.status === s ? 500 : 400,
                          }}>{s}</button>
                        ))}
                      </div>
                    </div>

                    <button onClick={() => enterEditMode(selected)}
                      style={{ marginTop: 10, width: '100%', padding: '8px', fontSize: 13, borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, background: '#e6f5f8', border: '0.5px solid #9ed3dc', color: '#1a7d94' }}>
                      ✏️ Edit Order
                    </button>

                    {selected.status === 'COMPLETED' && (
                      <button onClick={() => {
                        const d = new Date(selected.created_at);
                        handleManualArchiveMonth(d.getFullYear(), d.getMonth()+1);
                      }}
                        style={{ marginTop: 8, width: '100%', padding: '8px', fontSize: 13, borderRadius: 6, cursor: 'pointer', background: '#F7F7F5', border: '0.5px solid #E2E8F0', color: '#374151' }}>
                        📦 Archive this month's completed orders
                      </button>
                    )}

                    <button onClick={() => handleDelete(selected.orderIds)}
                      style={{ marginTop: 8, width: '100%', padding: '8px', fontSize: 13, borderRadius: 6, cursor: 'pointer', background: '#FCEBEB', border: '0.5px solid #F09595', color: '#A32D2D' }}>
                      Delete order
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* ── ARCHIVES VIEW ── */}
      {view === 'archives' && (
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center' }}>
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search name or order ID…"
              style={{ ...INPUT_S, width: 230 }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 12, color: '#374151', fontWeight: 500 }}>₱</span>
              <input value={minAmt} onChange={e => setMinAmt(e.target.value)} type="number" min="0"
                placeholder="Min" style={{ ...INPUT_S, width: 80 }} />
              <span style={{ fontSize: 12, color: '#374151' }}>—</span>
              <input value={maxAmt} onChange={e => setMaxAmt(e.target.value)} type="number" min="0"
                placeholder="Max" style={{ ...INPUT_S, width: 80 }} />
              {(minAmt || maxAmt) && (
                <button onClick={() => { setMinAmt(''); setMaxAmt(''); }}
                  style={{ fontSize: 11, padding: '4px 8px', borderRadius: 5, border: '0.5px solid #ccc', background: '#fff', cursor: 'pointer', color: '#374151' }}>✕</button>
              )}
            </div>
            <button onClick={loadArchived} style={{ ...INPUT_S, cursor: 'pointer', color: '#374151' }}>↺ Refresh</button>
          </div>

          {archiveLoading ? (
            <div style={{ padding: '2rem', color: '#374151', fontSize: 14 }}>Loading archives…</div>
          ) : archived.length === 0 ? (
            <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #e8e8e0', padding: '3rem', textAlign: 'center', color: '#374151', fontSize: 14 }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📦</div>
              No archived orders yet. Completed orders are automatically archived monthly.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {archivedGroups.map(group => {
                const groupFiltered = group.orders.filter(o => {
                  if (search && !o.customer_name?.toLowerCase().includes(search.toLowerCase()) &&
                                !o.id?.toLowerCase().includes(search.toLowerCase())) return false;
                  const amt = Number(o.price);
                  if (minAmt !== '' && amt < Number(minAmt)) return false;
                  if (maxAmt !== '' && amt > Number(maxAmt)) return false;
                  return true;
                });
                if (!groupFiltered.length) return null;

                const isExpanded = expandedMonths[group.label] !== false; // default open
                const groupTotal = groupFiltered.reduce((s, o) => s + Number(o.price), 0);

                return (
                  <div key={group.label} style={{ background: '#fff', border: '0.5px solid #e8e8e0', borderRadius: 12, overflow: 'hidden' }}>
                    <div onClick={() => setExpandedMonths(p => ({ ...p, [group.label]: !isExpanded }))}
                      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: '#F7F7F5', cursor: 'pointer', borderBottom: isExpanded ? '0.5px solid #e8e8e0' : 'none' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 16 }}>📦</span>
                        <span style={{ fontWeight: 700, fontSize: 14, color: '#111827' }}>{group.label}</span>
                        <span style={{ fontSize: 12, color: '#374151' }}>{groupFiltered.length} orders</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span style={{ fontWeight: 700, fontSize: 14, color: '#38a9c2' }}>₱{groupTotal.toLocaleString()}</span>
                        <span style={{ color: '#374151', fontSize: 14 }}>{isExpanded ? '▲' : '▼'}</span>
                      </div>
                    </div>

                    {isExpanded && (
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                        <thead>
                          <tr style={{ background: '#fafafa' }}>
                            {['Order','Customer','Service','Amount','Pickup','Archived'].map(h => (
                              <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 500, fontSize: 12, color: '#374151' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {groupFiltered.map(o => (
                            <tr key={o.id} style={{ borderTop: '0.5px solid #f0f0ec' }}>
                              <td style={{ padding: '9px 12px', fontWeight: 500, color: '#1a7d94' }}>{o.id}</td>
                              <td style={{ padding: '9px 12px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                                  <Avatar name={o.customer_name || '?'} size={24} />
                                  {o.customer_name}
                                </div>
                              </td>
                              <td style={{ padding: '9px 12px', color: '#374151' }}>{o.service_name}</td>
                              <td style={{ padding: '9px 12px', fontWeight: 600 }}>₱{Number(o.price).toLocaleString()}</td>
                              <td style={{ padding: '9px 12px', color: '#374151', fontSize: 11 }}>
                                {o.pickup_date ? new Date(o.pickup_date).toLocaleDateString() : '—'}
                              </td>
                              <td style={{ padding: '9px 12px', color: '#374151', fontSize: 11 }}>
                                {o.archived_at ? new Date(o.archived_at).toLocaleDateString() : '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Create Order Modal ── */}
      {showCreateModal && (
        <CreateOrderModal
          onClose={() => setShowCreateModal(false)}
          onCreated={() => { loadActive(); }}
        />
      )}
    </div>
  );
}
