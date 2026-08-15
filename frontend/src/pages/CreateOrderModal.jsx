import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { getServices, getCategories, getDeliveryZones, createPublicOrder, searchCustomers } from '../api.js';
import { Icon } from '../components/Icons.jsx';
import { useModalA11y } from '../hooks/useModalA11y.js';

const STATUSES = ['NEW ORDER', 'FOR PICK UP', 'PROCESSING', 'FOR DELIVERY', 'COMPLETED'];

function getStartsAt(svc) {
  if (Number(svc.price) > 0) return null;
  const prices = [];
  for (const f of (svc.custom_fields || [])) {
    if (f.field_type !== 'select') continue;
    for (const o of (Array.isArray(f.options) ? f.options : [])) {
      if (typeof o === 'object' && (o.price_type || 'fixed') !== 'copy_base' && Number(o.price || 0) > 0)
        prices.push(Number(o.price));
    }
  }
  return prices.length ? Math.min(...prices) : null;
}

function normalizeOpts(options) {
  if (!Array.isArray(options)) return [];
  return options.map(o => typeof o === 'object' && o !== null
    ? { price_type: 'fixed', ...o }
    : { label: String(o), price: 0, price_type: 'fixed' });
}

/** Calculate service subtotal + addonTotal for a configured cart item */
function calcItemPrice(svc, fieldValues, weight, addonQty) {
  if (!svc) return { subtotal: 0, addonTotal: 0 };
  const basePrice    = Number(svc.price);
  const selectFields = (svc.custom_fields || []).filter(f => f.field_type === 'select');
  const addonFields  = (svc.custom_fields || []).filter(f => f.field_type === 'addon');
  const firstNumFld  = (svc.custom_fields || []).find(f => f.field_type === 'number' || f.field_type === 'weight');
  const qty          = firstNumFld ? parseFloat(fieldValues[firstNumFld.id] || weight || 0) : 0;

  const hasVarPricing = selectFields.some(f =>
    normalizeOpts(f.options).some(o => Number(o.price || 0) > 0));

  const baseVarPrice = (() => {
    for (const f of selectFields) {
      const sel = normalizeOpts(f.options).find(o => o.label === fieldValues[f.id]);
      if (sel && sel.price_type !== 'copy_base' && Number(sel.price || 0) > 0) return Number(sel.price);
    }
    return 0;
  })();

  const varTotal = selectFields.reduce((sum, f) => {
    const sel = normalizeOpts(f.options).find(o => o.label === fieldValues[f.id]);
    if (!sel) return sum;
    return sum + (sel.price_type === 'copy_base' ? baseVarPrice : Number(sel.price || 0));
  }, 0);

  const baseSubtotal = qty > 0
    ? (hasVarPricing ? 0 : basePrice * qty)
    : (hasVarPricing ? 0 : basePrice);
  const subtotal  = hasVarPricing ? varTotal * (qty > 1 ? qty : 1) : baseSubtotal + varTotal;
  const addonTotal = addonFields.reduce((s, f) => s + Number(f.unit_price || 0) * (addonQty[f.id] || 0), 0);

  return { subtotal, addonTotal };
}

/** Build short variant summary for cart row, e.g. "Medium Bag · Express" */
function variantSummary(svc, fieldValues, weight) {
  const parts = [];
  for (const f of (svc.custom_fields || [])) {
    if (f.field_type === 'select' && fieldValues[f.id])  parts.push(fieldValues[f.id]);
    if ((f.field_type === 'number' || f.field_type === 'weight') && (fieldValues[f.id] || weight))
      parts.push(`${fieldValues[f.id] || weight} ${f.field_type === 'weight' ? 'kg' : (f.label || '')}`);
  }
  return parts.join(' · ');
}

const INP = {
  width: '100%', boxSizing: 'border-box', padding: '8px 12px', fontSize: 13,
  borderRadius: 8, border: '1px solid #D1D5DB', background: '#FAFAFA',
  fontFamily: 'inherit', color: '#0D1117', outline: 'none',
};
const LBL = { fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 };
const ROW = { marginBottom: 14 };

function Field({ label, required, children }) {
  return (
    <div style={ROW}>
      <label style={LBL}>{label}{required && <span style={{ color: '#E53E3E', marginLeft: 2 }}>*</span>}</label>
      {children}
    </div>
  );
}

