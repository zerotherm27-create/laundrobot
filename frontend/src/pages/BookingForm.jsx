import { useEffect, useState, useRef } from 'react';
import {
  getPublicTenantInfo, getPublicCategories, getPublicServices,
  getPublicDeliveryZones, lookupPublicCustomer, createPublicOrder,
} from '../api.js';

const INPUT = {
  width: '100%', boxSizing: 'border-box', padding: '10px 12px', fontSize: 14,
  borderRadius: 8, border: '1.5px solid #E2E8F0', background: '#fff',
  fontFamily: 'inherit', color: '#0D1117', outline: 'none',
  transition: 'border-color .15s, box-shadow .15s',
};
const LABEL = { fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 };

function Field({ label, required, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={LABEL}>{label}{required && <span style={{ color: '#E53E3E', marginLeft: 2 }}>*</span>}</label>
      {children}
    </div>
  );
}

function closeMiniApp() {
  // Try Messenger Extensions first, then fall back to window.close()
  try {
    if (window.MessengerExtensions) {
      window.MessengerExtensions.requestCloseBrowser(
        () => {},
        () => { try { window.close(); } catch (_) {} }
      );
      return;
    }
  } catch (_) {}
  try { window.close(); } catch (_) {}
}

function normalizeOpts(options) {
  if (!Array.isArray(options)) return [];
  return options.map(o => typeof o === 'object' && o !== null
    ? { price_type: 'fixed', ...o }
    : { label: String(o), price: 0, price_type: 'fixed' });
}

