import { useEffect, useState, useCallback } from 'react';
import { getOrderHistory } from '../api.js';
import { manilaToday, orderManilaDate } from '../utils/revenue.js';
import { STATUS_COLORS } from './StatusBadge.jsx';

// Full order history for Finance and Reports: every order of a calendar month (Manila dates), archived or not,
// grouped by booking, with all details on expand. Backed by GET /finance/order-history (paginated by booking).
const PAGE = 50;
const PESO = n => '₱' + Math.round(Number(n) || 0).toLocaleString();
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function monthRange(ym) {
  const [y, m] = ym.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${ym}-01`, to: `${ym}-${String(last).padStart(2, '0')}` };
}
function monthOptions() {
  const t = manilaToday();
  let y = Number(t.slice(0, 4)), m = Number(t.slice(5, 7));
  const out = [];
  for (let i = 0; i < 24; i++) {
    out.push({ value: `${y}-${String(m).padStart(2, '0')}`, label: `${MONTHS[m - 1]} ${y}` });
    if (--m === 0) { m = 12; y--; }
  }
  return out;
}
const fmtDT = v => v ? new Date(v).toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Manila' }) : '—';

function Field({ label, children }) {
  if (children === null || children === undefined || children === '') return null;
  return (
    <div style={{ minWidth: 150 }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '.05em' }}>{label}</div>
      <div style={{ fontSize: 13, color: '#111827', wordBreak: 'break-word' }}>{children}</div>
    </div>
  );
}

function selectionsText(sel) {
  if (!Array.isArray(sel)) return '';
  return sel.filter(s => s && s.label).map(s => {
    const qty = Number(s.value);
    const price = Number(s.unit_price);
    const line = s.unit_price != null && Number.isFinite(qty) && Number.isFinite(price) && price > 0 ? ` (${PESO(price * qty)})` : '';
    return `${s.label}: ${s.value}${line}`;
  }).join(' · ');
}

function BookingRow({ b, open, onToggle }) {
  const items = b.items;
  const first = items[0];
  const live = items.filter(i => i.status !== 'CANCELLED');
  const cancelledAll = live.length === 0;
  const total = items.reduce((s, i) => s + Number(i.price || 0), 0)
    + Number(items.find(i => Number(i.delivery_fee) > 0)?.delivery_fee || 0)
    - Number(items.find(i => Number(i.promo_discount) > 0)?.promo_discount || 0);
  const allPaid = items.every(i => i.paid);
  const status = cancelledAll ? 'CANCELLED' : live[0].status;
  const color = STATUS_COLORS[status] || '#6B7280';
  return (
    <div style={{ borderTop: '0.5px solid #f0f0ec' }}>
      <div onClick={onToggle} role="button" tabIndex={0} aria-expanded={open}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(); } }}
        style={{ display: 'grid', gridTemplateColumns: '92px 110px minmax(120px,1.2fr) minmax(100px,1.5fr) 90px 70px 110px', gap: 8, alignItems: 'center', padding: '9px 12px', cursor: 'pointer', fontSize: 13, background: open ? '#F7F7F5' : 'transparent' }}>
        <span style={{ color: '#374151' }}>{orderManilaDate(first)}</span>
        <span style={{ fontWeight: 600 }}>{b.booking_ref || first.id.slice(0, 8)}</span>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{first.customer_name || 'Walk-in'}</span>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#374151' }}>
          {items.map(i => i.service_name).filter(Boolean).join(', ') || '—'}
        </span>
        <span style={{ fontWeight: 600, textAlign: 'right', textDecoration: cancelledAll ? 'line-through' : 'none' }}>{PESO(total)}</span>
        <span style={{ fontSize: 11, fontWeight: 600, color: allPaid ? '#047857' : '#B45309' }}>{allPaid ? 'Paid' : 'Unpaid'}</span>
        <span style={{ fontSize: 10, fontWeight: 700, color, border: `0.5px solid ${color}`, borderRadius: 10, padding: '2px 8px', textAlign: 'center', whiteSpace: 'nowrap' }}>{status}</span>
      </div>
      {open && (
        <div style={{ padding: '4px 16px 16px', background: '#F7F7F5' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px 24px', marginBottom: 12 }}>
            <Field label="Placed">{fmtDT(first.created_at)}</Field>
            <Field label="Customer">{first.customer_name}</Field>
            <Field label="Phone">{first.customer_phone}</Field>
            <Field label="Email">{first.customer_email}</Field>
            <Field label="Address">{first.address || first.customer_address}</Field>
            <Field label="Channel">{(first.source || 'web').replace('_', '-')}{first.is_dropoff ? ' · drop-off' : ''}</Field>
            <Field label="Payment method">{first.payment_method}</Field>
            <Field label="Pickup">{first.pickup_date ? fmtDT(first.pickup_date) : ''}</Field>
            <Field label="Delivery">{first.delivery_date ? fmtDT(first.delivery_date) : ''}</Field>
            <Field label="Delivery zone">{first.delivery_zone}</Field>
            <Field label="Promo">{first.promo_code}</Field>
            <Field label="Referral">{first.referral_ref}</Field>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, background: '#fff', border: '0.5px solid #e8e8e0', borderRadius: 8 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: '#6B7280' }}>
                {['Order', 'Service', 'Details', 'Notes', 'Status', 'Price'].map(h => <th key={h} style={{ padding: '6px 8px', fontWeight: 600 }}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {items.map(i => (
                <tr key={i.id} style={{ borderTop: '0.5px solid #f0f0ec', verticalAlign: 'top', opacity: i.status === 'CANCELLED' ? 0.55 : 1 }}>
                  <td style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>{i.id.length > 12 ? i.id.slice(0, 8) : i.id}</td>
                  <td style={{ padding: '6px 8px' }}>{i.service_name || '—'}{Number(i.weight) > 0 ? ` · ${Number(i.weight)}${i.service_unit ? ' ' + i.service_unit : ''}` : ''}</td>
                  <td style={{ padding: '6px 8px', color: '#374151' }}>{selectionsText(i.custom_selections) || '—'}</td>
                  <td style={{ padding: '6px 8px', color: '#374151' }}>{i.notes || '—'}</td>
                  <td style={{ padding: '6px 8px' }}>{i.status}{i.paid ? '' : ' · unpaid'}</td>
                  <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600 }}>{PESO(i.price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 24px', justifyContent: 'flex-end', marginTop: 10, fontSize: 13 }}>
            <span>Services {PESO(items.reduce((s, i) => s + Number(i.price || 0), 0))}</span>
            {Number(items.find(i => Number(i.delivery_fee) > 0)?.delivery_fee) > 0 && <span>Delivery {PESO(items.find(i => Number(i.delivery_fee) > 0).delivery_fee)}</span>}
            {Number(items.find(i => Number(i.promo_discount) > 0)?.promo_discount) > 0 && <span>Discount −{PESO(items.find(i => Number(i.promo_discount) > 0).promo_discount)}</span>}
            <strong>Total {PESO(total)}</strong>
          </div>
          {items.some(i => i.refund_status && i.refund_status !== 'none') && (
            <div style={{ marginTop: 8, fontSize: 12, color: '#B91C1C' }}>
              Refund: {items.find(i => i.refund_status && i.refund_status !== 'none').refund_status}
              {items.find(i => i.refund_note)?.refund_note ? ` — ${items.find(i => i.refund_note).refund_note}` : ''}
              {items.find(i => i.refunded_by) ? ` (by ${items.find(i => i.refunded_by).refunded_by})` : ''}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function OrderHistory() {
  const months = monthOptions();
  const [month, setMonth] = useState(months[0].value);
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [bookings, setBookings] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [openKey, setOpenKey] = useState(null);

  useEffect(() => { const t = setTimeout(() => setDebouncedQ(q), 300); return () => clearTimeout(t); }, [q]);

  const load = useCallback((offset) => {
    const { from, to } = monthRange(month);
    setLoading(true); setError(false);
    return getOrderHistory({ from, to, q: debouncedQ || undefined, limit: PAGE, offset })
      .then(r => {
        setBookings(prev => offset === 0 ? r.data.bookings : [...prev, ...r.data.bookings]);
        setTotal(r.data.total || 0);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [month, debouncedQ]);

  useEffect(() => { setOpenKey(null); load(0); }, [load]);

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 12 }}>
        <select value={month} onChange={e => setMonth(e.target.value)} aria-label="Month"
          style={{ padding: '7px 10px', borderRadius: 6, border: '0.5px solid #ccc', fontSize: 13, background: '#fff' }}>
          {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search booking ref, name or phone…"
          style={{ padding: '7px 10px', borderRadius: 6, border: '0.5px solid #ccc', fontSize: 13, width: 260, maxWidth: '100%' }} />
        <span style={{ fontSize: 12, color: '#6B7280' }}>{total} booking{total === 1 ? '' : 's'} · includes archived and cancelled orders</span>
      </div>
      <div className="stat-card" style={{ padding: 0, overflowX: 'auto' }}>
        <div style={{ minWidth: 760 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '92px 110px minmax(120px,1.2fr) minmax(100px,1.5fr) 90px 70px 110px', gap: 8, padding: '8px 12px', fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '.04em' }}>
            <span>Date</span><span>Booking</span><span>Customer</span><span>Services</span><span style={{ textAlign: 'right' }}>Total</span><span>Payment</span><span style={{ textAlign: 'center' }}>Status</span>
          </div>
          {bookings.map(b => (
            <BookingRow key={b.key} b={b} open={openKey === b.key} onToggle={() => setOpenKey(openKey === b.key ? null : b.key)} />
          ))}
          {!loading && !error && bookings.length === 0 && (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#6B7280', fontSize: 13 }}>No orders for this month{debouncedQ ? ' matching your search' : ''}.</div>
          )}
          {error && <div style={{ padding: '1.5rem', textAlign: 'center', color: '#B91C1C', fontSize: 13 }}>Could not load order history. <button onClick={() => load(0)} style={{ textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}>Retry</button></div>}
          {loading && <div style={{ padding: '1rem', textAlign: 'center', color: '#6B7280', fontSize: 13 }}>Loading…</div>}
        </div>
      </div>
      {!loading && bookings.length < total && (
        <button onClick={() => load(bookings.length)} style={{ marginTop: 12, padding: '8px 16px', borderRadius: 6, border: '0.5px solid #ccc', background: '#fff', cursor: 'pointer', fontSize: 13 }}>
          Load more ({total - bookings.length} left)
        </button>
      )}
    </div>
  );
}
