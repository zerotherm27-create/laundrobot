import { useEffect, useState, useRef } from 'react';
import { getServices, getCategories, getMyTenantSettings, createWalkInOrder } from '../api.js';

// ── helpers (mirrored from BookingForm) ──────────────────────────────────────

function normalizeOpts(options) {
  if (!Array.isArray(options)) return [];
  return options.map(o => typeof o === 'object' && o !== null
    ? { price_type: 'fixed', ...o }
    : { label: String(o), price: 0, price_type: 'fixed' });
}

function toLocalDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function makeTimeSlots(open, close) {
  if (!open || !close) return [];
  const [oh, om] = open.split(':').map(Number);
  const [ch, cm] = close.split(':').map(Number);
  const slots = [];
  let cur = oh * 60 + om;
  const end = ch * 60 + cm;
  while (cur < end) {
    const h = Math.floor(cur / 60), m = cur % 60;
    const hd = h > 12 ? h - 12 : h === 0 ? 12 : h;
    const ampm = h >= 12 ? 'PM' : 'AM';
    slots.push({ value: `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`, label: `${hd}:${String(m).padStart(2,'0')} ${ampm}` });
    cur += 30;
  }
  return slots;
}

const INPUT = {
  width: '100%', boxSizing: 'border-box', padding: '10px 12px', fontSize: 14,
  borderRadius: 8, border: '1.5px solid #D1D5DB', background: '#fff',
  fontFamily: 'inherit', color: '#0D1117', outline: 'none',
};
const LABEL = { fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 };

function Field({ label, required, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={LABEL}>{label}{required && <span style={{ color: '#E53E3E', marginLeft: 2 }}>*</span>}</label>
      {children}
    </div>
  );
}

// ── QR Payment modal ─────────────────────────────────────────────────────────

