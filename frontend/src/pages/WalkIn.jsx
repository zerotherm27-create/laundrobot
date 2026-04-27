import { useEffect, useState } from 'react';
import { getServices, getCategories, getMyTenantSettings, createWalkInOrder } from '../api.js';
import { Icon } from '../components/Icons.jsx';

// ── helpers ──────────────────────────────────────────────────────────────────

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

// ── Shared styles (matching BookingForm exactly) ──────────────────────────────

const INPUT = {
  width: '100%', boxSizing: 'border-box', padding: '10px 12px', fontSize: 14,
  borderRadius: 8, border: '1.5px solid #B8C4CE', background: '#F8FAFC',
  fontFamily: 'inherit', color: '#0D1117', outline: 'none',
  transition: 'border-color .15s, box-shadow .15s',
};
const LABEL = { fontSize: 12, fontWeight: 600, color: '#1F2937', display: 'block', marginBottom: 6 };

function Field({ label, required, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={LABEL}>{label}{required && <span style={{ color: '#E53E3E', marginLeft: 2 }}>*</span>}</label>
      {children}
    </div>
  );
}

function focusInput(e) {
  e.target.style.borderColor = '#38a9c2';
  e.target.style.boxShadow = '0 0 0 3px rgba(56,169,194,.18)';
}
function blurInput(e) {
  e.target.style.borderColor = '#B8C4CE';
  e.target.style.boxShadow = 'none';
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
              style={{ maxWidth: 200, width: '100%', borderRadius: 12, border: '1px solid #E8E8E0', boxShadow: '0 2px 8px rgba(0,0,0,.08)' }} />
          </div>
        ) : (
          <div style={{ textAlign: 'center', marginBottom: 20, padding: '24px', background: '#F7F7F5', borderRadius: 12, border: '1px dashed #D1D5DB' }}>
            <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'center' }}>
              <Icon name="walkin" size={28} color="#9CA3AF" />
            </div>
            <div style={{ fontSize: 13, color: '#374151', fontWeight: 500 }}>No QR image set</div>
            <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 4 }}>Add your GCash/Maya QR in Settings → Walk-in QR</div>
          </div>
        )}

        {error && (
          <div style={{ marginBottom: 14, padding: '10px 12px', borderRadius: 8, background: '#FCEBEB', color: '#A32D2D', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Icon name="alert-triangle" size={13} color="#A32D2D" /> {error}
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
            : <><Icon name="check" size={16} color="#1F2937" /> I Received Payment</>}
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

  // ── Price calculation ──────────────────────────────────────────────────────

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
    <div style={{ maxWidth: 620, margin: '0 auto' }}>
      <div className="skeleton" style={{ height: 28, width: 180, marginBottom: 24 }} />
      <div className="skeleton" style={{ height: 400, borderRadius: 16 }} />
    </div>
  );

  // ── Success ───────────────────────────────────────────────────────────────

  if (step === 'success') return (
    <div style={{ maxWidth: 620, margin: '0 auto' }} className="animate-fade-up">
      <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 4px 24px rgba(0,0,0,.08)', padding: '2.5rem', textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'linear-gradient(135deg, #d6eff4 0%, #E2F5F8 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="check-circle" size={32} color="#38a9c2" />
          </div>
        </div>
        <div style={{ fontSize: 22, fontWeight: 800, color: '#111827', marginBottom: 6 }}>Payment Received!</div>
        <div style={{ fontSize: 13, color: '#374151', marginBottom: 24 }}>Order created and marked as paid.</div>

        <div style={{ background: '#F7F9FC', borderRadius: 12, padding: '18px 20px', marginBottom: 8, display: 'inline-block', minWidth: 240, border: '1.5px solid #E2F5F8' }}>
          <div style={{ fontSize: 11, color: '#374151', marginBottom: 4, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.06em' }}>Booking Reference</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#38a9c2', letterSpacing: '.5px', fontFamily: 'monospace' }}>{bookingRef}</div>
        </div>

        <div style={{ fontSize: 13, color: '#374151', marginBottom: 28, marginTop: 16 }}>
          Now visible in the Kanban board tagged as <strong>Walk-in</strong>.
        </div>

        <button onClick={reset} className="btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '13px', fontSize: 14, borderRadius: 10 }}>
          <Icon name="walkin" size={16} color="#fff" style={{ marginRight: 6 }} />
          New Walk-in Order
        </button>
      </div>
    </div>
  );

  // ── card style (matching BookingForm) ────────────────────────────────────
  const cardStyle = { background: '#fff', borderRadius: 16, boxShadow: '0 4px 24px rgba(0,0,0,.08)', padding: '1.75rem', maxWidth: 620, margin: '0 auto' };

  return (
    <div style={{ maxWidth: 660, margin: '0 auto' }} className="animate-fade-up">
      {/* Header */}
      <div style={{ marginBottom: '1.25rem' }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#111827', letterSpacing: '-.3px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon name="walkin" size={20} color="#38a9c2" />
          Walk-in POS
        </h1>
        <p style={{ fontSize: 13, color: '#374151', marginTop: 2 }}>In-store order — no delivery, payment via QR.</p>
      </div>

      {/* ── Progress steps (matching BookingForm) ── */}
      <div style={{ maxWidth: 620, margin: '0 auto 20px', display: 'flex', alignItems: 'center' }}>
        {[{ n: 1, label: 'Service' }, { n: 2, label: 'Details' }, { n: 3, label: 'Review' }].map(({ n, label }, i) => (
          <div key={n} style={{ display: 'flex', alignItems: 'center', flex: i < 2 ? 1 : 'none' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: step > n ? 'pointer' : 'default' }}
              onClick={() => { if (step > n || (n === 2 && cart.length)) setStep(n); }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 700, fontSize: 13,
                background: step > n ? '#38a9c2' : step === n ? '#38a9c2' : '#E2E8F0',
                color: step >= n ? '#fff' : '#374151',
                transition: 'all .2s',
              }}>
                {step > n ? <Icon name="check" size={14} color="#fff" /> : n}
              </div>
              <div style={{ fontSize: 10, fontWeight: 600, marginTop: 4, color: step >= n ? '#38a9c2' : '#374151', textTransform: 'uppercase', letterSpacing: '.05em' }}>{label}</div>
            </div>
            {i < 2 && <div style={{ flex: 1, height: 2, background: step > n ? '#38a9c2' : '#E2E8F0', margin: '0 6px 16px', transition: 'all .2s' }} />}
          </div>
        ))}
      </div>

      {/* ── STEP 1: Services ── */}
      {step === 1 && (
        <div style={cardStyle}>
          <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 4 }}>Choose a Service</div>
          <div style={{ fontSize: 13, color: '#374151', marginBottom: 20 }}>Select the laundry service you need.</div>

          {/* Category tabs */}
          {categories.length > 1 && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
              {categories.map(cat => (
                <button key={cat.id} onClick={() => setActiveCat(cat.id)}
                  style={{
                    padding: '6px 14px', fontSize: 12, borderRadius: 20, cursor: 'pointer',
                    fontFamily: 'inherit', fontWeight: 600, border: 'none',
                    background: activeCat === cat.id ? '#38a9c2' : '#F0F0EC',
                    color: activeCat === cat.id ? '#fff' : '#374151',
                  }}>
                  {cat.name}
                </button>
              ))}
            </div>
          )}

          {/* Service cards */}
          {visibleServices.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#374151', fontSize: 13 }}>No services in this category.</div>
          ) : (
            <div style={{ display: 'grid', gap: 10, marginBottom: 16 }}>
              {visibleServices.map(svc => {
                const selected = selectedSvc?.id === svc.id;
                return (
                  <div key={svc.id}
                    onClick={() => { setSelectedSvc(svc); setFieldValues({}); setAddonQty({}); setAddonOwn({}); }}
                    style={{
                      padding: '14px 16px', borderRadius: 12, cursor: 'pointer',
                      border: selected ? '2px solid #38a9c2' : '1.5px solid #E2E8F0',
                      background: selected ? '#EBF8FA' : '#fff',
                      transition: 'all .15s',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12,
                    }}>
                    {svc.image_url && (
                      <img src={svc.image_url} alt={svc.name}
                        style={{ width: 56, height: 56, borderRadius: 10, objectFit: 'cover', flexShrink: 0, border: '1px solid #E2E8F0' }} />
                    )}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 3, color: '#111827' }}>{svc.name}</div>
                      {svc.description && <div style={{ fontSize: 12, color: '#374151', lineHeight: 1.5 }}>{svc.description}</div>}
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 15, color: '#38a9c2' }}>
                        {Number(svc.price) > 0 ? `₱${Number(svc.price).toLocaleString()}` : 'See options'}
                      </div>
                      {svc.unit && <div style={{ fontSize: 11, color: '#374151' }}>{svc.unit}</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Custom fields for selected service */}
          {selectedSvc && (
            <div style={{ marginTop: 8, padding: '16px', background: '#F7F9FD', borderRadius: 12, border: '1.5px solid #E2F5F8', marginBottom: 16 }}>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 14, color: '#1a7d94', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Icon name="orders" size={13} color="#1a7d94" />
                Service Details — {selectedSvc.name}
              </div>

              {(selectedSvc.custom_fields || []).map(f => {
                // Addon stepper
                if (f.field_type === 'addon') {
                  if (!isAddonVisible(f)) return null;
                  const aqty = addonQty[f.id] || 0;
                  const isOwn = !!(f.allow_own && addonOwn[f.id]);
                  const lineTotal = Number(f.unit_price || 0) * aqty;
                  const unsatisfied = f.required && aqty === 0 && !isOwn;
                  return (
                    <div key={f.id} style={{ marginBottom: 14, background: '#fff', border: `1.5px solid ${unsatisfied ? '#F09595' : '#E2E8F0'}`, borderRadius: 10, padding: '10px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: 13, color: '#111827' }}>
                            {f.label}
                            {f.required && <span style={{ color: '#E53E3E', marginLeft: 4, fontSize: 11 }}>*</span>}
                          </div>
                          <div style={{ fontSize: 12, color: '#38a9c2', fontWeight: 600, marginTop: 1 }}>+₱{Number(f.unit_price || 0).toLocaleString()} each</div>
                          {f.placeholder && <div style={{ fontSize: 11, color: '#374151', marginTop: 1 }}>{f.placeholder}</div>}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 0, opacity: isOwn ? 0.4 : 1 }}>
                          <button type="button" disabled={isOwn}
                            onClick={() => setAddonQty(p => ({ ...p, [f.id]: Math.max(0, (p[f.id] || 0) - 1) }))}
                            style={{ width: 32, height: 32, borderRadius: '8px 0 0 8px', border: '1.5px solid #E2E8F0', background: '#F7F9FD', fontSize: 16, cursor: isOwn ? 'not-allowed' : 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#374151' }}>−</button>
                          <div style={{ width: 40, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1.5px solid #E2E8F0', borderLeft: 'none', borderRight: 'none', fontSize: 14, fontWeight: 700, background: aqty > 0 ? '#E2F5F8' : '#fff', color: aqty > 0 ? '#1a7d94' : '#374151' }}>{aqty}</div>
                          <button type="button" disabled={isOwn}
                            onClick={() => setAddonQty(p => ({ ...p, [f.id]: (p[f.id] || 0) + 1 }))}
                            style={{ width: 32, height: 32, borderRadius: '0 8px 8px 0', border: '1.5px solid #38a9c2', background: '#38a9c2', fontSize: 16, cursor: isOwn ? 'not-allowed' : 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>+</button>
                        </div>
                        {lineTotal > 0 && <div style={{ fontSize: 13, fontWeight: 700, color: '#1a7d94', minWidth: 60, textAlign: 'right' }}>₱{lineTotal.toLocaleString()}</div>}
                      </div>
                      {f.allow_own && (
                        <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px dashed #E2E8F0' }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: isOwn ? '#1a7d94' : '#374151', fontWeight: isOwn ? 600 : 400 }}>
                            <div onClick={() => {
                              const next = !isOwn;
                              setAddonOwn(p => ({ ...p, [f.id]: next }));
                              if (next) setAddonQty(p => ({ ...p, [f.id]: 0 }));
                            }} style={{ flexShrink: 0, width: 18, height: 18, borderRadius: 4, border: `2px solid ${isOwn ? '#38a9c2' : '#CBD5E0'}`, background: isOwn ? '#38a9c2' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .15s' }}>
                              {isOwn && <Icon name="check" size={11} color="#fff" />}
                            </div>
                            I'll provide my own {f.label.toLowerCase()}
                          </label>
                        </div>
                      )}
                      {unsatisfied && (
                        <div style={{ marginTop: 8, fontSize: 11, color: '#A32D2D', fontWeight: 600 }}>
                          Please select a quantity or choose to provide your own.
                        </div>
                      )}
                    </div>
                  );
                }

                // Select field: button group (matching BookingForm)
                if (f.field_type === 'select') {
                  const opts = normalizeOpts(f.options);
                  const selectedVal = fieldValues[f.id];
                  return (
                    <div key={f.id} style={{ marginBottom: 16 }}>
                      <label style={{ fontSize: 12, fontWeight: 600, color: '#1F2937', display: 'block', marginBottom: 8 }}>
                        {f.label}{f.required && <span style={{ color: '#E53E3E', marginLeft: 2 }}>*</span>}
                      </label>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {opts.map(opt => {
                          const isSel = selectedVal === opt.label;
                          return (
                            <button key={opt.label} type="button"
                              onClick={() => setFieldValues(p => ({ ...p, [f.id]: opt.label }))}
                              style={{
                                padding: '9px 16px', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit',
                                border: isSel ? '2px solid #38a9c2' : '1.5px solid #E2E8F0',
                                background: isSel ? '#E2F5F8' : '#fff',
                                color: isSel ? '#1a7d94' : '#374151',
                                fontSize: 13, fontWeight: isSel ? 700 : 500,
                                transition: 'all .15s', textAlign: 'center', minWidth: 80,
                              }}>
                              <div>{opt.label}</div>
                              {(opt.price_type === 'copy_base' || opt.price > 0) && (
                                <div style={{ fontSize: 11, color: isSel ? '#38a9c2' : '#7C3AED', marginTop: 2, fontWeight: 600 }}>
                                  {opt.price_type === 'copy_base'
                                    ? (baseVariationPrice > 0 ? `+₱${Number(baseVariationPrice).toLocaleString()}` : '= base')
                                    : `+₱${Number(opt.price).toLocaleString()}`}
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                }

                // Number / text / textarea fields
                if (f.field_type === 'number') {
                  return (
                    <Field key={f.id} label={`${f.label} (× price)`} required={f.required}>
                      <input type="number" min={f.min_value ?? 0} max={f.max_value ?? undefined}
                        value={fieldValues[f.id] || ''}
                        onChange={e => setFieldValues(p => ({ ...p, [f.id]: e.target.value }))}
                        placeholder={f.placeholder || ''} style={INPUT}
                        onFocus={focusInput} onBlur={blurInput} />
                    </Field>
                  );
                }

                if (f.field_type === 'textarea') {
                  return (
                    <Field key={f.id} label={f.label} required={f.required}>
                      <textarea value={fieldValues[f.id] || ''}
                        onChange={e => setFieldValues(p => ({ ...p, [f.id]: e.target.value }))}
                        placeholder={f.placeholder || ''} rows={3}
                        style={{ ...INPUT, resize: 'vertical', minHeight: 80 }}
                        onFocus={focusInput} onBlur={blurInput} />
                    </Field>
                  );
                }

                return (
                  <Field key={f.id} label={f.label} required={f.required}>
                    <input type="text" value={fieldValues[f.id] || ''}
                      onChange={e => setFieldValues(p => ({ ...p, [f.id]: e.target.value }))}
                      placeholder={f.placeholder || ''} style={INPUT}
                      onFocus={focusInput} onBlur={blurInput} />
                  </Field>
                );
              })}

              {/* Live price preview */}
              {(subtotal + addonTotal) > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderTop: '0.5px solid #E2E8F0', marginTop: 8, fontSize: 14 }}>
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
            <div style={{ background: '#F7F9FD', borderRadius: 12, border: '1.5px solid #E2F5F8', padding: '1.25rem', marginBottom: 16 }}>
              <div style={{ fontWeight: 600, fontSize: 13, color: '#1a7d94', marginBottom: 10 }}>Order so far</div>
              {cart.map((item, idx) => (
                <div key={item._id} style={{ marginBottom: 10, paddingBottom: 10, borderBottom: idx < cart.length - 1 ? '0.5px solid #E2E8F0' : 'none' }}>
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
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 8, borderTop: '0.5px solid #E2E8F0', fontSize: 15 }}>
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
        <div style={cardStyle}>
          <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 4 }}>Customer Details</div>
          <div style={{ fontSize: 13, color: '#374151', marginBottom: 20 }}>Enter the customer's information below.</div>

          <Field label="Full Name" required>
            <input type="text" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              placeholder="e.g. Juan dela Cruz" style={INPUT}
              onFocus={focusInput} onBlur={blurInput} />
          </Field>

          <Field label="Mobile Number" required>
            <input type="tel" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
              placeholder="09XXXXXXXXX" style={INPUT}
              onFocus={focusInput} onBlur={blurInput} />
          </Field>

          <Field label="Email (optional)">
            <input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
              placeholder="customer@email.com" style={INPUT}
              onFocus={focusInput} onBlur={blurInput} />
          </Field>

          <Field label="Address (optional)">
            <input type="text" value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))}
              placeholder="Street, Barangay, City" style={INPUT}
              onFocus={focusInput} onBlur={blurInput} />
          </Field>

          {/* Pickup date/time */}
          <div style={{ display: 'grid', gridTemplateColumns: timeSlots.length ? '1fr 1fr' : '1fr', gap: 12, marginBottom: 0 }}>
            <Field label="Pickup Date" required>
              <input type="date" value={form.pickup_date} min={minDate}
                onChange={e => setForm(p => ({ ...p, pickup_date: e.target.value }))} style={INPUT}
                onFocus={focusInput} onBlur={blurInput} />
            </Field>
            {timeSlots.length > 0 && (
              <Field label="Pickup Time" required>
                <select value={form.pickup_time} onChange={e => setForm(p => ({ ...p, pickup_time: e.target.value }))}
                  style={INPUT} onFocus={focusInput} onBlur={blurInput}>
                  <option value="">Select time…</option>
                  {timeSlots.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </Field>
            )}
          </div>

          <Field label="Notes (optional)">
            <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
              placeholder="Special instructions..." rows={2}
              style={{ ...INPUT, resize: 'vertical' }}
              onFocus={focusInput} onBlur={blurInput} />
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
          <div style={cardStyle}>
            <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 4 }}>Review & Pay</div>
            <div style={{ fontSize: 13, color: '#374151', marginBottom: 20 }}>Confirm the order details before collecting payment.</div>

            {/* Customer info */}
            <div style={{ background: '#F7F9FC', borderRadius: 10, padding: '12px 14px', marginBottom: 16, border: '1px solid #E2F5F8' }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#111827' }}>{form.name}</div>
              <div style={{ fontSize: 12, color: '#374151', marginTop: 2 }}>{form.phone}{form.email ? ` · ${form.email}` : ''}</div>
              {form.address && <div style={{ fontSize: 12, color: '#374151', marginTop: 2 }}>{form.address}</div>}
              <div style={{ fontSize: 12, color: '#374151', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                <Icon name="calendar" size={11} color="#374151" />
                Pickup: {form.pickup_date}{form.pickup_time ? ` at ${form.pickup_time}` : ''}
              </div>
              {form.notes && <div style={{ fontSize: 12, color: '#374151', marginTop: 4, fontStyle: 'italic' }}>"{form.notes}"</div>}
            </div>

            {/* Cart items */}
            {cart.map((item, idx) => (
              <div key={item._id} style={{ paddingBottom: 10, marginBottom: 10, borderBottom: idx < cart.length - 1 ? '0.5px solid #E2E8F0' : 'none' }}>
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
                  placeholder="Promo code" style={{ ...INPUT, flex: 1, padding: '8px 12px', fontSize: 13 }}
                  onFocus={focusInput} onBlur={blurInput} />
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
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderTop: '0.5px solid #E2E8F0', marginTop: 6, fontSize: 16 }}>
              <span style={{ fontWeight: 700 }}>Total</span>
              <span style={{ fontWeight: 800, color: '#38a9c2' }}>₱{grandTotal.toLocaleString()}</span>
            </div>

            {/* Privacy consent */}
            <div style={{ marginBottom: 20, padding: '12px 14px', borderRadius: 10, border: `1.5px solid ${privacyConsent ? '#38a9c2' : '#E2E8F0'}`, background: privacyConsent ? '#EBF8FA' : '#FAFAFA', display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer', transition: 'all .15s' }}
              onClick={() => setPrivacyConsent(p => !p)}>
              <div style={{ flexShrink: 0, width: 20, height: 20, borderRadius: 5, border: `2px solid ${privacyConsent ? '#38a9c2' : '#CBD5E0'}`, background: privacyConsent ? '#38a9c2' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 1, transition: 'all .15s' }}>
                {privacyConsent && <Icon name="check" size={11} color="#fff" />}
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
                <Icon name="walkin" size={16} color={privacyConsent ? '#1F2937' : '#9CA3AF'} />
                Show QR &amp; Collect Payment
              </button>
            </div>
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