export default function BookingForm({ tenantId }) {
  const [step, setStep]           = useState(1); // 1 | 2 | 3 | 'success'
  const [tenant, setTenant]       = useState(null);
  const [categories, setCategories] = useState([]);
  const [services, setServices]   = useState([]);
  const [zones, setZones]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [notFound, setNotFound]   = useState(false);

  // Step 1 state
  const [activeCat, setActiveCat]       = useState(null);
  const [selectedSvc, setSelectedSvc]   = useState(null);
  const [fieldValues, setFieldValues]   = useState({});
  const [weight, setWeight]             = useState('');
  const [addonQty, setAddonQty]         = useState({});

  // Step 2 state
  const [form, setForm] = useState({ name: '', phone: '', email: '', addr_unit: '', addr_street: '', addr_barangay: '', addr_city: '', pickup_date: '', delivery_zone_id: '', notes: '' });
  const [savedCustomer, setSavedCustomer] = useState(null);   // repeat customer data
  const [addressMode, setAddressMode]     = useState('new');  // 'saved' | 'new'
  const [lookingUp, setLookingUp]         = useState(false);
  const phoneDebounce = useRef(null);

  // Step 3 state
  const [privacyConsent, setPrivacyConsent] = useState(false);

  // Result
  const [submitting, setSubmitting] = useState(false);
  const [submitErr,  setSubmitErr]  = useState('');
  const [result, setResult]         = useState(null); // { order_id, payment_url, total, service_name }

  useEffect(() => {
    Promise.all([
      getPublicTenantInfo(tenantId),
      getPublicCategories(tenantId),
      getPublicServices(tenantId),
      getPublicDeliveryZones(tenantId),
    ]).then(([t, cats, svcs, z]) => {
      setTenant(t.data);
      setCategories(cats.data);
      setServices(svcs.data);
      setZones(z.data);
      if (cats.data.length > 0) setActiveCat(cats.data[0].id);
    }).catch(e => {
      if (e.response?.status === 404) setNotFound(true);
    }).finally(() => setLoading(false));
  }, [tenantId]);

  const visibleServices = activeCat
    ? services.filter(s => s.category_id === activeCat)
    : services;

  const isPerKg = selectedSvc?.unit?.toLowerCase().includes('kg');
  const w = parseFloat(weight) || 0;
  const price = selectedSvc ? Number(selectedSvc.price) : 0;

  // First number-type field drives qty multiplier (non-kg services)
  const firstNumField = (selectedSvc?.custom_fields || []).find(f => f.field_type === 'number');
  const qty = firstNumField ? parseFloat(fieldValues[firstNumField.id] || 0) : 0;

  // Variation (select) fields — sum selected option prices (with copy_base support)
  const selectFields = (selectedSvc?.custom_fields || []).filter(f => f.field_type === 'select');

  // Base variation price = price of the first fixed-priced selected option with price > 0
  const baseVariationPrice = (() => {
    for (const f of selectFields) {
      const opts = normalizeOpts(f.options);
      const sel = opts.find(o => o.label === fieldValues[f.id]);
      if (sel && (sel.price_type || 'fixed') !== 'copy_base' && Number(sel.price || 0) > 0) {
        return Number(sel.price);
      }
    }
    return 0;
  })();

  const variationTotal = selectFields.reduce((sum, f) => {
    const opts = normalizeOpts(f.options);
    const sel = opts.find(o => o.label === fieldValues[f.id]);
    if (!sel) return sum;
    const optPrice = (sel.price_type || 'fixed') === 'copy_base'
      ? baseVariationPrice
      : Number(sel.price || 0);
    return sum + optPrice;
  }, 0);

  // If any select option has a price > 0, use variation pricing (no base price)
  const hasVariationPricing = selectFields.some(f => normalizeOpts(f.options).some(o => Number(o.price || 0) > 0));
  const baseSubtotal = selectedSvc
    ? (isPerKg && w > 0 ? price * w : qty > 0 ? price * qty : (hasVariationPricing ? 0 : price))
    : 0;
  const subtotal = baseSubtotal + variationTotal;

  // Addon fields + totals
  const addonFields = (selectedSvc?.custom_fields || []).filter(f => f.field_type === 'addon');
  const addonTotal = addonFields.reduce((s, f) => s + Number(f.unit_price || 0) * (addonQty[f.id] || 0), 0);

  const selectedZone = zones.find(z => z.id === Number(form.delivery_zone_id)) || null;
  const deliveryFee = selectedZone ? Number(selectedZone.fee) : 0;
  const total = subtotal + addonTotal + deliveryFee;

  function step1Valid() {
    if (!selectedSvc) return false;
    if (isPerKg && (!weight || parseFloat(weight) <= 0)) return false;
    for (const f of (selectedSvc.custom_fields || [])) {
      if (f.field_type === 'addon') continue; // addons are always optional
      if (f.required && f.label?.toLowerCase().includes('weight')) {
        if (!weight || parseFloat(weight) <= 0) return false;
      } else if (f.required && !fieldValues[f.id]) return false;
    }
    return true;
  }

  const fullAddress = addressMode === 'saved' && savedCustomer?.address
    ? savedCustomer.address
    : [form.addr_unit, form.addr_street, form.addr_barangay, form.addr_city].filter(Boolean).join(', ');

  function step2Valid() {
    if (!form.name.trim() || !form.phone.trim() || !form.pickup_date) return false;
    if (addressMode === 'saved') return !!savedCustomer?.address;
    return form.addr_unit.trim() && form.addr_street.trim() && form.addr_barangay.trim() && form.addr_city.trim();
  }

  async function handleSubmit() {
    setSubmitting(true); setSubmitErr('');
    try {
      const customFields = [];
      if (isPerKg && weight) customFields.push({ label: 'Weight (kg)', value: weight });
      for (const f of (selectedSvc.custom_fields || [])) {
        if (f.field_type === 'addon') {
          const aqty = addonQty[f.id] || 0;
          if (aqty > 0) customFields.push({ label: f.label, value: String(aqty), unit_price: f.unit_price });
        } else if (!f.label?.toLowerCase().includes('weight') && fieldValues[f.id] !== undefined) {
          customFields.push({ label: f.label, value: fieldValues[f.id] });
        }
      }
      const { data } = await createPublicOrder(tenantId, {
        service_id: selectedSvc.id,
        custom_fields: customFields,
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim() || undefined,
        address: fullAddress,
        pickup_date: form.pickup_date,
        delivery_zone_id: form.delivery_zone_id ? Number(form.delivery_zone_id) : undefined,
        notes: form.notes.trim() || undefined,
      });
      setResult(data);
      setStep('success');
    } catch (e) {
      setSubmitErr(e.response?.data?.error || 'Something went wrong. Please try again.');
    } finally { setSubmitting(false); }
  }

  // ─── Loading ───────────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F7F7F5' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 36, height: 36, borderRadius: '50%', border: '3px solid #E6F1FB', borderTopColor: '#378ADD', animation: 'spin .7s linear infinite', margin: '0 auto 12px' }} />
        <div style={{ color: '#374151', fontSize: 14 }}>Loading…</div>
      </div>
    </div>
  );

  if (notFound) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F7F7F5' }}>
      <div style={{ textAlign: 'center', maxWidth: 360, padding: 32 }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>🔍</div>
        <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 8 }}>Shop not found</div>
        <div style={{ color: '#374151', fontSize: 14 }}>This booking link is invalid or the shop is no longer active.</div>
      </div>
    </div>
  );

  const cardStyle = { background: '#fff', borderRadius: 16, boxShadow: '0 4px 24px rgba(0,0,0,.08)', padding: '1.75rem', maxWidth: 620, margin: '0 auto' };

  // ─── Success ───────────────────────────────────────────────────────────────
  if (step === 'success') return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #E6F1FB 0%, #F7F7F5 60%)', padding: '2rem 1rem' }}>
      <div style={cardStyle}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 52, marginBottom: 8 }}>🎉</div>
          <div style={{ fontWeight: 700, fontSize: 20, color: '#111827', marginBottom: 6 }}>Order Confirmed!</div>
          <div style={{ color: '#374151', fontSize: 14 }}>
            Thank you! We've received your order and will contact you shortly to confirm your pickup details.
          </div>
        </div>

        {/* Order summary */}
        <div style={{ background: '#F7F7F5', borderRadius: 12, padding: '1.25rem', marginBottom: 16 }}>
          {[
            ['Order ID', result.order_id],
            ['Service', result.service_name],
            ['Total', `₱${Number(result.total).toLocaleString()}`],
          ].map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: 14 }}>
              <span style={{ color: '#374151' }}>{k}</span>
              <span style={{ fontWeight: 600 }}>{v}</span>
            </div>
          ))}
        </div>

        {/* Pay Now */}
        {result.payment_url && (
          <a href={result.payment_url} target="_blank" rel="noreferrer"
            style={{ display: 'block', textAlign: 'center', padding: '13px', borderRadius: 10, background: '#378ADD', color: '#fff', fontWeight: 700, fontSize: 15, textDecoration: 'none', marginBottom: 12 }}>
            💳 Pay Now
          </a>
        )}

        {/* Contact the shop */}
        {tenant?.contact_number ? (
          <div style={{ background: '#EAF3DE', borderRadius: 10, padding: '14px 16px', marginBottom: 14, border: '1px solid #C3E6CB' }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#1D6A3B', marginBottom: 4 }}>
              📞 Need help? Contact us
            </div>
            <div style={{ fontSize: 13, color: '#374151', marginBottom: 10 }}>
              For questions or updates about your order, SMS or call us:
            </div>
            <a href={`tel:${tenant.contact_number}`}
              style={{ display: 'block', textAlign: 'center', padding: '11px', borderRadius: 9, background: '#22C55E', color: '#fff', fontWeight: 700, fontSize: 15, textDecoration: 'none', marginBottom: 8 }}>
              📲 {tenant.contact_number}
            </a>
            <a href={`sms:${tenant.contact_number}`}
              style={{ display: 'block', textAlign: 'center', padding: '11px', borderRadius: 9, background: '#fff', color: '#22C55E', fontWeight: 700, fontSize: 14, textDecoration: 'none', border: '2px solid #22C55E' }}>
              💬 Send SMS
            </a>
          </div>
        ) : (
          <div style={{ background: '#EAF3DE', borderRadius: 10, padding: '12px 16px', color: '#3B6D11', fontSize: 13, textAlign: 'center', marginBottom: 14 }}>
            ✅ We'll contact you shortly with further details.
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={closeMiniApp}
            style={{ flex: 1, padding: 12, borderRadius: 10, border: '1.5px solid #E2E8F0', background: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', color: '#374151', fontFamily: 'inherit' }}>
            ✕ Close
          </button>
          <button onClick={() => { setStep(1); setSelectedSvc(null); setFieldValues({}); setWeight(''); setAddonQty({}); setForm({ name: '', phone: '', email: '', addr_unit: '', addr_street: '', addr_barangay: '', addr_city: '', pickup_date: '', delivery_zone_id: '', notes: '' }); setSavedCustomer(null); setAddressMode('new'); setResult(null); setPrivacyConsent(false); }}
            style={{ flex: 1, padding: 12, borderRadius: 10, border: '1.5px solid #E2E8F0', background: '#fff', fontSize: 14, fontWeight: 500, cursor: 'pointer', color: '#374151', fontFamily: 'inherit' }}>
            + New Order
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #E6F1FB 0%, #F7F7F5 60%)', padding: '2rem 1rem', fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif" }}>
      {/* ── Header ── */}
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        {tenant?.logo_url && !tenant.logo_url.startsWith('data:') && (
          <img src={tenant.logo_url} alt={tenant.name} style={{ width: 52, height: 52, borderRadius: 14, objectFit: 'cover', marginBottom: 8, boxShadow: '0 2px 8px rgba(0,0,0,.12)' }} />
        )}
        <div style={{ fontWeight: 700, fontSize: 20, color: '#111827' }}>{tenant?.name}</div>
        <div style={{ fontSize: 13, color: '#374151', marginTop: 3 }}>Online Booking</div>
      </div>

      {/* ── Progress bar ── */}
      <div style={{ maxWidth: 620, margin: '0 auto 20px', display: 'flex', alignItems: 'center', gap: 0 }}>
        {[{ n: 1, label: 'Service' }, { n: 2, label: 'Details' }, { n: 3, label: 'Review' }].map(({ n, label }, i) => (
          <div key={n} style={{ display: 'flex', alignItems: 'center', flex: i < 2 ? 1 : 'none' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: step > n ? 'pointer' : 'default' }}
              onClick={() => { if (step > n) setStep(n); }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 700, fontSize: 13,
                background: step > n ? '#378ADD' : step === n ? '#378ADD' : '#E2E8F0',
                color: step >= n ? '#fff' : '#374151',
                transition: 'all .2s',
              }}>
                {step > n ? '✓' : n}
              </div>
              <div style={{ fontSize: 10, fontWeight: 600, marginTop: 4, color: step >= n ? '#378ADD' : '#374151', textTransform: 'uppercase', letterSpacing: '.05em' }}>{label}</div>
            </div>
            {i < 2 && <div style={{ flex: 1, height: 2, background: step > n ? '#378ADD' : '#E2E8F0', margin: '0 6px 16px', transition: 'all .2s' }} />}
          </div>
        ))}
      </div>

      <div style={cardStyle}>

        {/* ════════════ STEP 1 – SELECT SERVICE ════════════ */}
        {step === 1 && (
          <div>
            <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 4 }}>Choose a Service</div>
            <div style={{ fontSize: 13, color: '#374151', marginBottom: 20 }}>Select the laundry service you need.</div>

            {/* Category tabs */}
            {categories.length > 0 && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
                <button onClick={() => setActiveCat(null)}
                  style={{ padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                    background: activeCat === null ? '#378ADD' : '#F0F0EC', color: activeCat === null ? '#fff' : '#374151', border: 'none' }}>
                  All
                </button>
                {categories.map(c => (
                  <button key={c.id} onClick={() => setActiveCat(c.id)}
                    style={{ padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                      background: activeCat === c.id ? '#378ADD' : '#F0F0EC', color: activeCat === c.id ? '#fff' : '#374151', border: 'none' }}>
                    {c.name}
                  </button>
                ))}
              </div>
            )}

            {/* Service cards */}
            {visibleServices.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#374151', fontSize: 13 }}>No services available in this category.</div>
            ) : (
              <div style={{ display: 'grid', gap: 10 }}>
                {visibleServices.map(svc => {
                  const selected = selectedSvc?.id === svc.id;
                  return (
                    <div key={svc.id} onClick={() => { setSelectedSvc(svc); setFieldValues({}); setWeight(''); setAddonQty({}); }}
                      style={{
                        padding: '14px 16px', borderRadius: 12, cursor: 'pointer',
                        border: selected ? '2px solid #378ADD' : '1.5px solid #E2E8F0',
                        background: selected ? '#F0F8FF' : '#fff',
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
                        {svc.category_name && !activeCat && (
                          <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 10, background: '#E6F1FB', color: '#185FA5', fontWeight: 600, marginTop: 5, display: 'inline-block' }}>
                            {svc.category_name}
                          </span>
                        )}
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 15, color: '#378ADD' }}>₱{Number(svc.price).toLocaleString()}</div>
                        <div style={{ fontSize: 11, color: '#374151' }}>{svc.unit || 'flat'}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Custom fields / weight for selected service */}
            {selectedSvc && (
              <div style={{ marginTop: 20, padding: '16px', background: '#F7F9FD', borderRadius: 12, border: '1.5px solid #E6F1FB' }}>
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 14, color: '#185FA5' }}>
                  📝 Service Details — {selectedSvc.name}
                </div>

                {/* Weight field for per-kg services */}
                {isPerKg && (
                  <Field label="Estimated Weight (kg)" required>
                    <input
                      style={INPUT} type="number" min="0.1" step="0.1"
                      value={weight} onChange={e => setWeight(e.target.value)}
                      placeholder="e.g. 5"
                      onFocus={e => { e.target.style.borderColor = '#378ADD'; e.target.style.boxShadow = '0 0 0 3px rgba(55,138,221,.15)'; }}
                      onBlur={e => { e.target.style.borderColor = '#E2E8F0'; e.target.style.boxShadow = 'none'; }}
                    />
                  </Field>
                )}

                {/* Other custom fields */}
                {(selectedSvc.custom_fields || []).filter(f => !f.label?.toLowerCase().includes('weight') || !isPerKg).map(f => {
                  // Add-on field: stepper UI
                  if (f.field_type === 'addon') {
                    const aqty = addonQty[f.id] || 0;
                    const lineTotal = Number(f.unit_price || 0) * aqty;
                    return (
                      <div key={f.id} style={{ marginBottom: 14, background: '#fff', border: '1.5px solid #E2E8F0', borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: 13, color: '#111827' }}>{f.label}</div>
                          <div style={{ fontSize: 12, color: '#378ADD', fontWeight: 600, marginTop: 1 }}>+₱{Number(f.unit_price || 0).toLocaleString()} each</div>
                          {f.placeholder && <div style={{ fontSize: 11, color: '#374151', marginTop: 1 }}>{f.placeholder}</div>}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
                          <button type="button"
                            onClick={() => setAddonQty(p => ({ ...p, [f.id]: Math.max(0, (p[f.id] || 0) - 1) }))}
                            style={{ width: 32, height: 32, borderRadius: '8px 0 0 8px', border: '1.5px solid #E2E8F0', background: '#F7F9FD', fontSize: 16, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#374151' }}>−</button>
                          <div style={{ width: 40, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1.5px solid #E2E8F0', borderLeft: 'none', borderRight: 'none', fontSize: 14, fontWeight: 700, background: aqty > 0 ? '#E6F1FB' : '#fff', color: aqty > 0 ? '#185FA5' : '#374151' }}>{aqty}</div>
                          <button type="button"
                            onClick={() => setAddonQty(p => ({ ...p, [f.id]: (p[f.id] || 0) + 1 }))}
                            style={{ width: 32, height: 32, borderRadius: '0 8px 8px 0', border: '1.5px solid #378ADD', background: '#378ADD', fontSize: 16, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>+</button>
                        </div>
                        {lineTotal > 0 && <div style={{ fontSize: 13, fontWeight: 700, color: '#185FA5', minWidth: 60, textAlign: 'right' }}>₱{lineTotal.toLocaleString()}</div>}
                      </div>
                    );
                  }
                  // Variation select: e-commerce button group
                  if (f.field_type === 'select') {
                    const opts = normalizeOpts(f.options);
                    const selectedVal = fieldValues[f.id];
                    return (
                      <div key={f.id} style={{ marginBottom: 16 }}>
                        <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 8 }}>
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
                                  border: isSel ? '2px solid #378ADD' : '1.5px solid #E2E8F0',
                                  background: isSel ? '#E6F1FB' : '#fff',
                                  color: isSel ? '#185FA5' : '#374151',
                                  fontSize: 13, fontWeight: isSel ? 700 : 500,
                                  transition: 'all .15s', textAlign: 'center', minWidth: 80,
                                }}>
                                <div>{opt.label}</div>
                                {(opt.price_type === 'copy_base' || opt.price > 0) && (
                                  <div style={{ fontSize: 11, color: isSel ? '#378ADD' : '#7C3AED', marginTop: 2, fontWeight: 600 }}>
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
                  // Regular fields (text, number, textarea)
                  return (
                    <Field key={f.id} label={f.label + (f.field_type === 'number' && !isPerKg ? ' (× price)' : '')} required={f.required}>
                      {f.field_type === 'textarea' ? (
                        <textarea
                          style={{ ...INPUT, resize: 'vertical', minHeight: 80 }}
                          value={fieldValues[f.id] || ''}
                          onChange={e => setFieldValues(p => ({ ...p, [f.id]: e.target.value }))}
                          placeholder={f.placeholder || 'Enter your notes here…'}
                          onFocus={e => { e.target.style.borderColor = '#378ADD'; e.target.style.boxShadow = '0 0 0 3px rgba(55,138,221,.15)'; }}
                          onBlur={e => { e.target.style.borderColor = '#E2E8F0'; e.target.style.boxShadow = 'none'; }}
                        />
                      ) : (
                        <input style={INPUT}
                          type={f.field_type === 'number' ? 'number' : 'text'}
                          min={f.field_type === 'number' && f.min_value != null ? f.min_value : undefined}
                          max={f.field_type === 'number' && f.max_value != null ? f.max_value : undefined}
                          value={fieldValues[f.id] || ''}
                          onChange={e => setFieldValues(p => ({ ...p, [f.id]: e.target.value }))}
                          placeholder={f.placeholder || ''}
                          onFocus={e => { e.target.style.borderColor = '#378ADD'; e.target.style.boxShadow = '0 0 0 3px rgba(55,138,221,.15)'; }}
                          onBlur={e => { e.target.style.borderColor = '#E2E8F0'; e.target.style.boxShadow = 'none'; }}
                        />
                      )}
                    </Field>
                  );
                })}

                {/* Live price breakdown */}
                {selectedSvc && (subtotal > 0 || addonTotal > 0) && (
                  <div style={{ marginTop: 12, background: '#EEF6FF', borderRadius: 10, padding: '10px 14px', border: '1px solid #BDD8F7' }}>
                    {baseSubtotal > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#185FA5', marginBottom: 4 }}>
                        <span>{selectedSvc.name}{isPerKg && w > 0 ? ` (${w} kg)` : qty > 0 ? ` × ${qty}` : ''}</span>
                        <span style={{ fontWeight: 600 }}>₱{baseSubtotal.toLocaleString()}</span>
                      </div>
                    )}
                    {selectFields.map(f => {
                      const sel = normalizeOpts(f.options).find(o => o.label === fieldValues[f.id]);
                      if (!sel) return null;
                      const resolvedPrice = (sel.price_type || 'fixed') === 'copy_base' ? baseVariationPrice : Number(sel.price || 0);
                      return (
                        <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#374151', marginBottom: 4 }}>
                          <span>{f.label}: <strong>{sel.label}</strong></span>
                          <span style={{ fontWeight: 600 }}>{resolvedPrice > 0 ? `₱${resolvedPrice.toLocaleString()}` : '—'}</span>
                        </div>
                      );
                    })}
                    {addonFields.filter(f => (addonQty[f.id] || 0) > 0).map(f => (
                      <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#374151', marginBottom: 4 }}>
                        <span>{f.label} × {addonQty[f.id]}</span>
                        <span style={{ fontWeight: 600 }}>₱{(Number(f.unit_price || 0) * addonQty[f.id]).toLocaleString()}</span>
                      </div>
                    ))}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 700, color: '#185FA5', borderTop: '1px solid #BDD8F7', paddingTop: 6, marginTop: 2 }}>
                      <span>Subtotal</span>
                      <span>₱{(subtotal + addonTotal).toLocaleString()}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            <button onClick={() => setStep(2)} disabled={!step1Valid()}
              style={{ width: '100%', marginTop: 20, padding: 13, borderRadius: 10, border: 'none', fontSize: 14, fontWeight: 700, cursor: step1Valid() ? 'pointer' : 'not-allowed', fontFamily: 'inherit',
                background: step1Valid() ? '#378ADD' : '#E2E8F0', color: step1Valid() ? '#fff' : '#374151', transition: 'all .15s' }}>
              Continue to Details →
            </button>
          </div>
        )}

        {/* ════════════ STEP 2 – CUSTOMER DETAILS ════════════ */}
        {step === 2 && (
          <div>
            <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 4 }}>Your Details</div>
            <div style={{ fontSize: 13, color: '#374151', marginBottom: 20 }}>Tell us how to reach you and where to pick up.</div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 14px' }}>
              <Field label="Full Name" required>
                <input style={INPUT} value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="Maria Santos"
                  onFocus={e => { e.target.style.borderColor = '#378ADD'; e.target.style.boxShadow = '0 0 0 3px rgba(55,138,221,.15)'; }}
                  onBlur={e => { e.target.style.borderColor = '#E2E8F0'; e.target.style.boxShadow = 'none'; }}
                />
              </Field>
              <Field label="Phone Number" required>
                <input style={INPUT} type="tel" value={form.phone}
                  onChange={e => {
                    const val = e.target.value;
                    setForm(p => ({ ...p, phone: val }));
                    setSavedCustomer(null); setAddressMode('new');
                    clearTimeout(phoneDebounce.current);
                    if (val.trim().length >= 10) {
                      phoneDebounce.current = setTimeout(async () => {
                        setLookingUp(true);
                        try {
                          const { data } = await lookupPublicCustomer(tenantId, val.trim());
                          if (data) {
                            setSavedCustomer(data);
                            setAddressMode('saved');
                            setForm(p => ({
                              ...p,
                              name:  p.name  || data.name  || '',
                              email: p.email || data.email || '',
                            }));
                          }
                        } catch (_) {}
                        setLookingUp(false);
                      }, 600);
                    }
                  }}
                  placeholder="09XX XXX XXXX"
                  onFocus={e => { e.target.style.borderColor = '#378ADD'; e.target.style.boxShadow = '0 0 0 3px rgba(55,138,221,.15)'; }}
                  onBlur={e => { e.target.style.borderColor = '#E2E8F0'; e.target.style.boxShadow = 'none'; }}
                />
                {lookingUp && <div style={{ fontSize: 11, color: '#378ADD', marginTop: 4 }}>🔍 Checking for saved address…</div>}
              </Field>
            </div>

            <Field label="Email Address">
              <input style={INPUT} type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                placeholder="maria@gmail.com (for receipt)"
                onFocus={e => { e.target.style.borderColor = '#378ADD'; e.target.style.boxShadow = '0 0 0 3px rgba(55,138,221,.15)'; }}
                onBlur={e => { e.target.style.borderColor = '#E2E8F0'; e.target.style.boxShadow = 'none'; }}
              />
            </Field>

            <div style={{ marginBottom: 6 }}>
              <label style={{ ...LABEL, marginBottom: 10 }}>Pickup Address <span style={{ color: '#E53E3E', marginLeft: 2 }}>*</span></label>

              {/* Repeat customer — saved address banner */}
              {savedCustomer && (
                <div style={{ marginBottom: 10, borderRadius: 10, border: '1.5px solid #BDD8F7', background: '#EEF6FF', overflow: 'hidden' }}>
                  <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <div style={{ fontSize: 20, marginTop: 1 }}>👋</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 13, color: '#185FA5' }}>Welcome back, {savedCustomer.name}!</div>
                      <div style={{ fontSize: 12, color: '#374151', marginTop: 2 }}>We found your saved address:</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#111827', marginTop: 4, padding: '6px 10px', background: '#fff', borderRadius: 7, border: '1px solid #BDD8F7' }}>
                        📍 {savedCustomer.address}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderTop: '1px solid #BDD8F7' }}>
                    <button type="button"
                      onClick={() => setAddressMode('saved')}
                      style={{ padding: '10px', fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                        background: addressMode === 'saved' ? '#378ADD' : '#F0F7FF',
                        color: addressMode === 'saved' ? '#fff' : '#185FA5',
                        borderRight: '1px solid #BDD8F7' }}>
                      ✓ Use this address
                    </button>
                    <button type="button"
                      onClick={() => setAddressMode('new')}
                      style={{ padding: '10px', fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                        background: addressMode === 'new' ? '#378ADD' : '#F0F7FF',
                        color: addressMode === 'new' ? '#fff' : '#185FA5' }}>
                      + Enter new address
                    </button>
                  </div>
                </div>
              )}

              {/* New address fields — shown when no saved customer OR user chose "Enter new" */}
              {addressMode === 'new' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <input style={INPUT} value={form.addr_unit} required
                    onChange={e => setForm(p => ({ ...p, addr_unit: e.target.value }))}
                    placeholder="Building Name / Condo / Hotel / House No. *"
                    onFocus={e => { e.target.style.borderColor = '#378ADD'; e.target.style.boxShadow = '0 0 0 3px rgba(55,138,221,.15)'; }}
                    onBlur={e => { e.target.style.borderColor = '#E2E8F0'; e.target.style.boxShadow = 'none'; }}
                  />
                  <input style={INPUT} value={form.addr_street} required
                    onChange={e => setForm(p => ({ ...p, addr_street: e.target.value }))}
                    placeholder="Street Name *"
                    onFocus={e => { e.target.style.borderColor = '#378ADD'; e.target.style.boxShadow = '0 0 0 3px rgba(55,138,221,.15)'; }}
                    onBlur={e => { e.target.style.borderColor = '#E2E8F0'; e.target.style.boxShadow = 'none'; }}
                  />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <input style={INPUT} value={form.addr_barangay} required
                      onChange={e => setForm(p => ({ ...p, addr_barangay: e.target.value }))}
                      placeholder="Barangay *"
                      onFocus={e => { e.target.style.borderColor = '#378ADD'; e.target.style.boxShadow = '0 0 0 3px rgba(55,138,221,.15)'; }}
                      onBlur={e => { e.target.style.borderColor = '#E2E8F0'; e.target.style.boxShadow = 'none'; }}
                    />
                    <input style={INPUT} value={form.addr_city} required
                      onChange={e => setForm(p => ({ ...p, addr_city: e.target.value }))}
                      placeholder="City *"
                      onFocus={e => { e.target.style.borderColor = '#378ADD'; e.target.style.boxShadow = '0 0 0 3px rgba(55,138,221,.15)'; }}
                      onBlur={e => { e.target.style.borderColor = '#E2E8F0'; e.target.style.boxShadow = 'none'; }}
                    />
                  </div>
                </div>
              )}
            </div>

            <Field label="Pick-up / Delivery Zone" required={false} style={{ marginTop: 16 }}>
              <select style={INPUT} value={form.delivery_zone_id}
                onChange={e => setForm(p => ({ ...p, delivery_zone_id: e.target.value }))}>
                <option value="">{zones.length > 0 ? '— Select your area —' : 'No delivery zones set up'}</option>
                {zones.map(z => (
                  <option key={z.id} value={z.id}>{z.name} — ₱{Number(z.fee).toLocaleString()} delivery fee</option>
                ))}
              </select>
              {form.delivery_zone_id && selectedZone && (
                <div style={{ marginTop: 6 }}>
                  <div style={{ fontSize: 12, color: '#185FA5', fontWeight: 600 }}>
                    +₱{Number(selectedZone.fee).toLocaleString()} delivery fee will be added
                  </div>
                  {selectedZone.custom_note && (
                    <div style={{ marginTop: 5, fontSize: 12, color: '#374151', background: '#F7F9FD', border: '1px solid #BDD8F7', borderRadius: 7, padding: '7px 10px', lineHeight: 1.5 }}>
                      ℹ️ {selectedZone.custom_note}
                    </div>
                  )}
                </div>
              )}
            </Field>

            <Field label="Preferred Pickup Date & Time" required>
              <input style={INPUT} type="datetime-local" value={form.pickup_date}
                onChange={e => setForm(p => ({ ...p, pickup_date: e.target.value }))}
                onFocus={e => { e.target.style.borderColor = '#378ADD'; e.target.style.boxShadow = '0 0 0 3px rgba(55,138,221,.15)'; }}
                onBlur={e => { e.target.style.borderColor = '#E2E8F0'; e.target.style.boxShadow = 'none'; }}
              />
            </Field>

            <Field label="Special Instructions">
              <textarea style={{ ...INPUT, resize: 'vertical', minHeight: 70 }} value={form.notes}
                onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                placeholder="Any notes for us (fabric care, allergies, etc.)"
                onFocus={e => { e.target.style.borderColor = '#378ADD'; e.target.style.boxShadow = '0 0 0 3px rgba(55,138,221,.15)'; }}
                onBlur={e => { e.target.style.borderColor = '#E2E8F0'; e.target.style.boxShadow = 'none'; }}
              />
            </Field>

            {/* Price summary */}
            <div style={{ background: '#F7F9FD', borderRadius: 12, padding: '12px 16px', marginBottom: 16 }}>
              {baseSubtotal > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                  <span style={{ color: '#374151' }}>{selectedSvc?.name}{isPerKg && w > 0 ? ` (${w} kg)` : qty > 0 ? ` × ${qty}` : ''}</span>
                  <span style={{ fontWeight: 600 }}>₱{baseSubtotal.toLocaleString()}</span>
                </div>
              )}
              {selectFields.map(f => {
                const sel = normalizeOpts(f.options).find(o => o.label === fieldValues[f.id]);
                if (!sel) return null;
                const resolvedPrice = (sel.price_type || 'fixed') === 'copy_base' ? baseVariationPrice : Number(sel.price || 0);
                return (
                  <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                    <span style={{ color: '#374151' }}>{f.label}: <strong>{sel.label}</strong></span>
                    <span style={{ fontWeight: 600 }}>{resolvedPrice > 0 ? `₱${resolvedPrice.toLocaleString()}` : '—'}</span>
                  </div>
                );
              })}
              {addonFields.filter(f => (addonQty[f.id] || 0) > 0).map(f => (
                <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                  <span style={{ color: '#374151' }}>{f.label} × {addonQty[f.id]}</span>
                  <span style={{ fontWeight: 600 }}>₱{(Number(f.unit_price || 0) * addonQty[f.id]).toLocaleString()}</span>
                </div>
              ))}
              {deliveryFee > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                  <span style={{ color: '#374151' }}>Delivery — {selectedZone?.name}</span>
                  <span style={{ fontWeight: 600 }}>₱{deliveryFee.toLocaleString()}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, borderTop: '1px solid #E2E8F0', paddingTop: 8, marginTop: 4 }}>
                <span style={{ fontWeight: 700 }}>Total</span>
                <span style={{ fontWeight: 700, color: '#378ADD', fontSize: 16 }}>₱{total.toLocaleString()}</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setStep(1)}
                style={{ flex: 1, padding: 13, borderRadius: 10, border: '1.5px solid #E2E8F0', background: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', color: '#374151' }}>
                ← Back
              </button>
              <button onClick={() => setStep(3)} disabled={!step2Valid()}
                style={{ flex: 2, padding: 13, borderRadius: 10, border: 'none', fontSize: 14, fontWeight: 700, cursor: step2Valid() ? 'pointer' : 'not-allowed', fontFamily: 'inherit',
                  background: step2Valid() ? '#378ADD' : '#E2E8F0', color: step2Valid() ? '#fff' : '#374151', transition: 'all .15s' }}>
                Review Order →
              </button>
            </div>
          </div>
        )}

        {/* ════════════ STEP 3 – REVIEW & CONFIRM ════════════ */}
        {step === 3 && (
          <div>
            <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 4 }}>Review Your Order</div>
            <div style={{ fontSize: 13, color: '#374151', marginBottom: 20 }}>Please confirm everything looks right.</div>

            <div style={{ background: '#F7F9FD', borderRadius: 14, padding: '16px', marginBottom: 20 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: '#185FA5', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '.05em' }}>Order Summary</div>

              {[
                ['Service', selectedSvc?.name],
                isPerKg && w > 0 ? ['Estimated Weight', `${w} kg`] : null,
                ['Pickup', form.pickup_date ? new Date(form.pickup_date).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' }) : '—'],
                ['Address', fullAddress],
                selectedZone ? ['Delivery Zone', selectedZone.name] : null,
              ].filter(Boolean).map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: 13, borderBottom: '1px solid #E8E8E0' }}>
                  <span style={{ color: '#374151', flexShrink: 0, marginRight: 12 }}>{k}</span>
                  <span style={{ fontWeight: 500, textAlign: 'right' }}>{v}</span>
                </div>
              ))}

              <div style={{ fontWeight: 700, fontSize: 13, color: '#185FA5', marginTop: 16, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '.05em' }}>Customer</div>
              {[
                ['Name', form.name],
                ['Phone', form.phone],
                form.email ? ['Email', form.email] : null,
                form.notes ? ['Notes', form.notes] : null,
              ].filter(Boolean).map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: 13, borderBottom: '1px solid #E8E8E0' }}>
                  <span style={{ color: '#374151', flexShrink: 0, marginRight: 12 }}>{k}</span>
                  <span style={{ fontWeight: 500, textAlign: 'right' }}>{v}</span>
                </div>
              ))}

              <div style={{ fontWeight: 700, fontSize: 13, color: '#185FA5', marginTop: 16, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '.05em' }}>Payment</div>
              {baseSubtotal > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: 13 }}>
                  <span style={{ color: '#374151' }}>{selectedSvc?.name}{isPerKg && w > 0 ? ` (${w} kg)` : qty > 0 ? ` × ${qty}` : ''}</span>
                  <span style={{ fontWeight: 500 }}>₱{baseSubtotal.toLocaleString()}</span>
                </div>
              )}
              {selectFields.map(f => {
                const sel = normalizeOpts(f.options).find(o => o.label === fieldValues[f.id]);
                if (!sel) return null;
                const resolvedPrice = (sel.price_type || 'fixed') === 'copy_base' ? baseVariationPrice : Number(sel.price || 0);
                return (
                  <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: 13 }}>
                    <span style={{ color: '#374151' }}>{f.label}: <strong>{sel.label}</strong></span>
                    <span style={{ fontWeight: 500 }}>{resolvedPrice > 0 ? `₱${resolvedPrice.toLocaleString()}` : '—'}</span>
                  </div>
                );
              })}
              {addonFields.filter(f => (addonQty[f.id] || 0) > 0).map(f => (
                <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: 13 }}>
                  <span style={{ color: '#374151' }}>{f.label} × {addonQty[f.id]}</span>
                  <span style={{ fontWeight: 500 }}>₱{(Number(f.unit_price || 0) * addonQty[f.id]).toLocaleString()}</span>
                </div>
              ))}
              {deliveryFee > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: 13 }}>
                  <span style={{ color: '#374151' }}>Delivery — {selectedZone?.name}</span>
                  <span style={{ fontWeight: 500 }}>₱{deliveryFee.toLocaleString()}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0 4px', borderTop: '2px solid #E2E8F0', marginTop: 6 }}>
                <span style={{ fontWeight: 700, fontSize: 15 }}>Total</span>
                <span style={{ fontWeight: 700, fontSize: 18, color: '#378ADD' }}>₱{total.toLocaleString()}</span>
              </div>
            </div>

            {submitErr && (
              <div style={{ marginBottom: 14, padding: '10px 14px', borderRadius: 8, background: '#FCEBEB', color: '#A32D2D', fontSize: 13 }}>
                {submitErr}
              </div>
            )}

            {/* Privacy consent */}
            <div style={{ marginBottom: 16, padding: '14px 16px', borderRadius: 10, border: `1.5px solid ${privacyConsent ? '#378ADD' : '#E2E8F0'}`, background: privacyConsent ? '#F0F8FF' : '#FAFAFA', display: 'flex', gap: 12, alignItems: 'flex-start', cursor: 'pointer' }}
              onClick={() => setPrivacyConsent(p => !p)}>
              <div style={{ flexShrink: 0, width: 20, height: 20, borderRadius: 5, border: `2px solid ${privacyConsent ? '#378ADD' : '#CBD5E0'}`, background: privacyConsent ? '#378ADD' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 1, transition: 'all .15s' }}>
                {privacyConsent && <span style={{ color: '#fff', fontSize: 12, fontWeight: 700, lineHeight: 1 }}>✓</span>}
              </div>
              <p style={{ margin: 0, fontSize: 12, color: '#374151', lineHeight: 1.6 }}>
                I voluntarily give my consent to <strong>{tenant?.name}</strong> to keep and process the information, and to use it only to provide the service and to collect payment. I acknowledge and agree that in doing so, any such data may be processed through third-party data processors such as, but not limited to, service providers. I give my consent thereto pursuant to the requirements of Republic Act No. 10173, or the "Data Privacy Act of 2012."
              </p>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setStep(2)}
                style={{ flex: 1, padding: 13, borderRadius: 10, border: '1.5px solid #E2E8F0', background: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', color: '#374151' }}>
                ← Back
              </button>
              <button onClick={handleSubmit} disabled={submitting || !privacyConsent}
                style={{ flex: 2, padding: 13, borderRadius: 10, border: 'none', fontSize: 14, fontWeight: 700, cursor: (submitting || !privacyConsent) ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                  background: submitting ? '#6B8EAD' : !privacyConsent ? '#E2E8F0' : '#378ADD', color: !privacyConsent ? '#374151' : '#fff', transition: 'all .15s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                {submitting
                  ? <><span style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid rgba(255,255,255,.3)', borderTopColor: '#fff', animation: 'spin .7s linear infinite', display: 'inline-block' }} /> Placing Order…</>
                  : '✅ Confirm & Place Order'}
              </button>
            </div>
          </div>
        )}

      </div>

      <div style={{ textAlign: 'center', marginTop: 24, fontSize: 12, color: '#374151' }}>
        Powered by <strong>LaundroBot</strong>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        * { box-sizing: border-box; }
        body { padding-bottom: env(safe-area-inset-bottom, 0); }
      `}</style>

      {/* Messenger Extensions SDK — enables requestCloseBrowser() inside Messenger webview */}
      <script dangerouslySetInnerHTML={{ __html: `
        (function(d, s, id) {
          var js, fjs = d.getElementsByTagName(s)[0];
          if (d.getElementById(id)) return;
          js = d.createElement(s); js.id = id;
          js.src = "//connect.facebook.net/en_US/messenger.Extensions.js";
          fjs.parentNode.insertBefore(js, fjs);
        }(document, 'script', 'messenger-extensions-jssdk'));
      `}} />
    </div>
  );
}