function QRModal({ total, qrUrl, shopName, submitting, error, onConfirm, onCancel }) {
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onCancel()}>
      <div className="modal-card modal-close-mobile" onClick={e => e.stopPropagation()}
        style={{ width: 360, padding: '1.75rem', maxHeight: '90vh', overflowY: 'auto' }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: '#111827' }}>QR Payment</div>
          <button onClick={onCancel} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: '#374151', padding: '8px', margin: '-8px' }}>×</button>
        </div>

        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 12, color: '#374151', marginBottom: 4 }}>Amount to collect</div>
          <div style={{ fontSize: 36, fontWeight: 800, color: '#38a9c2', letterSpacing: '-.5px' }}>
            ₱{Number(total).toLocaleString()}
          </div>
        </div>

        {qrUrl ? (
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <div style={{ fontSize: 12, color: '#374151', marginBottom: 10, fontWeight: 500 }}>
              Show this QR to the customer to scan
            </div>
            <img src={qrUrl} alt="Payment QR"
              style={{ maxWidth: 200, width: '100%', borderRadius: 12, border: '1px solid #E8E8E0', boxShadow: 'var(--shadow-sm)' }} />
          </div>
        ) : (
          <div style={{ textAlign: 'center', marginBottom: 20, padding: '24px', background: '#F7F7F5', borderRadius: 12, border: '1px dashed #D1D5DB' }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>📱</div>
            <div style={{ fontSize: 13, color: '#374151', fontWeight: 500 }}>No QR image set</div>
            <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 4 }}>Add your GCash/Maya QR in Settings → Walk-in QR</div>
          </div>
        )}

        {error && (
          <div style={{ marginBottom: 14, padding: '10px 12px', borderRadius: 8, background: '#FCEBEB', color: '#A32D2D', fontSize: 13 }}>
            ⚠️ {error}
          </div>
        )}

        <button onClick={onConfirm} disabled={submitting}
          style={{
            width: '100%', padding: '13px', fontSize: 14, fontWeight: 700, borderRadius: 10,
            border: 'none', cursor: submitting ? 'not-allowed' : 'pointer',
            background: submitting ? '#E2E8F0' : '#fdca00', color: submitting ? '#9CA3AF' : '#1F2937',
            fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>
          {submitting
            ? <><span className="spinner" style={{ borderTopColor: '#374151', borderColor: 'rgba(0,0,0,.15)', width: 16, height: 16 }} /> Processing…</>
            : '✓ I Received Payment'}
        </button>

        <button onClick={onCancel} disabled={submitting}
          className="btn-ghost" style={{ width: '100%', justifyContent: 'center', padding: '10px', borderRadius: 10, marginTop: 8 }}>
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function WalkIn() {
  const [step, setStep] = useState(1); // 1 = services, 2 = details, 3 = confirm, 'success'

  const [categories, setCategories] = useState([]);
  const [services, setServices]     = useState([]);
  const [shopInfo, setShopInfo]     = useState(null);
  const [loading, setLoading]       = useState(true);

  // Step 1
  const [activeCat, setActiveCat]     = useState(null);
  const [selectedSvc, setSelectedSvc] = useState(null);
  const [fieldValues, setFieldValues] = useState({});
  const [addonQty, setAddonQty]       = useState({});
  const [addonOwn, setAddonOwn]       = useState({});
  const [cart, setCart]               = useState([]);

  // Step 2
  const [form, setForm] = useState({ name: '', phone: '', email: '', address: '', pickup_date: '', pickup_time: '', notes: '' });

  // Step 3
  const [privacyConsent, setPrivacyConsent] = useState(false);
  const [promoInput, setPromoInput]     = useState('');
  const [appliedPromo, setAppliedPromo] = useState(null);
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoError, setPromoError]     = useState('');

  // QR modal + submission
  const [showQR, setShowQR]         = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitErr, setSubmitErr]   = useState('');
  const [bookingRef, setBookingRef] = useState('');

  useEffect(() => {
    Promise.all([getCategories(), getServices(), getMyTenantSettings()])
      .then(([catRes, svcRes, shopRes]) => {
        setCategories(catRes.data);
        setServices(svcRes.data.filter(s => s.active !== false));
        setShopInfo(shopRes.data);
        if (catRes.data.length > 0) setActiveCat(catRes.data[0].id);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // ── Price calculation (same logic as BookingForm) ─────────────────────────

  const selectFields = (selectedSvc?.custom_fields || []).filter(f => f.field_type === 'select');
  const firstNumField = (selectedSvc?.custom_fields || []).find(f => f.field_type === 'number');
  const qty = firstNumField ? parseFloat(fieldValues[firstNumField.id] || 0) : 0;

  useEffect(() => {
    if (!selectedSvc || qty <= 0) return;
    const syncFields = (selectedSvc.custom_fields || []).filter(f => f.field_type === 'addon' && f.sync_qty);
    if (!syncFields.length) return;
    setAddonQty(prev => {
      const next = { ...prev };
      syncFields.forEach(f => { next[f.id] = qty; });
      return next;
    });
  }, [qty, selectedSvc]);

  const baseVariationPrice = (() => {
    for (const f of selectFields) {
      const opts = normalizeOpts(f.options);
      const sel = opts.find(o => o.label === fieldValues[f.id]);
      if (sel && (sel.price_type || 'fixed') !== 'copy_base' && Number(sel.price || 0) > 0) return Number(sel.price);
    }
    return 0;
  })();

  const hasVariationPricing = selectFields.some(f => normalizeOpts(f.options).some(o => Number(o.price || 0) > 0));

  const primarySelectFieldId = (() => {
    for (const f of selectFields) {
      const sel = normalizeOpts(f.options).find(o => o.label === fieldValues[f.id]);
      if (sel && (sel.price_type || 'fixed') !== 'copy_base' && Number(sel.price || 0) > 0) return f.id;
    }
    return null;
  })();

  const qtyScaledIds = hasVariationPricing && qty > 0
    ? new Set(selectFields.filter(f => {
        const sel = normalizeOpts(f.options).find(o => o.label === fieldValues[f.id]);
        if (!sel) return false;
        return f.id === primarySelectFieldId || (sel.price_type || 'fixed') === 'copy_base';
      }).map(f => f.id))
    : new Set();

  const baseSubtotal = selectedSvc
    ? (qty > 0 ? (hasVariationPricing ? 0 : Number(selectedSvc.price) * qty) : (hasVariationPricing ? 0 : Number(selectedSvc.price)))
    : 0;

  const subtotal = selectedSvc
    ? (hasVariationPricing
        ? selectFields.reduce((sum, f) => {
            const sel = normalizeOpts(f.options).find(o => o.label === fieldValues[f.id]);
            if (!sel) return sum;
            const p = (sel.price_type || 'fixed') === 'copy_base' ? baseVariationPrice : Number(sel.price || 0);
            return sum + p * (qtyScaledIds.has(f.id) ? qty : 1);
          }, 0)
        : baseSubtotal + selectFields.reduce((sum, f) => {
            const sel = normalizeOpts(f.options).find(o => o.label === fieldValues[f.id]);
            if (!sel) return sum;
            return sum + Number(sel.price || 0);
          }, 0))
    : 0;

  function isAddonVisible(f) {
    if (!f.linked_to_field_label) return true;
    const linked = (selectedSvc?.custom_fields || []).find(sf => sf.field_type === 'select' && sf.label === f.linked_to_field_label);
    if (!linked) return true;
    return fieldValues[linked.id] === f.linked_to_value;
  }

  const addonFields = (selectedSvc?.custom_fields || []).filter(f => f.field_type === 'addon' && isAddonVisible(f));
  const addonTotal = addonFields.reduce((s, f) => s + Number(f.unit_price || 0) * (addonQty[f.id] || 0), 0);

  const cartTotal = cart.reduce((s, i) => s + i.itemTotal, 0);
  const promoDiscount = appliedPromo?.discount || 0;
  const grandTotal = Math.max(0, cartTotal - promoDiscount);

  const timeSlots = makeTimeSlots(shopInfo?.store_open, shopInfo?.store_close);
  const minDate = toLocalDateStr(new Date());

  const visibleServices = activeCat ? services.filter(s => s.category_id === activeCat) : services;

  // ── Validation ────────────────────────────────────────────────────────────

  function step1Valid() {
    if (!selectedSvc) return false;
    for (const f of (selectedSvc.custom_fields || [])) {
      if (f.field_type === 'addon') {
        if (f.required && isAddonVisible(f)) {
          if (!(addonQty[f.id] > 0) && !(f.allow_own && addonOwn[f.id])) return false;
        }
        continue;
      }
      if (f.required && f.label?.toLowerCase().includes('weight')) {
        const w = fieldValues[f.id];
        if (!w || parseFloat(w) <= 0) return false;
      } else if (f.required && !fieldValues[f.id]) return false;
    }
    return subtotal + addonTotal > 0;
  }

  function step2Valid() {
    if (!cart.length) return false;
    if (!form.name.trim() || !form.phone.trim()) return false;
    if (!form.pickup_date) return false;
    if (shopInfo?.store_open && !form.pickup_time) return false;
    return true;
  }

  // ── Add to cart ───────────────────────────────────────────────────────────

  function addToCart() {
    const customFields = [];
    const displayLines = [];

    if (!hasVariationPricing && baseSubtotal > 0) {
      displayLines.push({ label: `${selectedSvc.name}${qty > 0 ? ` × ${qty}` : ''}`, price: baseSubtotal });
    }

    for (const f of (selectedSvc.custom_fields || [])) {
      if (f.field_type === 'addon') {
        if (!isAddonVisible(f)) continue;
        const aqty = addonQty[f.id] || 0;
        if (aqty > 0) {
          customFields.push({ label: f.label, value: String(aqty), unit_price: f.unit_price });
          displayLines.push({ label: `${f.label} × ${aqty}`, price: Number(f.unit_price || 0) * aqty });
        } else if (f.allow_own && addonOwn[f.id]) {
          customFields.push({ label: f.label, value: 'Customer provides own' });
          displayLines.push({ label: `${f.label}: Customer provides own`, price: 0 });
        }
      } else if (f.field_type === 'select') {
        if (fieldValues[f.id] !== undefined) {
          customFields.push({ label: f.label, value: fieldValues[f.id] });
          const sel = normalizeOpts(f.options).find(o => o.label === fieldValues[f.id]);
          if (sel) {
            const p = (sel.price_type || 'fixed') === 'copy_base' ? baseVariationPrice : Number(sel.price || 0);
            const scaled = qtyScaledIds.has(f.id);
            displayLines.push({ label: `${f.label}: ${sel.label}${scaled && qty > 1 ? ` × ${qty}` : ''}`, price: scaled ? p * qty : p });
          }
        }
      } else if (fieldValues[f.id] !== undefined) {
        customFields.push({ label: f.label, value: fieldValues[f.id] });
      }
    }

    const weightField = (selectedSvc.custom_fields || []).find(f => f.label?.toLowerCase().includes('weight'));
    const itemWeight = weightField ? parseFloat(fieldValues[weightField.id]) || null : null;

    setCart(prev => [...prev, {
      _id: Date.now(),
      service_id: selectedSvc.id,
      service_name: selectedSvc.name,
      custom_fields: customFields,
      displayLines,
      itemTotal: subtotal + addonTotal,
      weight: itemWeight,
    }]);

    setSelectedSvc(null);
    setFieldValues({});
    setAddonQty({});
    setAddonOwn({});
  }

  // ── Promo ─────────────────────────────────────────────────────────────────

  async function applyPromo() {
    if (!promoInput.trim()) return;
    setPromoLoading(true); setPromoError('');
    try {
      // Use public promo validation since we have the tenant_id in shopInfo
      const { data } = await import('../api.js').then(m => m.validatePublicPromo(shopInfo.id, promoInput.trim(), cartTotal));
      setAppliedPromo(data);
    } catch (e) {
      setPromoError(e.response?.data?.error || 'Invalid promo code');
      setAppliedPromo(null);
    } finally { setPromoLoading(false); }
  }

  // ── Submit ────────────────────────────────────────────────────────────────

  async function handleConfirmPayment() {
    setSubmitting(true); setSubmitErr('');
    try {
      const pickupDatetime = form.pickup_time
        ? `${form.pickup_date}T${form.pickup_time}:00`
        : form.pickup_date;

      const { data } = await createWalkInOrder({
        cart: cart.map(item => ({
          service_id: item.service_id,
          weight: item.weight,
          price: item.itemTotal,
          custom_fields: item.custom_fields,
        })),
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim() || null,
        address: form.address.trim() || null,
        notes: form.notes.trim() || null,
        pickup_date: pickupDatetime,
      });

      setBookingRef(data.booking_ref);
      setShowQR(false);
      setStep('success');
    } catch (err) {
      setSubmitErr(err.response?.data?.error || 'Something went wrong. Please try again.');
    } finally { setSubmitting(false); }
  }

  function reset() {
    setStep(1);
    setCart([]); setSelectedSvc(null); setFieldValues({}); setAddonQty({}); setAddonOwn({});
    setForm({ name: '', phone: '', email: '', address: '', pickup_date: '', pickup_time: '', notes: '' });
    setPrivacyConsent(false); setPromoInput(''); setAppliedPromo(null); setPromoError('');
    setShowQR(false); setSubmitErr(''); setBookingRef('');
  }

  // ── Loading ───────────────────────────────────────────────────────────────

  if (loading) return (
    <div style={{ maxWidth: 600, margin: '0 auto' }}>
      <div className="skeleton" style={{ height: 28, width: 180, marginBottom: 24 }} />
      <div className="skeleton" style={{ height: 400, borderRadius: 14 }} />
    </div>
  );

  // ── Success ───────────────────────────────────────────────────────────────

  if (step === 'success') return (
    <div style={{ maxWidth: 480, margin: '0 auto' }} className="animate-fade-up">
      <div style={{ background: '#fff', borderRadius: 16, border: '0.5px solid #E8E8E0', padding: '2.5rem', textAlign: 'center' }}>
        <div style={{ fontSize: 52, marginBottom: 12 }}>✅</div>
        <div style={{ fontSize: 22, fontWeight: 800, color: '#111827', marginBottom: 6 }}>Payment Received!</div>
        <div style={{ fontSize: 13, color: '#374151', marginBottom: 24 }}>Order created and marked as paid.</div>

        <div style={{ background: '#F7F9FC', borderRadius: 10, padding: '16px', marginBottom: 8, display: 'inline-block', minWidth: 220 }}>
          <div style={{ fontSize: 11, color: '#374151', marginBottom: 4 }}>Booking Reference</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#38a9c2', letterSpacing: '.5px', fontFamily: 'monospace' }}>{bookingRef}</div>
        </div>

        <div style={{ fontSize: 13, color: '#374151', marginBottom: 28, marginTop: 16 }}>
          Now visible in the Kanban board tagged as <strong>Walk-in</strong>.
        </div>

        <button onClick={reset} className="btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '13px', fontSize: 14, borderRadius: 10 }}>
          + New Walk-in Order
        </button>
      </div>
    </div>
  );

  // ── Main layout ───────────────────────────────────────────────────────────

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }} className="animate-fade-up">
      {/* Header */}
      <div style={{ marginBottom: '1.25rem' }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#111827', letterSpacing: '-.3px' }}>🛒 Walk-in POS</h1>
        <p style={{ fontSize: 13, color: '#374151', marginTop: 2 }}>In-store order — no delivery, payment via QR.</p>
      </div>

      {/* Step tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: '1.5rem', background: '#F7F7F5', borderRadius: 10, padding: 4 }}>
        {[
          { id: 1, label: '1. Services' },
          { id: 2, label: '2. Details' },
          { id: 3, label: '3. Confirm & Pay' },
        ].map(t => (
          <button key={t.id} onClick={() => { if (t.id < step || (t.id === 2 && cart.length)) setStep(t.id); }}
            style={{
              flex: 1, padding: '8px 4px', fontSize: 12, fontWeight: 600, borderRadius: 7,
              border: 'none', cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s',
              background: step === t.id ? '#fff' : 'transparent',
              color: step === t.id ? '#111827' : '#9CA3AF',
              boxShadow: step === t.id ? 'var(--shadow-xs)' : 'none',
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── STEP 1: Services ── */}
      {step === 1 && (
        <div>
          {/* Category tabs */}
          {categories.length > 1 && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
              {categories.map(cat => (
                <button key={cat.id} onClick={() => setActiveCat(cat.id)}
                  style={{
                    padding: '6px 14px', fontSize: 13, borderRadius: 20, cursor: 'pointer',
                    fontFamily: 'inherit', fontWeight: 500, border: 'none',
                    background: activeCat === cat.id ? '#38a9c2' : '#F0F0EC',
                    color: activeCat === cat.id ? '#fff' : '#374151',
                  }}>
                  {cat.name}
                </button>
              ))}
            </div>
          )}

          {/* Service list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
            {visibleServices.map(svc => (
              <div key={svc.id}
                onClick={() => { setSelectedSvc(svc); setFieldValues({}); setAddonQty({}); setAddonOwn({}); }}
                style={{
                  padding: '12px 14px', borderRadius: 10, cursor: 'pointer',
                  border: `1.5px solid ${selectedSvc?.id === svc.id ? '#38a9c2' : '#E8E8E0'}`,
                  background: selectedSvc?.id === svc.id ? '#EBF8FA' : '#fff',
                  transition: 'all .15s',
                }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>{svc.name}</div>
                    {svc.description && <div style={{ fontSize: 12, color: '#374151', marginTop: 2 }}>{svc.description}</div>}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#38a9c2', flexShrink: 0, marginLeft: 12 }}>
                    {Number(svc.price) > 0 ? `₱${Number(svc.price).toLocaleString()} ${svc.unit || ''}` : 'See options'}
                  </div>
                </div>
              </div>
            ))}
            {visibleServices.length === 0 && (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#9CA3AF', fontSize: 13 }}>
                No services in this category.
              </div>
            )}
          </div>

          {/* Custom fields for selected service */}
          {selectedSvc && (
            <div style={{ background: '#fff', borderRadius: 12, border: '1.5px solid #38a9c2', padding: '1.25rem', marginBottom: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#111827', marginBottom: 14 }}>
                {selectedSvc.name}
              </div>

              {(selectedSvc.custom_fields || []).map(f => {
                if (f.field_type === 'addon') {
                  if (!isAddonVisible(f)) return null;
                  return (
                    <div key={f.id} style={{ marginBottom: 14 }}>
                      <label style={LABEL}>{f.label}{f.required && <span style={{ color: '#E53E3E', marginLeft: 2 }}>*</span>}</label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <button onClick={() => setAddonQty(p => ({ ...p, [f.id]: Math.max(0, (p[f.id] || 0) - 1) }))}
                          style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid #D1D5DB', background: '#F7F7F5', cursor: 'pointer', fontSize: 18, fontWeight: 700, fontFamily: 'inherit' }}>−</button>
                        <span style={{ width: 32, textAlign: 'center', fontSize: 15, fontWeight: 600 }}>{addonQty[f.id] || 0}</span>
                        <button onClick={() => setAddonQty(p => ({ ...p, [f.id]: (p[f.id] || 0) + 1 }))}
                          style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid #D1D5DB', background: '#F7F7F5', cursor: 'pointer', fontSize: 18, fontWeight: 700, fontFamily: 'inherit' }}>+</button>
                        <span style={{ fontSize: 13, color: '#374151' }}>₱{Number(f.unit_price || 0)} each</span>
                        {f.allow_own && (
                          <label style={{ fontSize: 12, color: '#374151', display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', marginLeft: 8 }}>
                            <input type="checkbox" checked={!!addonOwn[f.id]} onChange={e => setAddonOwn(p => ({ ...p, [f.id]: e.target.checked }))} />
                            Provides own
                          </label>
                        )}
                      </div>
                    </div>
                  );
                }

                if (f.field_type === 'select') {
                  return (
                    <Field key={f.id} label={f.label} required={f.required}>
                      <select value={fieldValues[f.id] || ''} onChange={e => setFieldValues(p => ({ ...p, [f.id]: e.target.value }))}
                        style={INPUT}>
                        <option value="">Select…</option>
                        {normalizeOpts(f.options).map(o => (
                          <option key={o.label} value={o.label}>{o.label}{Number(o.price) > 0 ? ` (+₱${Number(o.price).toLocaleString()})` : ''}</option>
                        ))}
                      </select>
                    </Field>
                  );
                }

                if (f.field_type === 'number') {
                  return (
                    <Field key={f.id} label={f.label} required={f.required}>
                      <input type="number" min={f.min_value ?? 0} max={f.max_value ?? undefined}
                        value={fieldValues[f.id] || ''}
                        onChange={e => setFieldValues(p => ({ ...p, [f.id]: e.target.value }))}
                        placeholder={f.placeholder || ''} style={INPUT} />
                    </Field>
                  );
                }

                if (f.field_type === 'text' || f.field_type === 'textarea') {
                  return (
                    <Field key={f.id} label={f.label} required={f.required}>
                      <input type="text" value={fieldValues[f.id] || ''}
                        onChange={e => setFieldValues(p => ({ ...p, [f.id]: e.target.value }))}
                        placeholder={f.placeholder || ''} style={INPUT} />
                    </Field>
                  );
                }
                return null;
              })}

              {/* Live price preview */}
              {(subtotal + addonTotal) > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderTop: '0.5px solid #E8E8E0', marginTop: 8, fontSize: 14 }}>
                  <span style={{ color: '#374151' }}>Item total</span>
                  <span style={{ fontWeight: 800, color: '#38a9c2' }}>₱{(subtotal + addonTotal).toLocaleString()}</span>
                </div>
              )}

              <button onClick={addToCart} disabled={!step1Valid()}
                className="btn-primary"
                style={{ width: '100%', justifyContent: 'center', padding: '11px', borderRadius: 9, marginTop: 8, opacity: step1Valid() ? 1 : 0.5 }}>
                + Add to Order
              </button>
            </div>
          )}

          {/* Cart summary */}
          {cart.length > 0 && (
            <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #E8E8E0', padding: '1.25rem', marginBottom: 16 }}>
              <div style={{ fontWeight: 600, fontSize: 13, color: '#374151', marginBottom: 10 }}>Order so far</div>
              {cart.map((item, idx) => (
                <div key={item._id} style={{ marginBottom: 10, paddingBottom: 10, borderBottom: idx < cart.length - 1 ? '0.5px solid #F0F0EC' : 'none' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{item.service_name}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#38a9c2' }}>₱{item.itemTotal.toLocaleString()}</span>
                      <button onClick={() => setCart(p => p.filter(c => c._id !== item._id))}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', fontSize: 16, padding: 0, lineHeight: 1 }}>×</button>
                    </div>
                  </div>
                  {item.displayLines.filter(l => l.label !== item.service_name).map((l, i) => (
                    <div key={i} style={{ fontSize: 12, color: '#374151', marginTop: 2, paddingLeft: 8 }}>
                      {l.label}{l.price > 0 ? ` — ₱${l.price.toLocaleString()}` : ''}
                    </div>
                  ))}
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 8, fontSize: 15 }}>
                <span style={{ fontWeight: 700 }}>Total</span>
                <span style={{ fontWeight: 800, color: '#38a9c2' }}>₱{cartTotal.toLocaleString()}</span>
              </div>
            </div>
          )}

          <button onClick={() => setStep(2)} disabled={!cart.length}
            className="btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '12px', fontSize: 14, borderRadius: 10, opacity: cart.length ? 1 : 0.5 }}>
            Next: Customer Details →
          </button>
        </div>
      )}

      {/* ── STEP 2: Customer details ── */}
      {step === 2 && (
        <div style={{ background: '#fff', borderRadius: 14, border: '0.5px solid #E8E8E0', padding: '1.5rem' }}>
          <div style={{ fontWeight: 600, fontSize: 14, color: '#374151', marginBottom: 16 }}>Customer details</div>

          <Field label="Full Name" required>
            <input type="text" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              placeholder="e.g. Juan dela Cruz" style={INPUT} />
          </Field>

          <Field label="Mobile Number" required>
            <input type="tel" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
              placeholder="09XXXXXXXXX" style={INPUT} />
          </Field>

          <Field label="Email (optional)">
            <input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
              placeholder="customer@email.com" style={INPUT} />
          </Field>

          <Field label="Address (optional)">
            <input type="text" value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))}
              placeholder="Street, Barangay, City" style={INPUT} />
          </Field>

          {/* Pickup date/time */}
          <div style={{ display: 'grid', gridTemplateColumns: timeSlots.length ? '1fr 1fr' : '1fr', gap: 12, marginBottom: 16 }}>
            <Field label="Pickup Date" required>
              <input type="date" value={form.pickup_date} min={minDate}
                onChange={e => setForm(p => ({ ...p, pickup_date: e.target.value }))} style={INPUT} />
            </Field>
            {timeSlots.length > 0 && (
              <Field label="Pickup Time" required>
                <select value={form.pickup_time} onChange={e => setForm(p => ({ ...p, pickup_time: e.target.value }))} style={INPUT}>
                  <option value="">Select time…</option>
                  {timeSlots.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </Field>
            )}
          </div>

          <Field label="Notes (optional)">
            <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
              placeholder="Special instructions..." rows={2}
              style={{ ...INPUT, resize: 'vertical' }} />
          </Field>

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setStep(1)} className="btn-ghost" style={{ flex: 1, justifyContent: 'center', padding: '12px', borderRadius: 10 }}>← Back</button>
            <button onClick={() => setStep(3)} disabled={!step2Valid()}
              className="btn-primary" style={{ flex: 2, justifyContent: 'center', padding: '12px', fontSize: 14, borderRadius: 10, opacity: step2Valid() ? 1 : 0.5 }}>
              Review & Pay →
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 3: Confirm & Pay ── */}
      {step === 3 && (
        <div>
          {/* Order summary card */}
          <div style={{ background: '#fff', borderRadius: 14, border: '0.5px solid #E8E8E0', padding: '1.5rem', marginBottom: 14 }}>
            <div style={{ fontWeight: 600, fontSize: 14, color: '#374151', marginBottom: 14 }}>Order summary</div>

            {/* Customer */}
            <div style={{ background: '#F7F9FC', borderRadius: 10, padding: '12px 14px', marginBottom: 14 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#111827' }}>{form.name}</div>
              <div style={{ fontSize: 12, color: '#374151', marginTop: 2 }}>{form.phone}{form.email ? ` · ${form.email}` : ''}</div>
              {form.address && <div style={{ fontSize: 12, color: '#374151', marginTop: 2 }}>{form.address}</div>}
              <div style={{ fontSize: 12, color: '#374151', marginTop: 2 }}>📅 Pickup: {form.pickup_date}{form.pickup_time ? ` at ${form.pickup_time}` : ''}</div>
              {form.notes && <div style={{ fontSize: 12, color: '#374151', marginTop: 4, fontStyle: 'italic' }}>"{form.notes}"</div>}
            </div>

            {/* Cart items */}
            {cart.map((item, idx) => (
              <div key={item._id} style={{ paddingBottom: 10, marginBottom: 10, borderBottom: idx < cart.length - 1 ? '0.5px solid #F0F0EC' : 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 600 }}>
                  <span>{item.service_name}</span>
                  <span>₱{item.itemTotal.toLocaleString()}</span>
                </div>
                {item.displayLines.filter(l => l.label !== item.service_name).map((l, i) => (
                  <div key={i} style={{ fontSize: 12, color: '#374151', paddingLeft: 8, marginTop: 2 }}>
                    {l.label}{l.price > 0 ? ` — ₱${l.price.toLocaleString()}` : ''}
                  </div>
                ))}
              </div>
            ))}

            {/* Promo */}
            {!appliedPromo ? (
              <div style={{ display: 'flex', gap: 8, marginBottom: 12, marginTop: 4 }}>
                <input type="text" value={promoInput} onChange={e => setPromoInput(e.target.value.toUpperCase())}
                  placeholder="Promo code" style={{ ...INPUT, flex: 1, padding: '8px 12px', fontSize: 13 }} />
                <button onClick={applyPromo} disabled={promoLoading || !promoInput.trim()}
                  className="btn-ghost" style={{ flexShrink: 0, padding: '8px 14px', fontSize: 13 }}>
                  {promoLoading ? '…' : 'Apply'}
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderRadius: 8, background: '#F0EFFC', marginBottom: 12, marginTop: 4 }}>
                <span style={{ fontSize: 13, color: '#7F77DD', fontWeight: 600 }}>🎟️ {appliedPromo.code}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#7F77DD' }}>−₱{promoDiscount.toLocaleString()}</span>
                  <button onClick={() => { setAppliedPromo(null); setPromoInput(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', fontSize: 16, padding: 0 }}>×</button>
                </div>
              </div>
            )}
            {promoError && <div style={{ fontSize: 12, color: '#A32D2D', marginBottom: 10 }}>{promoError}</div>}

            {promoDiscount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 13, color: '#374151' }}>
                <span>Subtotal</span><span>₱{cartTotal.toLocaleString()}</span>
              </div>
            )}
            {promoDiscount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 13, color: '#7F77DD', fontWeight: 600 }}>
                <span>Promo discount</span><span>−₱{promoDiscount.toLocaleString()}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderTop: '0.5px solid #E8E8E0', marginTop: 6, fontSize: 16 }}>
              <span style={{ fontWeight: 700 }}>Total</span>
              <span style={{ fontWeight: 800, color: '#38a9c2' }}>₱{grandTotal.toLocaleString()}</span>
            </div>
          </div>

          {/* Privacy consent */}
          <div style={{ marginBottom: 16, padding: '12px 14px', borderRadius: 10, border: `1.5px solid ${privacyConsent ? '#38a9c2' : '#E2E8F0'}`, background: privacyConsent ? '#EBF8FA' : '#FAFAFA', display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer' }}
            onClick={() => setPrivacyConsent(p => !p)}>
            <div style={{ flexShrink: 0, width: 20, height: 20, borderRadius: 5, border: `2px solid ${privacyConsent ? '#38a9c2' : '#CBD5E0'}`, background: privacyConsent ? '#38a9c2' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 1, transition: 'all .15s' }}>
              {privacyConsent && <span style={{ color: '#fff', fontSize: 12, fontWeight: 700, lineHeight: 1 }}>✓</span>}
            </div>
            <p style={{ fontSize: 12, color: '#374151', margin: 0, lineHeight: 1.5 }}>
              I voluntarily give my consent to <strong>{shopInfo?.name || 'this shop'}</strong> to keep and process the information, and to use it only to provide the service and to collect payment. I acknowledge and agree that in doing so, any such data may be processed through third-party data processors such as, but not limited to, service providers. I give my consent thereto pursuant to the requirements of Republic Act No. 10173, or the "Data Privacy Act of 2012."
            </p>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setStep(2)} className="btn-ghost" style={{ flex: 1, justifyContent: 'center', padding: '12px', borderRadius: 10 }}>← Back</button>
            <button onClick={() => setShowQR(true)} disabled={!privacyConsent}
              style={{
                flex: 2, padding: '13px', fontSize: 14, fontWeight: 700, borderRadius: 10,
                border: 'none', cursor: privacyConsent ? 'pointer' : 'not-allowed', fontFamily: 'inherit',
                background: privacyConsent ? '#fdca00' : '#E2E8F0', color: privacyConsent ? '#1F2937' : '#9CA3AF',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'all .15s',
              }}>
              💳 Show QR &amp; Collect Payment
            </button>
          </div>
        </div>
      )}

      {/* QR Payment modal */}
      {showQR && (
        <QRModal
          total={grandTotal}
          qrUrl={shopInfo?.qr_image_url}
          shopName={shopInfo?.name}
          submitting={submitting}
          error={submitErr}
          onConfirm={handleConfirmPayment}
          onCancel={() => { setShowQR(false); setSubmitErr(''); }}
        />
      )}
    </div>
  );
}
