import { useState, useEffect } from 'react';

function normalizeOpts(options) {
  if (!Array.isArray(options)) return [];
  return options.map(o => typeof o === 'object' && o !== null
    ? { price_type: 'fixed', ...o }
    : { label: String(o), price: 0, price_type: 'fixed' });
}

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

function Icon({ name, size = 16, color = 'currentColor', style: s = {} }) {
  const paths = {
    warning:   <><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></>,
    clipboard: <><rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/></>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color}
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      style={{ display: 'inline', verticalAlign: 'middle', flexShrink: 0, ...s }}>
      {paths[name]}
    </svg>
  );
}

export default function ServicePickerPanel({ services = [], categories = [], onAdd, buttonLabel = '+ Add to Cart' }) {
  const [activeCat, setActiveCat] = useState(() => categories[0]?.id ?? null);
  const [selectedSvc, setSelectedSvc] = useState(null);
  const [fieldValues, setFieldValues] = useState({});
  const [addonQty, setAddonQty] = useState({});
  const [addonOwn, setAddonOwn] = useState({});
  const [tried, setTried] = useState(false);

  // Auto-fill addon qty from piece count when sync_qty is enabled
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

  const selectFields = (selectedSvc?.custom_fields || []).filter(f => f.field_type === 'select');

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

  const price = selectedSvc ? Number(selectedSvc.price) : 0;
  const baseSubtotal = selectedSvc
    ? (qty > 0 ? (hasVariationPricing ? 0 : price * qty) : (hasVariationPricing ? 0 : price))
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
            const opts = normalizeOpts(f.options);
            const sel = opts.find(o => o.label === fieldValues[f.id]);
            if (!sel) return sum;
            return sum + ((sel.price_type || 'fixed') === 'copy_base' ? baseVariationPrice : Number(sel.price || 0));
          }, 0))
    : 0;

  function isAddonVisible(f) {
    if (!f.linked_to_field_label) return true;
    const linkedField = (selectedSvc?.custom_fields || []).find(sf => sf.field_type === 'select' && sf.label === f.linked_to_field_label);
    if (!linkedField) return true;
    return fieldValues[linkedField.id] === f.linked_to_value;
  }

  const allAddonFields = (selectedSvc?.custom_fields || []).filter(f => f.field_type === 'addon');
  const addonFields = allAddonFields.filter(isAddonVisible);
  const addonTotal = addonFields.reduce((s, f) => s + Number(f.unit_price || 0) * (addonQty[f.id] || 0), 0);
  const itemTotal = subtotal + addonTotal;

  function isValid() {
    if (!selectedSvc) return false;
    for (const f of (selectedSvc.custom_fields || [])) {
      if (f.field_type === 'addon') {
        if (f.required && isAddonVisible(f)) {
          if (!(addonQty[f.id] > 0) && !(f.allow_own && addonOwn[f.id])) return false;
        }
        continue;
      }
      if (f.required && !fieldValues[f.id]) return false;
    }
    return true;
  }

  function handleAdd() {
    if (!selectedSvc) return;
    if (!isValid()) { setTried(true); return; }

    const customFields = [];
    for (const f of (selectedSvc.custom_fields || [])) {
      if (f.field_type === 'addon') {
        if (!isAddonVisible(f)) continue;
        const aqty = addonQty[f.id] || 0;
        if (aqty > 0) customFields.push({ label: f.label, value: String(aqty), unit_price: f.unit_price });
        else if (f.allow_own && addonOwn[f.id]) customFields.push({ label: f.label, value: 'Customer provides own' });
      } else if (fieldValues[f.id] !== undefined && fieldValues[f.id] !== '') {
        customFields.push({ label: f.label, value: fieldValues[f.id] });
      }
    }

    const displayLines = [];
    if (!hasVariationPricing && baseSubtotal > 0) {
      displayLines.push({ label: `${selectedSvc.name}${qty > 0 ? ` × ${qty}` : ''}`, price: baseSubtotal });
    }
    selectFields.forEach(f => {
      const sel = normalizeOpts(f.options).find(o => o.label === fieldValues[f.id]);
      if (!sel) return;
      const rp = (sel.price_type || 'fixed') === 'copy_base' ? baseVariationPrice : Number(sel.price || 0);
      const scaled = qtyScaledIds.has(f.id);
      displayLines.push({ label: `${f.label}: ${sel.label}${scaled && qty > 1 ? ` × ${qty}` : ''}`, price: scaled ? rp * qty : rp });
    });
    addonFields.filter(f => (addonQty[f.id] || 0) > 0).forEach(f => {
      displayLines.push({ label: `${f.label} × ${addonQty[f.id]}`, price: Number(f.unit_price || 0) * addonQty[f.id] });
    });
    for (const f of (selectedSvc.custom_fields || [])) {
      if (f.field_type === 'addon' && isAddonVisible(f) && f.allow_own && addonOwn[f.id] && !(addonQty[f.id] > 0)) {
        displayLines.push({ label: `${f.label}: Customer provides own`, price: 0 });
      }
    }

    onAdd({
      service_id: selectedSvc.id,
      service_name: selectedSvc.name,
      price: itemTotal,
      custom_fields: customFields,
      displayLines,
      itemTotal,
    });

    setSelectedSvc(null);
    setFieldValues({});
    setAddonQty({});
    setAddonOwn({});
    setTried(false);
  }

  const visibleServices = activeCat ? services.filter(s => s.category_id === activeCat) : services;

  return (
    <div>
      {/* Category tabs */}
      {categories.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          <button onClick={() => setActiveCat(null)}
            style={{ padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              background: activeCat === null ? '#38a9c2' : '#F0F0EC', color: activeCat === null ? '#fff' : '#374151', border: 'none' }}>
            All
          </button>
          {categories.map(c => (
            <button key={c.id} onClick={() => setActiveCat(c.id)}
              style={{ padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                background: activeCat === c.id ? '#38a9c2' : '#F0F0EC', color: activeCat === c.id ? '#fff' : '#374151', border: 'none' }}>
              {c.name}
            </button>
          ))}
        </div>
      )}

      {/* Service cards */}
      <div style={{ display: 'grid', gap: 10, marginBottom: 16 }}>
        {visibleServices.filter(s => s.active !== false).map(svc => {
          const selected = selectedSvc?.id === svc.id;
          const startsAt = getStartsAt(svc);
          return (
            <div key={svc.id}
              onClick={() => { setSelectedSvc(svc); setFieldValues({}); setAddonQty({}); setAddonOwn({}); setTried(false); }}
              style={{
                padding: '12px 14px', borderRadius: 10, cursor: 'pointer',
                border: selected ? '2px solid #38a9c2' : '1.5px solid #E2E8F0',
                background: selected ? '#EBF8FA' : '#fff',
                transition: 'all .15s',
                display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10,
              }}>
              {svc.image_url && (
                <img src={svc.image_url} alt={svc.name}
                  style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'cover', flexShrink: 0, border: '1px solid #E2E8F0' }} />
              )}
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: '#111827' }}>{svc.name}</div>
                {svc.description && <div style={{ fontSize: 12, color: '#374151', marginTop: 2, lineHeight: 1.4 }}>{svc.description}</div>}
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                {startsAt != null ? (
                  <>
                    <div style={{ fontSize: 10, color: '#6B7280' }}>Starts at</div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: '#38a9c2' }}>₱{startsAt.toLocaleString()}</div>
                  </>
                ) : (
                  <div style={{ fontWeight: 700, fontSize: 14, color: '#38a9c2' }}>₱{Number(svc.price).toLocaleString()}</div>
                )}
                <div style={{ fontSize: 11, color: '#374151' }}>{svc.unit || 'flat'}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Custom fields panel */}
      {selectedSvc && (
        <div style={{ padding: '14px 16px', background: '#F7F9FD', borderRadius: 12, border: '1.5px solid #E2F5F8', marginBottom: 16 }}>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 14, color: '#1a7d94', display: 'flex', alignItems: 'center', gap: 5 }}>
            <Icon name="clipboard" size={13} color="#1a7d94" /> Service Details — {selectedSvc.name}
          </div>

          {(selectedSvc.custom_fields || []).map(f => {
            if (f.field_type === 'addon') {
              if (!isAddonVisible(f)) return null;
              const aqty = addonQty[f.id] || 0;
              const isOwn = !!(f.allow_own && addonOwn[f.id]);
              const lineTotal = Number(f.unit_price || 0) * aqty;
              const unsatisfied = tried && f.required && aqty === 0 && !isOwn;
              return (
                <div key={f.id} style={{ marginBottom: 14, background: '#fff', border: `1.5px solid ${unsatisfied ? '#F09595' : '#E2E8F0'}`, borderRadius: 10, padding: '10px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: '#111827' }}>
                        {f.label}{f.required && <span style={{ color: '#E53E3E', marginLeft: 4, fontSize: 11 }}>*</span>}
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
                          {isOwn && <span style={{ color: '#fff', fontSize: 11, fontWeight: 700 }}>✓</span>}
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

            if (f.field_type === 'select') {
              const opts = normalizeOpts(f.options);
              const selectedVal = fieldValues[f.id];
              const selectErr = tried && f.required && !selectedVal;
              return (
                <div key={f.id} style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 8 }}>
                    {f.label}{f.required && <span style={{ color: '#E53E3E', marginLeft: 2 }}>*</span>}
                  </label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, ...(selectErr ? { padding: 8, borderRadius: 8, border: '1.5px solid #F87171', background: '#FFF5F5' } : {}) }}>
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
                  {selectErr && (
                    <div style={{ marginTop: 5, fontSize: 11, color: '#A32D2D', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Icon name="warning" size={11} color="#A32D2D" /> Please select an option.
                    </div>
                  )}
                </div>
              );
            }

            // text / number / textarea
            const fieldErr = tried && f.required && !fieldValues[f.id];
            const inputStyle = {
              width: '100%', boxSizing: 'border-box', padding: '10px 12px', fontSize: 14,
              borderRadius: 8, border: `1.5px solid ${fieldErr ? '#F87171' : '#B8C4CE'}`,
              background: fieldErr ? '#FFF5F5' : '#F8FAFC', fontFamily: 'inherit', outline: 'none',
            };
            return (
              <div key={f.id} style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#1F2937', display: 'block', marginBottom: 6 }}>
                  {f.label}{f.field_type === 'number' ? ' (× price)' : ''}{f.required && <span style={{ color: '#E53E3E', marginLeft: 2 }}>*</span>}
                </label>
                {f.field_type === 'textarea' ? (
                  <textarea style={{ ...inputStyle, resize: 'vertical', minHeight: 80 }}
                    value={fieldValues[f.id] || ''}
                    onChange={e => setFieldValues(p => ({ ...p, [f.id]: e.target.value }))}
                    placeholder={f.placeholder || ''} />
                ) : (
                  <input style={inputStyle}
                    type={f.field_type === 'number' ? 'number' : 'text'}
                    min={f.field_type === 'number' && f.min_value != null ? f.min_value : undefined}
                    max={f.field_type === 'number' && f.max_value != null ? f.max_value : undefined}
                    value={fieldValues[f.id] || ''}
                    onChange={e => setFieldValues(p => ({ ...p, [f.id]: e.target.value }))}
                    placeholder={f.placeholder || ''} />
                )}
                {fieldErr && (
                  <div style={{ marginTop: 5, fontSize: 11, color: '#A32D2D', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Icon name="warning" size={11} color="#A32D2D" /> This field is required.
                  </div>
                )}
              </div>
            );
          })}

          {/* Live price breakdown */}
          {(subtotal > 0 || addonTotal > 0) && (
            <div style={{ marginTop: 12, background: '#E6F5F8', borderRadius: 10, padding: '10px 14px', border: '1px solid #9ED3DC' }}>
              {baseSubtotal > 0 && !hasVariationPricing && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#1a7d94', marginBottom: 4 }}>
                  <span>{selectedSvc.name}{qty > 0 ? ` × ${qty}` : ''}</span>
                  <span style={{ fontWeight: 600 }}>₱{baseSubtotal.toLocaleString()}</span>
                </div>
              )}
              {selectFields.map(f => {
                const sel = normalizeOpts(f.options).find(o => o.label === fieldValues[f.id]);
                if (!sel) return null;
                const resolvedPrice = (sel.price_type || 'fixed') === 'copy_base' ? baseVariationPrice : Number(sel.price || 0);
                const scaledByQty = qtyScaledIds.has(f.id);
                const displayPrice = scaledByQty ? resolvedPrice * qty : resolvedPrice;
                return (
                  <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#374151', marginBottom: 4 }}>
                    <span>{f.label}: <strong>{sel.label}</strong>{scaledByQty && qty > 1 ? ` × ${qty}` : ''}</span>
                    <span style={{ fontWeight: 600 }}>{displayPrice > 0 ? `₱${displayPrice.toLocaleString()}` : '—'}</span>
                  </div>
                );
              })}
              {addonFields.filter(f => (addonQty[f.id] || 0) > 0).map(f => (
                <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#374151', marginBottom: 4 }}>
                  <span>{f.label} × {addonQty[f.id]}</span>
                  <span style={{ fontWeight: 600 }}>₱{(Number(f.unit_price || 0) * addonQty[f.id]).toLocaleString()}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 700, color: '#1a7d94', borderTop: '1px solid #9ED3DC', paddingTop: 6, marginTop: 2 }}>
                <span>Subtotal</span>
                <span>₱{itemTotal.toLocaleString()}</span>
              </div>
            </div>
          )}
        </div>
      )}

      <button type="button" onClick={handleAdd} disabled={!selectedSvc}
        style={{
          width: '100%', padding: 13, borderRadius: 10, fontSize: 14, fontWeight: 700,
          cursor: selectedSvc ? 'pointer' : 'not-allowed', fontFamily: 'inherit',
          border: selectedSvc ? '2px solid #38a9c2' : '1.5px solid #E2E8F0',
          background: selectedSvc ? '#fff' : '#E2E8F0',
          color: selectedSvc ? '#38a9c2' : '#374151',
          transition: 'all .15s',
        }}>
        {buttonLabel}
      </button>
    </div>
  );
}