export default function CreateOrderModal({ onClose, onCreated }) {
  const { user } = useAuth();
  const tenantId = user?.tenant_id;
  const modalRef = useModalA11y(onClose);

  const [loadingData, setLoadingData] = useState(true);
  const [services,    setServices]   = useState([]);
  const [categories,  setCategories] = useState([]);
  const [zones,       setZones]      = useState([]);

  // ── Current service being configured ──
  const [activeCat,   setActiveCat]   = useState(null);
  const [selectedSvc, setSelectedSvc] = useState(null);
  const [fieldValues, setFieldValues] = useState({});
  const [weight,      setWeight]      = useState('');
  const [addonQty,    setAddonQty]    = useState({});

  // ── Cart (committed items) ──
  const [cart, setCart] = useState([]); // [{ tempId, service, fieldValues, weight, addonQty, subtotal, addonTotal }]

  // ── Customer ──
  const [custName,  setCustName]  = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [custEmail, setCustEmail] = useState('');
  const [customerSuggestions, setCustomerSuggestions] = useState([]);
  const [showSuggestions,     setShowSuggestions]     = useState(false);
  const searchTimeout = useRef(null);

  function runCustomerSearch(val) {
    clearTimeout(searchTimeout.current);
    if (val.trim().length < 2) { setCustomerSuggestions([]); setShowSuggestions(false); return; }
    searchTimeout.current = setTimeout(async () => {
      try {
        const { data } = await searchCustomers(val.trim());
        setCustomerSuggestions(data);
        setShowSuggestions(data.length > 0);
      } catch { /* ignore */ }
    }, 250);
  }

  function pickCustomer(c) {
    setCustName(c.name);
    if (c.phone)   setCustPhone(c.phone);
    if (c.email)   setCustEmail(c.email);
    if (c.address) setAddress(c.address);
    setShowSuggestions(false);
    setCustomerSuggestions([]);
  }

  // ── Delivery ──
  const [selfPickup,        setSelfPickup]        = useState(false);
  const [address,           setAddress]           = useState('');
  const [zoneId,            setZoneId]            = useState('');
  const [customDeliveryFee, setCustomDeliveryFee] = useState('');

  // ── Schedule ──
  const [pickupDate, setPickupDate] = useState('');
  const [pickupTime, setPickupTime] = useState('');

  // ── Order settings ──
  const [initStatus, setInitStatus] = useState('NEW ORDER');
  const [paid,       setPaid]       = useState(false);
  const [notes,      setNotes]      = useState('');

  // ── UI ──
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState('');
  const [result,     setResult]     = useState(null);
  const [copied,     setCopied]     = useState(false);

  useEffect(() => {
    Promise.all([getServices(), getCategories(), getDeliveryZones()])
      .then(([s, c, z]) => {
        setServices(s.data);
        setCategories(c.data);
        setZones(z.data);
        if (c.data.length) {
          const machineWash = c.data.find(cat => cat.name?.toLowerCase().includes('machine wash'));
          setActiveCat((machineWash || c.data[0]).id);
        }
      })
      .finally(() => setLoadingData(false));
  }, []);

  // ── Current-selection price preview ──
  const { subtotal: curSubtotal, addonTotal: curAddonTotal } = calcItemPrice(selectedSvc, fieldValues, weight, addonQty);

  // ── Cart totals ──
  const cartServicesTotal = cart.reduce((s, item) => s + item.subtotal + item.addonTotal, 0);
  const selectedZone      = zones.find(z => z.id === Number(zoneId));
  const parsedCustomFee   = customDeliveryFee !== '' ? parseFloat(customDeliveryFee) || 0 : null;
  const deliveryFee       = selfPickup ? 0 : (parsedCustomFee != null ? parsedCustomFee : (selectedZone ? Number(selectedZone.fee) : 0));
  const grandTotal        = cartServicesTotal + deliveryFee;

  const visibleServices = activeCat ? services.filter(s => s.category_id === activeCat) : services;

  function resetPicker() {
    setSelectedSvc(null);
    setFieldValues({});
    setWeight('');
    setAddonQty({});
  }

  function handleAddToCart() {
    if (!selectedSvc) return;
    const { subtotal, addonTotal } = calcItemPrice(selectedSvc, fieldValues, weight, addonQty);
    setCart(prev => [...prev, {
      tempId:      crypto.randomUUID(),
      service:     selectedSvc,
      fieldValues: { ...fieldValues },
      weight,
      addonQty:    { ...addonQty },
      subtotal,
      addonTotal,
    }]);
    resetPicker();
  }

  function removeCartItem(tempId) {
    setCart(prev => prev.filter(item => item.tempId !== tempId));
  }

  function isValid() {
    if (!tenantId)                           return false;
    if (cart.length === 0)                   return false;
    if (!custName.trim() || !custPhone.trim()) return false;
    if (!selfPickup && !address.trim())      return false;
    if (!pickupDate)                         return false;
    return true;
  }

  async function handleSubmit() {
    if (!isValid() || submitting) return;
    setSubmitting(true); setError('');
    try {
      const cartPayload = cart.map(item => {
        const customFields = [];
        for (const f of (item.service.custom_fields || [])) {
          if (f.field_type === 'addon') {
            const aq = item.addonQty[f.id] || 0;
            if (aq > 0) customFields.push({ label: f.label, value: String(aq), unit_price: f.unit_price });
          } else if (f.field_type === 'weight') {
            if (item.weight) customFields.push({ label: f.label, value: String(item.weight) });
          } else if (item.fieldValues[f.id]) {
            customFields.push({ label: f.label, value: item.fieldValues[f.id] });
          }
        }
        // ensure weight number field is included
        const firstNumFld = (item.service.custom_fields || []).find(f => f.field_type === 'number');
        if (firstNumFld && item.fieldValues[firstNumFld.id] && !customFields.find(cf => cf.label === firstNumFld.label)) {
          customFields.push({ label: firstNumFld.label, value: String(item.fieldValues[firstNumFld.id]) });
        }
        return { service_id: item.service.id, custom_fields: customFields };
      });

      const pickupDatetime = pickupTime
        ? `${pickupDate}T${pickupTime}:00`
        : `${pickupDate}T08:00:00`;

      const selfNote     = selfPickup ? '[Self drop-off & pick-up]' : '';
      const combinedNotes = [selfNote, notes.trim()].filter(Boolean).join(' ');

      const { data } = await createPublicOrder(tenantId, {
        cart:                cartPayload,
        name:                custName.trim(),
        phone:               custPhone.trim(),
        email:               custEmail.trim() || undefined,
        address:             selfPickup ? 'Self drop-off & pick-up' : address.trim(),
        pickup_date:         pickupDatetime,
        delivery_zone_id:    (!selfPickup && zoneId) ? Number(zoneId) : undefined,
        custom_delivery_fee: (!selfPickup && parsedCustomFee != null) ? parsedCustomFee : undefined,
        notes:               combinedNotes || undefined,
        initial_status:      initStatus !== 'NEW ORDER' ? initStatus : undefined,
        paid:                paid || undefined,
        source:              'admin',
      });

      setResult(data);
      onCreated();
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to create order. Please check all fields.');
    }
    setSubmitting(false);
  }

  function copyLink() {
    navigator.clipboard.writeText(result.payment_url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  // ── Render ──
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div ref={modalRef} role="dialog" aria-modal="true" aria-label="New Order" tabIndex={-1}
        className="modal-card" style={{ width: 580, maxHeight: '92vh', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden', outline: 'none' }}>

        {/* Header */}
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '0.5px solid #E8E8E0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, display: 'flex', alignItems: 'center', gap: 7 }}>
              <Icon name="orders" size={16} color="#374151" />New Order
            </div>
            <div style={{ fontSize: 12, color: '#374151', marginTop: 2 }}>
              Create an order on behalf of a customer
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#6B7280', lineHeight: 1 }}>×</button>
        </div>

        {/* Body */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '1.25rem 1.5rem' }}>

          {!tenantId && (
            <div style={{ padding: '12px 16px', background: '#FEF3C7', borderRadius: 8, fontSize: 13, color: '#92400e', marginBottom: 16 }}>
              <Icon name="alert-triangle" size={13} color="#92400e" style={{ marginRight: 6, flexShrink: 0 }} />
              Super Admin accounts cannot create orders directly. Log in as a branch admin.
            </div>
          )}

          {loadingData ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#374151' }}>Loading services…</div>
          ) : result ? (

            /* ── SUCCESS STATE ── */
            <div style={{ textAlign: 'center', padding: '1rem 0' }}>
              <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'center' }}>
                <Icon name="check-circle" size={48} color="#16a34a" strokeWidth={1.5} />
              </div>
              <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 4 }}>Order Created!</div>
              <div style={{ fontSize: 13, color: '#374151', marginBottom: 16 }}>
                Booking ref: <strong>{result.booking_ref}</strong>
              </div>
              <div style={{ background: '#F7F9FD', borderRadius: 12, padding: '12px 16px', marginBottom: 16, textAlign: 'left' }}>
                {result.items?.map(item => (
                  <div key={item.order_id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 0' }}>
                    <span>{item.service_name}</span>
                    <span style={{ fontWeight: 600 }}>₱{Number(item.price).toLocaleString()}</span>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 700, borderTop: '1px solid #E2E8F0', marginTop: 8, paddingTop: 8 }}>
                  <span>Total</span>
                  <span style={{ color: '#38a9c2' }}>₱{Number(result.total).toLocaleString()}</span>
                </div>
              </div>

              {result.payment_url ? (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 8 }}>💳 Payment Link</div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', background: '#F0F7FF', border: '1px solid #9ED3DC', borderRadius: 8, padding: '10px 12px' }}>
                    <span style={{ flex: 1, fontSize: 11, color: '#1a7d94', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {result.payment_url}
                    </span>
                    <button onClick={copyLink}
                      style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 12px', borderRadius: 6, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 600,
                        background: copied ? '#1D9E75' : '#38a9c2', color: '#fff', transition: 'background .2s' }}>
                      {copied ? <><Icon name="check" size={12} color="#fff" /> Copied!</> : '📋 Copy'}
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 16, padding: '10px', background: '#F7F7F5', borderRadius: 8 }}>
                  💡 No payment link generated — Xendit is not configured for this branch.
                </div>
              )}

              <button onClick={onClose}
                style={{ width: '100%', padding: '11px', borderRadius: 10, border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                Done
              </button>
            </div>

          ) : (

            /* ── FORM ── */
            <>

              {/* ══ Section 1: Service Picker ══ */}
              <div style={{ marginBottom: 4 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 10 }}>
                  Add Service
                </div>

                {/* Category pills */}
                {categories.length > 1 && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                    {categories.map(c => (
                      <button key={c.id} type="button"
                        onClick={() => { setActiveCat(c.id); resetPicker(); }}
                        style={{ padding: '4px 12px', borderRadius: 20, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 500,
                          background: activeCat === c.id ? '#38a9c2' : '#F0F0EC',
                          color:      activeCat === c.id ? '#fff'    : '#374151' }}>
                        {c.name}
                      </button>
                    ))}
                  </div>
                )}

                {/* Service grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: selectedSvc ? 12 : 0 }}>
                  {visibleServices.map(svc => (
                    <button key={svc.id} type="button"
                      onClick={() => { setSelectedSvc(svc); setFieldValues({}); setWeight(''); setAddonQty({}); }}
                      style={{ padding: '10px 12px', borderRadius: 10, border: `2px solid ${selectedSvc?.id === svc.id ? '#38a9c2' : '#E2E8F0'}`,
                        background: selectedSvc?.id === svc.id ? '#E6F5F8' : '#FAFAFA',
                        cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', transition: 'all .15s' }}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: selectedSvc?.id === svc.id ? '#1a7d94' : '#111827' }}>
                        {svc.name}
                      </div>
                      <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>
                        {(() => { const sa = getStartsAt(svc); return sa != null ? `Starts at ₱${sa.toLocaleString()}` : `₱${Number(svc.price).toLocaleString()}${svc.unit ? ` / ${svc.unit}` : ''}`; })()}
                      </div>
                    </button>
                  ))}
                </div>

                {/* Custom fields + add button */}
                {selectedSvc && (
                  <div style={{ background: '#F7F9FD', borderRadius: 10, padding: '14px', marginBottom: 4 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: '#1a7d94', marginBottom: 10 }}>
                      {selectedSvc.name}
                    </div>

                    {(selectedSvc.custom_fields || []).map(f => {
                      if (f.field_type === 'number') return (
                        <Field key={f.id} label={f.label} required={f.required}>
                          <input type="number" min="0" step="1" style={INP}
                            value={fieldValues[f.id] || ''}
                            onChange={e => setFieldValues(p => ({ ...p, [f.id]: e.target.value }))}
                            placeholder={f.placeholder || ''} />
                        </Field>
                      );
                      if (f.field_type === 'weight') return (
                        <Field key={f.id} label={f.label} required={f.required}>
                          <input type="number" min="0" step="0.1" style={INP}
                            value={weight}
                            onChange={e => setWeight(e.target.value)}
                            placeholder="kg" />
                        </Field>
                      );
                      if (f.field_type === 'select') return (
                        <Field key={f.id} label={f.label} required={f.required}>
                          <select style={INP} value={fieldValues[f.id] || ''}
                            onChange={e => setFieldValues(p => ({ ...p, [f.id]: e.target.value }))}>
                            <option value="">— Select —</option>
                            {normalizeOpts(f.options).map(o => (
                              <option key={o.label} value={o.label}>
                                {o.label}{Number(o.price || 0) > 0 ? ` (+₱${Number(o.price).toLocaleString()})` : ''}
                              </option>
                            ))}
                          </select>
                        </Field>
                      );
                      if (f.field_type === 'addon') return (
                        <Field key={f.id} label={`${f.label} (+₱${Number(f.unit_price || 0).toLocaleString()} each)`}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <button type="button"
                              onClick={() => setAddonQty(p => ({ ...p, [f.id]: Math.max(0, (p[f.id] || 0) - 1) }))}
                              style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid #D1D5DB', background: '#fff', cursor: 'pointer', fontSize: 16, fontFamily: 'inherit' }}>−</button>
                            <span style={{ fontWeight: 600, fontSize: 14, minWidth: 24, textAlign: 'center' }}>{addonQty[f.id] || 0}</span>
                            <button type="button"
                              onClick={() => setAddonQty(p => ({ ...p, [f.id]: (p[f.id] || 0) + 1 }))}
                              style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid #D1D5DB', background: '#fff', cursor: 'pointer', fontSize: 16, fontFamily: 'inherit' }}>+</button>
                          </div>
                        </Field>
                      );
                      return null;
                    })}

                    {/* Price line + Add button */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                      <div style={{ fontSize: 13 }}>
                        <span style={{ color: '#6B7280' }}>Subtotal: </span>
                        <span style={{ fontWeight: 700, color: '#111' }}>
                          ₱{(curSubtotal + curAddonTotal).toLocaleString()}
                        </span>
                      </div>
                      <button type="button" onClick={handleAddToCart}
                        style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#38a9c2', color: '#fff',
                          fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                          display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 16, lineHeight: 1 }}>+</span> Add to Cart
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* ══ Cart ══ */}
              {cart.length > 0 && (
                <div style={{ margin: '12px 0 4px' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 8 }}>
                    Cart · {cart.length} {cart.length === 1 ? 'item' : 'items'}
                  </div>
                  <div style={{ border: '1px solid #E2E8F0', borderRadius: 10, overflow: 'hidden' }}>
                    {cart.map((item, idx) => {
                      const summary = variantSummary(item.service, item.fieldValues, item.weight);
                      const total   = item.subtotal + item.addonTotal;
                      return (
                        <div key={item.tempId}
                          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                            borderTop: idx > 0 ? '1px solid #F0F0EC' : 'none',
                            background: '#fff' }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 600, fontSize: 13, color: '#111827' }}>{item.service.name}</div>
                            {summary && (
                              <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {summary}
                              </div>
                            )}
                          </div>
                          <div style={{ fontWeight: 700, fontSize: 13, color: '#111827', flexShrink: 0 }}>
                            ₱{total.toLocaleString()}
                          </div>
                          <button type="button" onClick={() => removeCartItem(item.tempId)} aria-label="Remove item"
                            style={{ flexShrink: 0, width: 26, height: 26, borderRadius: 6, border: '1px solid #E2E8F0',
                              background: '#fff', cursor: 'pointer', color: '#6B7280', fontSize: 15, lineHeight: 1,
                              display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit' }}
                            title="Remove">×</button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {cart.length === 0 && !selectedSvc && (
                <div style={{ textAlign: 'center', padding: '10px 0 6px', fontSize: 12, color: '#6B7280' }}>
                  Select a service above to get started
                </div>
              )}

              <div style={{ height: 1, background: '#E8E8E0', margin: '14px 0' }} />

              {/* ══ Customer ══ */}
              <div style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 12 }}>
                Customer
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 14px' }}>
                <Field label="Full Name" required>
                  <div style={{ position: 'relative' }}>
                    <input style={INP} value={custName} autoComplete="off"
                      onChange={e => { setCustName(e.target.value); runCustomerSearch(e.target.value); }}
                      onFocus={() => { if (customerSuggestions.length > 0) setShowSuggestions(true); }}
                      onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                      placeholder="Maria Santos" />
                    {showSuggestions && (
                      <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100, background: '#fff', border: '1px solid #E2E8F0', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,.10)', marginTop: 2, overflow: 'hidden' }}>
                        {customerSuggestions.map(c => (
                          <div key={c.id} onMouseDown={() => pickCustomer(c)}
                            style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid #F3F4F6' }}
                            onMouseEnter={e => e.currentTarget.style.background = '#F0F9FF'}
                            onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
                            <div style={{ fontWeight: 600, fontSize: 13, color: '#111827' }}>{c.name}</div>
                            <div style={{ fontSize: 12, color: '#6B7280', marginTop: 1 }}>{c.phone}{c.email ? ` · ${c.email}` : ''}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </Field>
                <Field label="Phone Number" required>
                  <input style={INP} type="tel" value={custPhone} autoComplete="off"
                    onChange={e => { setCustPhone(e.target.value); runCustomerSearch(e.target.value); }}
                    onFocus={() => { if (customerSuggestions.length > 0) setShowSuggestions(true); }}
                    onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                    placeholder="09XX XXX XXXX" />
                </Field>
              </div>
              <Field label="Email Address">
                <input style={INP} type="email" value={custEmail} onChange={e => setCustEmail(e.target.value)} placeholder="Optional — for receipt" />
              </Field>

              <div style={{ height: 1, background: '#E8E8E0', margin: '4px 0 16px' }} />

              {/* ══ Delivery ══ */}
              <div style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 12 }}>
                Delivery
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={LBL}>Delivery Method <span style={{ color: '#E53E3E' }}>*</span></label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {[
                    { val: false, icon: '🚚', title: 'Pick-up & Delivery', sub: 'We collect from customer' },
                    { val: true,  icon: '🏪', title: 'Self Drop-off',       sub: 'Customer brings to shop' },
                  ].map(opt => (
                    <button key={String(opt.val)} type="button" onClick={() => setSelfPickup(opt.val)}
                      style={{ padding: '10px', borderRadius: 10, border: `2px solid ${selfPickup === opt.val ? '#38a9c2' : '#E2E8F0'}`,
                        background: selfPickup === opt.val ? '#E6F5F8' : '#FAFAFA',
                        cursor: 'pointer', fontFamily: 'inherit', textAlign: 'center', transition: 'all .15s' }}>
                      <div style={{ fontSize: 18, marginBottom: 3 }}>{opt.icon}</div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: selfPickup === opt.val ? '#1a7d94' : '#374151' }}>{opt.title}</div>
                      <div style={{ fontSize: 11, color: '#6B7280' }}>{opt.sub}</div>
                    </button>
                  ))}
                </div>
              </div>

              {!selfPickup && (
                <>
                  <Field label="Customer Address" required>
                    <textarea style={{ ...INP, resize: 'vertical', minHeight: 60 }} value={address}
                      onChange={e => setAddress(e.target.value)}
                      placeholder="House no., street, barangay, city…" />
                  </Field>
                  <div className="modal-2col" style={{ display: 'grid', gridTemplateColumns: zones.length > 0 ? '1fr 1fr' : '1fr', gap: '0 14px' }}>
                    {zones.length > 0 && (
                      <Field label="Delivery Zone">
                        <select style={INP} value={zoneId} onChange={e => { setZoneId(e.target.value); setCustomDeliveryFee(''); }}>
                          <option value="">— No zone —</option>
                          {zones.map(z => (
                            <option key={z.id} value={z.id}>{z.name} — ₱{Number(z.fee).toLocaleString()}</option>
                          ))}
                        </select>
                      </Field>
                    )}
                    <Field label={parsedCustomFee != null ? '✏️ Custom Delivery Fee (override)' : 'Custom Delivery Fee (optional override)'}>
                      <input
                        style={{ ...INP, borderColor: parsedCustomFee != null ? '#F59E0B' : '#D1D5DB', background: parsedCustomFee != null ? '#FFFBEB' : '#FAFAFA' }}
                        type="number" min="0" step="1"
                        value={customDeliveryFee}
                        onChange={e => { setCustomDeliveryFee(e.target.value); if (e.target.value !== '') setZoneId(''); }}
                        placeholder={selectedZone ? `Zone fee: ₱${Number(selectedZone.fee).toLocaleString()}` : '₱ amount'} />
                    </Field>
                  </div>
                </>
              )}

              <div className="modal-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 14px' }}>
                <Field label="Pickup Date" required>
                  <input style={INP} type="date" value={pickupDate} onChange={e => setPickupDate(e.target.value)} />
                </Field>
                <Field label="Pickup Time">
                  <input style={INP} type="time" value={pickupTime} onChange={e => setPickupTime(e.target.value)} />
                </Field>
              </div>

              <div style={{ height: 1, background: '#E8E8E0', margin: '4px 0 16px' }} />

              {/* ══ Order Settings ══ */}
              <div style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 12 }}>
                Settings
              </div>
              <div className="modal-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 14px' }}>
                <Field label="Initial Status">
                  <select style={INP} value={initStatus} onChange={e => setInitStatus(e.target.value)}>
                    {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </Field>
                <Field label="Payment">
                  <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', border: '1px solid #D1D5DB', borderRadius: 8, background: paid ? '#EAF3DE' : '#FAFAFA', cursor: 'pointer' }}>
                    <input type="checkbox" checked={paid} onChange={e => setPaid(e.target.checked)} />
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13, fontWeight: 600, color: paid ? '#3B6D11' : '#374151' }}>
                      {paid ? <><Icon name="check" size={13} color="#3B6D11" /> Mark as Paid</> : 'Mark as Paid'}
                    </span>
                  </label>
                </Field>
              </div>

              <Field label="Notes / Special Instructions">
                <textarea style={{ ...INP, resize: 'vertical', minHeight: 60 }} value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Any notes for this order…" />
              </Field>

              {/* ══ Total Summary ══ */}
              {cart.length > 0 && (
                <div style={{ background: '#F7F9FD', borderRadius: 10, padding: '12px 14px', marginBottom: 14, fontSize: 13 }}>
                  {cart.map(item => (
                    <div key={item.tempId} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ color: '#374151' }}>{item.service.name}</span>
                      <span style={{ fontWeight: 600 }}>₱{(item.subtotal + item.addonTotal).toLocaleString()}</span>
                    </div>
                  ))}
                  {deliveryFee > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ color: '#374151' }}>
                        Delivery{parsedCustomFee != null ? ' — Custom' : selectedZone ? ` — ${selectedZone.name}` : ''}
                        {parsedCustomFee != null && <span style={{ marginLeft: 6, fontSize: 11, background: '#FEF3C7', color: '#92400E', padding: '1px 6px', borderRadius: 4, fontWeight: 600 }}>override</span>}
                      </span>
                      <span>₱{deliveryFee.toLocaleString()}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #E2E8F0', paddingTop: 8, marginTop: 4, fontWeight: 700 }}>
                    <span>Estimated Total</span>
                    <span style={{ color: '#38a9c2', fontSize: 15 }}>₱{grandTotal.toLocaleString()}</span>
                  </div>
                  <div style={{ fontSize: 11, color: '#6B7280', marginTop: 4 }}>* Final price is confirmed by the server</div>
                </div>
              )}

              {error && (
                <div style={{ padding: '10px 14px', background: '#FCEBEB', color: '#A32D2D', borderRadius: 8, fontSize: 13, marginBottom: 14 }}>
                  {error}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {!result && (
          <div style={{ padding: '1rem 1.5rem', borderTop: '0.5px solid #E8E8E0', display: 'flex', gap: 10, flexShrink: 0 }}>
            <button onClick={onClose}
              style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1px solid #E2E8F0', background: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', color: '#374151' }}>
              Cancel
            </button>
            <button onClick={handleSubmit} disabled={!isValid() || submitting || !tenantId}
              style={{ flex: 2, padding: '10px', borderRadius: 10, border: 'none', fontSize: 14, fontWeight: 700, fontFamily: 'inherit',
                cursor: isValid() && !submitting && tenantId ? 'pointer' : 'not-allowed',
                background: isValid() && !submitting && tenantId ? '#38a9c2' : '#E2E8F0',
                color: isValid() && !submitting && tenantId ? '#fff' : '#374151',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'all .15s' }}>
              {submitting
                ? <><span style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid rgba(255,255,255,.3)', borderTopColor: '#fff', animation: 'spin .7s linear infinite', display: 'inline-block' }} /> Creating…</>
                : cart.length > 0
                  ? `Create Order (${cart.length} ${cart.length === 1 ? 'item' : 'items'})`
                  : 'Create Order'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
