import { useEffect, useState, useRef } from 'react';
import { getServices, createService, updateService, deleteService,
         getCategories, createCategory, updateCategory, deleteCategory } from '../api.js';

const emptyService  = { name: '', price: '', unit: 'per kg', description: '', active: true, image_url: '', category_id: '', sort_order: 0 };
const emptyCategory = { name: '', sort_order: 0, active: true };
const emptyField = { label: '', field_type: 'text', placeholder: '', required: false, allow_own: false, linked_to_field_label: '', linked_to_value: '', options: [], min_value: '', max_value: '', unit_price: '', _newOption: '', _newOptionPrice: '', _newOptionPriceType: 'fixed' };

const FIELD_TYPES = [
  { value: 'text',     label: 'Short text' },
  { value: 'textarea', label: 'Notes / Long text' },
  { value: 'number',   label: 'Number (qty multiplier)' },
  { value: 'select',   label: 'Variation (select one)' },
  { value: 'addon',    label: 'Add-on (with price)' },
];

export default function Services() {
  const [categories,  setCategories]  = useState([]);
  const [services,    setServices]    = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [svcForm,     setSvcForm]     = useState(null);
  const [catForm,     setCatForm]     = useState(null);
  const [saving,      setSaving]      = useState(false);
  const [preview,     setPreview]     = useState(null);
  const [fields,      setFields]      = useState([]);   // custom fields for open service
  const fileRef = useRef();

  useEffect(() => {
    Promise.all([getServices(), getCategories()])
      .then(([s, c]) => { setServices(s.data); setCategories(c.data); })
      .finally(() => setLoading(false));
  }, []);

  // ── Image upload ──────────────────────────────────────────────────────
  function handleImageChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      setPreview(ev.target.result);
      setSvcForm(p => ({ ...p, image_url: ev.target.result }));
    };
    reader.readAsDataURL(file);
  }

  // ── Open service modal ────────────────────────────────────────────────
  function openSvc(svc) {
    setSvcForm({ ...svc, isNew: false });
    setPreview(svc.image_url || null);
    setFields((svc.custom_fields || []).map(f => ({
      ...f,
      options:    Array.isArray(f.options) ? f.options.map(o => typeof o === 'object' && o !== null ? { price_type: 'fixed', ...o } : { label: String(o), price: 0, price_type: 'fixed' }) : [],
      min_value:  f.min_value ?? '',
      max_value:  f.max_value ?? '',
      unit_price: f.unit_price ?? '',
      _newOption: '',
      _newOptionPrice: '',
      _newOptionPriceType: 'fixed',
    })));
  }

  function openNewSvc(overrides = {}) {
    setSvcForm({ ...emptyService, isNew: true, ...overrides });
    setPreview(null);
    setFields([]);
  }

  // ── Custom fields helpers ─────────────────────────────────────────────
  function addField() {
    setFields(prev => [...prev, { ...emptyField, _key: Date.now() }]);
  }

  function updateField(idx, key, val) {
    setFields(prev => prev.map((f, i) => i === idx ? { ...f, [key]: val } : f));
  }

  function removeField(idx) {
    setFields(prev => prev.filter((_, i) => i !== idx));
  }

  function moveField(idx, dir) {
    setFields(prev => {
      const arr = [...prev];
      const target = idx + dir;
      if (target < 0 || target >= arr.length) return arr;
      [arr[idx], arr[target]] = [arr[target], arr[idx]];
      return arr;
    });
  }

  function addOption(fieldIdx) {
    setFields(prev => prev.map((f, i) => {
      if (i !== fieldIdx) return f;
      const label = (f._newOption || '').trim();
      if (!label) return { ...f, _newOption: '', _newOptionPrice: '', _newOptionPriceType: 'fixed' };
      const existingLabels = (f.options || []).map(o => typeof o === 'object' ? o.label : o);
      if (existingLabels.includes(label)) return { ...f, _newOption: '', _newOptionPrice: '', _newOptionPriceType: 'fixed' };
      const priceType = f._newOptionPriceType || 'fixed';
      const price = priceType === 'copy_base' ? 0 : (parseFloat(f._newOptionPrice) || 0);
      return { ...f, options: [...(f.options || []), { label, price, price_type: priceType }], _newOption: '', _newOptionPrice: '', _newOptionPriceType: 'fixed' };
    }));
  }

  function removeOption(fieldIdx, optIdx) {
    setFields(prev => prev.map((f, i) =>
      i === fieldIdx ? { ...f, options: (f.options || []).filter((_, oi) => oi !== optIdx) } : f
    ));
  }

  function startEditOption(fieldIdx, optIdx) {
    setFields(prev => prev.map((f, i) => {
      if (i !== fieldIdx) return f;
      const opt = f.options[optIdx];
      const label = typeof opt === 'object' ? opt.label : String(opt);
      const price = typeof opt === 'object' ? opt.price : 0;
      const price_type = typeof opt === 'object' ? (opt.price_type || 'fixed') : 'fixed';
      return { ...f, _editingOptIdx: optIdx, _editOptLabel: label, _editOptPrice: String(price), _editOptPriceType: price_type };
    }));
  }

  function saveEditOption(fieldIdx) {
    setFields(prev => prev.map((f, i) => {
      if (i !== fieldIdx) return f;
      const label = (f._editOptLabel || '').trim();
      if (!label) return f;
      const priceType = f._editOptPriceType || 'fixed';
      const price = priceType === 'copy_base' ? 0 : (parseFloat(f._editOptPrice) || 0);
      const newOptions = f.options.map((o, oi) =>
        oi === f._editingOptIdx ? { label, price, price_type: priceType } : o
      );
      return { ...f, options: newOptions, _editingOptIdx: undefined, _editOptLabel: '', _editOptPrice: '', _editOptPriceType: 'fixed' };
    }));
  }

  function cancelEditOption(fieldIdx) {
    setFields(prev => prev.map((f, i) =>
      i === fieldIdx ? { ...f, _editingOptIdx: undefined, _editOptLabel: '', _editOptPrice: '', _editOptPriceType: 'fixed' } : f
    ));
  }

  function duplicateSvc(svc) {
    setSvcForm({ ...svc, name: svc.name + ' (Copy)', isNew: true, id: undefined });
    setPreview(svc.image_url || null);
    setFields((svc.custom_fields || []).map(f => ({
      ...f,
      _key: Date.now() + Math.random(),
      options: Array.isArray(f.options) ? f.options.map(o => ({ ...o })) : [],
      _newOption: '', _newOptionPrice: '', _newOptionPriceType: 'fixed',
    })));
  }

  // ── Service save ──────────────────────────────────────────────────────
  async function handleSvcSave() {
    if (!svcForm.name || svcForm.price === '' || svcForm.price === null || svcForm.price === undefined) return alert('Name and price are required. Set 0 for variation-priced services.');
    // Validate custom fields
    for (const f of fields) {
      if (!f.label.trim()) return alert('All custom field labels must be filled in.');
    }
    setSaving(true);
    try {
      const payload = {
        ...svcForm,
        category_id: svcForm.category_id || null,
        custom_fields: fields.map((f, i) => ({ ...f, sort_order: i })),
      };
      if (svcForm.isNew) {
        const { data } = await createService(payload);
        setServices(prev => [...prev, data]);
      } else {
        const { data } = await updateService(svcForm.id, payload);
        setServices(prev => prev.map(s => s.id === svcForm.id ? data : s));
      }
      setSvcForm(null); setPreview(null); setFields([]);
    } catch (err) { alert('Error: ' + err.message); }
    finally { setSaving(false); }
  }

  async function handleSvcDelete(id) {
    if (!confirm('Delete this service?')) return;
    await deleteService(id);
    setServices(prev => prev.filter(s => s.id !== id));
    setSvcForm(null); setFields([]);
  }

  // ── Category save ─────────────────────────────────────────────────────
  async function handleCatSave() {
    if (!catForm.name) return alert('Category name is required.');
    setSaving(true);
    try {
      if (catForm.isNew) {
        const { data } = await createCategory(catForm);
        setCategories(prev => [...prev, data]);
      } else {
        const { data } = await updateCategory(catForm.id, catForm);
        setCategories(prev => prev.map(c => c.id === catForm.id ? data : c));
      }
      setCatForm(null);
    } catch (err) { alert('Error: ' + err.message); }
    finally { setSaving(false); }
  }

  async function handleCatDelete(id) {
    if (!confirm('Delete this category? Services in it will become uncategorized.')) return;
    await deleteCategory(id);
    setCategories(prev => prev.filter(c => c.id !== id));
    setServices(prev => prev.map(s => s.category_id === id ? { ...s, category_id: null, category_name: null } : s));
    setCatForm(null);
  }

  // ── Group services by category ────────────────────────────────────────
  const grouped = {};
  for (const s of services) {
    const key = s.category_id ? String(s.category_id) : '__none__';
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(s);
  }

  const sortedCats = [...categories].sort((a, b) => (a.sort_order - b.sort_order) || a.name.localeCompare(b.name));

  const sections = [
    ...sortedCats.map(c => ({ id: String(c.id), name: c.name, active: c.active, cat: c })),
    ...(grouped['__none__']?.length ? [{ id: '__none__', name: 'Uncategorized', active: true, cat: null }] : []),
  ];

  const S = {
    label:  { fontSize: 12, color: '#374151', display: 'block', marginBottom: 4 },
    input:  { width: '100%', boxSizing: 'border-box', padding: '7px 10px', fontSize: 13, borderRadius: 6, border: '0.5px solid #ccc', outline: 'none' },
    select: { width: '100%', boxSizing: 'border-box', padding: '7px 10px', fontSize: 13, borderRadius: 6, border: '0.5px solid #ccc', background: '#fff' },
    btn:    (bg, color) => ({ padding: '8px', fontSize: 13, borderRadius: 6, cursor: 'pointer', background: bg, color, border: 'none', fontWeight: 500, flex: 1 }),
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <h2 style={{ fontSize: 18, fontWeight: 500 }}>Services & Pricing</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => { setCatForm({ ...emptyCategory, isNew: true }); }}
            style={{ padding: '7px 14px', fontSize: 13, borderRadius: 6, cursor: 'pointer', background: '#f0f0ec', color: '#444', border: '0.5px solid #ccc', fontWeight: 500 }}>
            + Category
          </button>
          <button onClick={() => openNewSvc()}
            style={{ padding: '7px 14px', fontSize: 13, borderRadius: 6, cursor: 'pointer', background: '#378ADD', color: '#fff', border: 'none', fontWeight: 500 }}>
            + Service
          </button>
        </div>
      </div>

      {loading ? <div style={{ color: '#374151', fontSize: 14 }}>Loading...</div> : (

        sections.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#374151', fontSize: 14, padding: '3rem 0' }}>
            No services yet. Click <b>+ Category</b> to create a category, then <b>+ Service</b> to add services.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {sections.map(({ id, name, active, cat }) => {
              const svcList = grouped[id] || [];
              return (
                <div key={id}>
                  {/* Category header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: '#222' }}>{name}</span>
                      {!active && <span style={{ fontSize: 11, padding: '2px 6px', borderRadius: 4, background: '#f0f0ec', color: '#374151' }}>Hidden</span>}
                      <span style={{ fontSize: 12, color: '#374151' }}>({svcList.length} service{svcList.length !== 1 ? 's' : ''})</span>
                    </div>
                    {cat && (
                      <button onClick={() => setCatForm({ ...cat, isNew: false })}
                        style={{ fontSize: 11, padding: '3px 10px', borderRadius: 5, cursor: 'pointer', background: 'transparent', border: '0.5px solid #ddd', color: '#374151' }}>
                        Edit category
                      </button>
                    )}
                  </div>

                  {/* Services grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(210px,1fr))', gap: 10 }}>
                    {svcList.map(s => (
                      <div key={s.id} style={{ background: '#fff', border: '0.5px solid #e8e8e0', borderRadius: 10, overflow: 'hidden', opacity: s.active ? 1 : 0.55 }}>
                        {s.image_url
                          ? <img src={s.image_url} alt={s.name} style={{ width: '100%', height: 110, objectFit: 'cover' }} />
                          : <div style={{ width: '100%', height: 110, background: '#f5f5f3', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>🧺</div>
                        }
                        <div style={{ padding: '0.75rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 4 }}>
                            <div style={{ fontWeight: 500, fontSize: 13 }}>{s.name}</div>
                            {!s.active && <span style={{ fontSize: 10, padding: '2px 5px', borderRadius: 3, background: '#f0f0ec', color: '#374151' }}>Off</span>}
                          </div>
                          {(() => {
                            const hasVarPricing = (s.custom_fields || []).some(f =>
                              f.field_type === 'select' &&
                              Array.isArray(f.options) &&
                              f.options.some(o => Number(typeof o === 'object' ? o.price : 0) > 0)
                            );
                            return hasVarPricing
                              ? <div style={{ fontSize: 13, fontWeight: 600, color: '#185FA5', marginBottom: 2 }}>Prices vary by selection</div>
                              : <div style={{ fontSize: 18, fontWeight: 600, color: '#185FA5', marginBottom: 2 }}>₱{Number(s.price).toLocaleString()} <span style={{ fontSize: 11, fontWeight: 400, color: '#374151' }}>{s.unit}</span></div>;
                          })()}
                          {s.description && <div style={{ fontSize: 11, color: '#374151', marginBottom: 8 }}>{s.description}</div>}
                          {s.custom_fields?.length > 0 && (
                            <div style={{ fontSize: 11, color: '#374151', marginBottom: 8 }}>
                              {s.custom_fields.length} custom field{s.custom_fields.length !== 1 ? 's' : ''}
                            </div>
                          )}
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button onClick={() => openSvc(s)}
                              style={{ fontSize: 11, padding: '5px 10px', borderRadius: 5, cursor: 'pointer', background: 'transparent', border: '0.5px solid #ccc', color: '#374151', flex: 1 }}>
                              Edit
                            </button>
                            <button onClick={() => duplicateSvc(s)} title="Duplicate service"
                              style={{ fontSize: 11, padding: '5px 10px', borderRadius: 5, cursor: 'pointer', background: 'transparent', border: '0.5px solid #ccc', color: '#374151' }}>
                              ⎘
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}

                    {/* Add service to this category shortcut */}
                    <div
                      onClick={() => openNewSvc({ category_id: id === '__none__' ? '' : id })}
                      style={{ border: '1.5px dashed #111827', borderRadius: 10, minHeight: 140, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#111827', fontSize: 13, flexDirection: 'column', gap: 4 }}>
                      <span style={{ fontSize: 22 }}>+</span>
                      <span>Add service</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* ── Service Modal ──────────────────────────────────────────────── */}
      {svcForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: '1.5rem', width: 480, border: '0.5px solid #e8e8e0', maxHeight: '92vh', overflowY: 'auto' }}>
            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 16 }}>{svcForm.isNew ? 'Add service' : 'Edit service'}</div>

            {/* Image */}
            <div style={{ marginBottom: 14 }}>
              <label style={S.label}>Service image</label>
              <div onClick={() => fileRef.current.click()}
                style={{ width: '100%', height: 120, borderRadius: 8, border: '1px dashed #ccc', cursor: 'pointer', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f9f9f9' }}>
                {preview
                  ? <img src={preview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <div style={{ textAlign: 'center', color: '#374151' }}><div style={{ fontSize: 24, marginBottom: 4 }}>📷</div><div style={{ fontSize: 11 }}>Click to upload</div></div>}
              </div>
              <input ref={fileRef} type="file" accept="image/*" onChange={handleImageChange} style={{ display: 'none' }} />
              {preview && <button onClick={() => { setPreview(null); setSvcForm(p => ({ ...p, image_url: '' })); }}
                style={{ marginTop: 4, fontSize: 11, color: '#A32D2D', background: 'none', border: 'none', cursor: 'pointer' }}>Remove image</button>}
            </div>

            {/* Category */}
            <div style={{ marginBottom: 12 }}>
              <label style={S.label}>Category</label>
              <select value={svcForm.category_id || ''} onChange={e => setSvcForm(p => ({ ...p, category_id: e.target.value }))} style={S.select}>
                <option value="">— Uncategorized —</option>
                {sortedCats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            {/* Core fields */}
            {[['name','Service name','text'],['price','Price (₱)','number'],['unit','Unit (e.g. per kg, per piece)','text'],['description','Description (optional)','text']].map(([field, label, type]) => (
              <div key={field} style={{ marginBottom: 12 }}>
                <label style={S.label}>{label}</label>
                <input type={type} value={svcForm[field]} onChange={e => setSvcForm(p => ({ ...p, [field]: e.target.value }))} style={S.input} />
              </div>
            ))}

            {/* Sort order */}
            <div style={{ marginBottom: 12 }}>
              <label style={S.label}>Sort order (lower = first)</label>
              <input type="number" value={svcForm.sort_order} onChange={e => setSvcForm(p => ({ ...p, sort_order: +e.target.value }))} style={S.input} />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
              <input type="checkbox" id="svcActive" checked={svcForm.active} onChange={e => setSvcForm(p => ({ ...p, active: e.target.checked }))} />
              <label htmlFor="svcActive" style={{ fontSize: 13, cursor: 'pointer' }}>Active (visible to customers)</label>
            </div>

            {/* ── Custom Fields ──────────────────────────────────────── */}
            <div style={{ borderTop: '0.5px solid #eee', paddingTop: 16, marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#333' }}>Custom Fields</div>
                  <div style={{ fontSize: 11, color: '#374151', marginTop: 2 }}>Extra info to collect when customers order this service</div>
                </div>
                <button onClick={addField}
                  style={{ fontSize: 12, padding: '5px 12px', borderRadius: 6, cursor: 'pointer', background: '#f0f0ec', border: '0.5px solid #ccc', color: '#444', fontWeight: 500, whiteSpace: 'nowrap' }}>
                  + Add field
                </button>
              </div>

              {fields.length === 0 ? (
                <div style={{ fontSize: 12, color: '#374151', textAlign: 'center', padding: '14px 0', border: '1px dashed #eee', borderRadius: 8 }}>
                  No custom fields — click <b>+ Add field</b> to create one
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {fields.map((f, idx) => (
                    <div key={f._key ?? f.id ?? idx}
                      style={{ background: '#f9f9f7', border: '0.5px solid #e8e8e0', borderRadius: 8, padding: '10px 12px' }}>

                      {/* Row 1: label + type */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 150px', gap: 8, marginBottom: 8 }}>
                        <div>
                          <label style={{ ...S.label, marginBottom: 3 }}>Field label</label>
                          <input value={f.label} onChange={e => updateField(idx, 'label', e.target.value)}
                            placeholder="e.g. Weight (kg), Color, Notes…"
                            style={{ ...S.input, fontSize: 12 }} />
                        </div>
                        <div>
                          <label style={{ ...S.label, marginBottom: 3 }}>Type</label>
                          <select value={f.field_type}
                            onChange={e => updateField(idx, 'field_type', e.target.value)}
                            style={{ ...S.select, fontSize: 12 }}>
                            {FIELD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                          </select>
                        </div>
                      </div>

                      {/* Type-specific config */}
                      {(f.field_type === 'text' || f.field_type === 'textarea') && (
                        <div style={{ marginBottom: 8 }}>
                          <label style={{ ...S.label, marginBottom: 3 }}>Placeholder text (optional)</label>
                          <input value={f.placeholder || ''} onChange={e => updateField(idx, 'placeholder', e.target.value)}
                            placeholder={f.field_type === 'textarea' ? 'e.g. Any special instructions…' : 'e.g. Enter value here'}
                            style={{ ...S.input, fontSize: 12 }} />
                        </div>
                      )}

                      {f.field_type === 'number' && (
                        <>
                          <div style={{ marginBottom: 8 }}>
                            <label style={{ ...S.label, marginBottom: 3 }}>Placeholder text (optional)</label>
                            <input value={f.placeholder || ''} onChange={e => updateField(idx, 'placeholder', e.target.value)}
                              placeholder="e.g. Enter number of pieces" style={{ ...S.input, fontSize: 12 }} />
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                            <div>
                              <label style={{ ...S.label, marginBottom: 3 }}>Min value (optional)</label>
                              <input type="number" value={f.min_value || ''} onChange={e => updateField(idx, 'min_value', e.target.value)}
                                placeholder="0" style={{ ...S.input, fontSize: 12 }} />
                            </div>
                            <div>
                              <label style={{ ...S.label, marginBottom: 3 }}>Max value (optional)</label>
                              <input type="number" value={f.max_value || ''} onChange={e => updateField(idx, 'max_value', e.target.value)}
                                placeholder="—" style={{ ...S.input, fontSize: 12 }} />
                            </div>
                          </div>
                        </>
                      )}

                      {f.field_type === 'addon' && (
                        <>
                          <div style={{ marginBottom: 8 }}>
                            <label style={{ ...S.label, marginBottom: 3 }}>Add-on price (₱) per unit *</label>
                            <input type="number" min="0" step="0.01"
                              value={f.unit_price || ''}
                              onChange={e => updateField(idx, 'unit_price', e.target.value)}
                              placeholder="e.g. 10"
                              style={{ ...S.input, fontSize: 12 }} />
                          </div>
                          <div style={{ marginBottom: 8 }}>
                            <label style={{ ...S.label, marginBottom: 3 }}>Description / hint (optional)</label>
                            <input value={f.placeholder || ''}
                              onChange={e => updateField(idx, 'placeholder', e.target.value)}
                              placeholder="e.g. Wire hanger included"
                              style={{ ...S.input, fontSize: 12 }} />
                          </div>
                          <div style={{ fontSize: 11, padding: '6px 10px', borderRadius: 6, background: '#EAF3DE', color: '#3B6D11' }}>
                            ✓ Customer selects quantity (0, 1, 2…) — price added to order total
                          </div>

                          {/* Conditional visibility — link to a select field option */}
                          {(() => {
                            const selectFields = fields.filter((sf, si) => sf.field_type === 'select' && si !== idx && sf.label);
                            return selectFields.length > 0 && (
                              <div style={{ marginTop: 10, padding: '10px', background: '#F9F9F7', borderRadius: 7, border: '0.5px solid #e8e8e0' }}>
                                <label style={{ ...S.label, marginBottom: 4 }}>Show only when (optional)</label>
                                <select value={f.linked_to_field_label || ''} onChange={e => updateField(idx, 'linked_to_field_label', e.target.value)} style={{ ...S.select, fontSize: 12, marginBottom: 6 }}>
                                  <option value="">— Always show —</option>
                                  {selectFields.map(sf => (
                                    <option key={sf.label} value={sf.label}>{sf.label}</option>
                                  ))}
                                </select>
                                {f.linked_to_field_label && (
                                  <select value={f.linked_to_value || ''} onChange={e => updateField(idx, 'linked_to_value', e.target.value)} style={{ ...S.select, fontSize: 12 }}>
                                    <option value="">— Select trigger option —</option>
                                    {(fields.find(sf => sf.label === f.linked_to_field_label)?.options || []).map(opt => {
                                      const label = typeof opt === 'object' ? opt.label : opt;
                                      return <option key={label} value={label}>{label}</option>;
                                    })}
                                  </select>
                                )}
                              </div>
                            );
                          })()}

                          {f.required && (
                            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#374151', cursor: 'pointer', marginTop: 8 }}>
                              <input type="checkbox" checked={f.allow_own || false} onChange={e => updateField(idx, 'allow_own', e.target.checked)} />
                              Allow "I'll provide my own" option
                            </label>
                          )}
                        </>
                      )}

                      {f.field_type === 'select' && (
                        <div style={{ marginBottom: 8 }}>
                          <label style={{ ...S.label, marginBottom: 6 }}>Options &amp; prices</label>

                          {/* Existing options */}
                          {(f.options || []).length > 0 && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 8 }}>
                              {(f.options || []).map((opt, oi) => {
                                const optLabel  = typeof opt === 'object' ? opt.label : opt;
                                const optPrice  = typeof opt === 'object' ? Number(opt.price || 0) : 0;
                                const priceType = typeof opt === 'object' ? (opt.price_type || 'fixed') : 'fixed';
                                const isEditing = f._editingOptIdx === oi;
                                if (isEditing) {
                                  return (
                                    <div key={oi} style={{ display: 'flex', flexDirection: 'column', gap: 5, padding: '8px 10px', background: '#FFF9E6', borderRadius: 7, border: '1px solid #F5D165' }}>
                                      <div style={{ display: 'grid', gridTemplateColumns: `1fr ${(f._editOptPriceType || 'fixed') === 'copy_base' ? 'auto' : '80px'} auto auto`, gap: 5, alignItems: 'center' }}>
                                        <input value={f._editOptLabel || ''} onChange={e => updateField(idx, '_editOptLabel', e.target.value)}
                                          style={{ ...S.input, fontSize: 12 }} placeholder="Option label" />
                                        {(f._editOptPriceType || 'fixed') === 'copy_base' ? (
                                          <span style={{ display: 'flex', alignItems: 'center', padding: '4px 8px', fontSize: 11, background: '#F5F3FF', color: '#7C3AED', border: '1px solid #DDD6FE', borderRadius: 6, fontWeight: 600, whiteSpace: 'nowrap' }}>
                                            = base price
                                          </span>
                                        ) : (
                                          <input type="number" min="0" step="1" value={f._editOptPrice || ''} onChange={e => updateField(idx, '_editOptPrice', e.target.value)}
                                            placeholder="₱ price" style={{ ...S.input, fontSize: 12 }} />
                                        )}
                                        <button onClick={() => saveEditOption(idx)}
                                          style={{ padding: '4px 10px', fontSize: 12, borderRadius: 5, cursor: 'pointer', background: '#378ADD', color: '#fff', border: 'none', fontWeight: 500 }}>✓</button>
                                        <button onClick={() => cancelEditOption(idx)}
                                          style={{ padding: '4px 8px', fontSize: 12, borderRadius: 5, cursor: 'pointer', background: '#f0f0ec', color: '#444', border: '0.5px solid #ccc' }}>✕</button>
                                      </div>
                                      <button type="button"
                                        onClick={() => updateField(idx, '_editOptPriceType', (f._editOptPriceType || 'fixed') === 'copy_base' ? 'fixed' : 'copy_base')}
                                        style={{ fontSize: 11, background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit', textAlign: 'left',
                                          color: (f._editOptPriceType || 'fixed') === 'copy_base' ? '#7C3AED' : '#374151', textDecoration: 'underline', textDecorationStyle: 'dotted' }}>
                                        {(f._editOptPriceType || 'fixed') === 'copy_base' ? '↩ Switch to fixed price' : '= Switch to copy base price'}
                                      </button>
                                    </div>
                                  );
                                }
                                return (
                                  <div key={oi} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', background: '#EEF6FF', borderRadius: 7, border: '1px solid #BDD8F7' }}>
                                    <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: '#185FA5' }}>{optLabel}</span>
                                    {priceType === 'copy_base' ? (
                                      <span style={{ fontSize: 11, color: '#7C3AED', background: '#F5F3FF', padding: '2px 8px', borderRadius: 4, border: '1px solid #DDD6FE', fontWeight: 600, whiteSpace: 'nowrap' }}>
                                        = base price
                                      </span>
                                    ) : (
                                      <span style={{ fontSize: 12, color: '#185FA5', background: '#fff', padding: '2px 8px', borderRadius: 4, border: '1px solid #BDD8F7', fontWeight: 600 }}>
                                        ₱{optPrice.toLocaleString()}
                                      </span>
                                    )}
                                    <button onClick={() => startEditOption(idx, oi)} title="Edit option"
                                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#374151', fontSize: 13, padding: '0 2px', lineHeight: 1 }}>✎</button>
                                    <button onClick={() => removeOption(idx, oi)}
                                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#A32D2D', fontSize: 15, padding: '0 2px', lineHeight: 1 }}>×</button>
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {/* Add new option */}
                          <div style={{ display: 'grid', gridTemplateColumns: `1fr ${(f._newOptionPriceType || 'fixed') === 'copy_base' ? 'auto' : '80px'} auto`, gap: 6 }}>
                            <input
                              value={f._newOption || ''}
                              onChange={e => updateField(idx, '_newOption', e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addOption(idx); } }}
                              placeholder="Option label (e.g. Express 1 day)"
                              style={{ ...S.input, fontSize: 12 }}
                            />
                            {(f._newOptionPriceType || 'fixed') === 'copy_base' ? (
                              <span style={{ display: 'flex', alignItems: 'center', padding: '4px 10px', fontSize: 11, background: '#F5F3FF', color: '#7C3AED', border: '1px solid #DDD6FE', borderRadius: 6, fontWeight: 600, whiteSpace: 'nowrap' }}>
                                = base price
                              </span>
                            ) : (
                              <input
                                type="number" min="0" step="1"
                                value={f._newOptionPrice || ''}
                                onChange={e => updateField(idx, '_newOptionPrice', e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addOption(idx); } }}
                                placeholder="₱ price"
                                style={{ ...S.input, fontSize: 12 }}
                              />
                            )}
                            <button onClick={() => addOption(idx)}
                              style={{ padding: '5px 12px', fontSize: 12, borderRadius: 6, cursor: 'pointer', background: '#378ADD', color: '#fff', border: 'none', fontWeight: 500, whiteSpace: 'nowrap' }}>
                              + Add
                            </button>
                          </div>

                          {/* Price type toggle */}
                          <button type="button"
                            onClick={() => updateField(idx, '_newOptionPriceType', (f._newOptionPriceType || 'fixed') === 'copy_base' ? 'fixed' : 'copy_base')}
                            style={{ marginTop: 6, fontSize: 11, background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit',
                              color: (f._newOptionPriceType || 'fixed') === 'copy_base' ? '#7C3AED' : '#374151', textDecoration: 'underline', textDecorationStyle: 'dotted' }}>
                            {(f._newOptionPriceType || 'fixed') === 'copy_base'
                              ? '↩ Switch to fixed price'
                              : '= Switch to copy base price (e.g. Express doubles the bag price)'}
                          </button>
                        </div>
                      )}

                      {/* Required + move/remove */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                        <label style={{ fontSize: 12, color: '#374151', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                          <input type="checkbox" checked={f.required || false} onChange={e => updateField(idx, 'required', e.target.checked)} />
                          Required
                        </label>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button onClick={() => moveField(idx, -1)} disabled={idx === 0} title="Move up"
                            style={{ fontSize: 12, padding: '3px 7px', borderRadius: 4, cursor: 'pointer', background: 'transparent', border: '0.5px solid #ddd', color: idx === 0 ? '#ddd' : '#374151' }}>↑</button>
                          <button onClick={() => moveField(idx, 1)} disabled={idx === fields.length - 1} title="Move down"
                            style={{ fontSize: 12, padding: '3px 7px', borderRadius: 4, cursor: 'pointer', background: 'transparent', border: '0.5px solid #ddd', color: idx === fields.length - 1 ? '#ddd' : '#374151' }}>↓</button>
                          <button onClick={() => removeField(idx)} title="Remove"
                            style={{ fontSize: 12, padding: '3px 8px', borderRadius: 4, cursor: 'pointer', background: '#FCEBEB', border: '0.5px solid #F09595', color: '#A32D2D' }}>✕</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={handleSvcSave} disabled={saving} style={S.btn('#378ADD', '#fff')}>{saving ? 'Saving…' : 'Save'}</button>
              <button onClick={() => { setSvcForm(null); setPreview(null); setFields([]); }} style={S.btn('#f0f0ec', '#444')}>Cancel</button>
              {!svcForm.isNew && <button onClick={() => handleSvcDelete(svcForm.id)}
                style={{ padding: '8px 14px', fontSize: 13, borderRadius: 6, cursor: 'pointer', background: '#FCEBEB', border: '0.5px solid #F09595', color: '#A32D2D' }}>Delete</button>}
            </div>
          </div>
        </div>
      )}

      {/* ── Category Modal ─────────────────────────────────────────────── */}
      {catForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: '1.5rem', width: 360, border: '0.5px solid #e8e8e0' }}>
            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 16 }}>{catForm.isNew ? 'Add category' : 'Edit category'}</div>

            <div style={{ marginBottom: 12 }}>
              <label style={S.label}>Category name</label>
              <input value={catForm.name} onChange={e => setCatForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Basic Services" style={S.input} />
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={S.label}>Sort order (lower = first)</label>
              <input type="number" value={catForm.sort_order} onChange={e => setCatForm(p => ({ ...p, sort_order: +e.target.value }))} style={S.input} />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <input type="checkbox" id="catActive" checked={catForm.active} onChange={e => setCatForm(p => ({ ...p, active: e.target.checked }))} />
              <label htmlFor="catActive" style={{ fontSize: 13, cursor: 'pointer' }}>Active (visible to customers)</label>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={handleCatSave} disabled={saving} style={S.btn('#378ADD', '#fff')}>{saving ? 'Saving…' : 'Save'}</button>
              <button onClick={() => setCatForm(null)} style={S.btn('#f0f0ec', '#444')}>Cancel</button>
              {!catForm.isNew && <button onClick={() => handleCatDelete(catForm.id)}
                style={{ padding: '8px 14px', fontSize: 13, borderRadius: 6, cursor: 'pointer', background: '#FCEBEB', border: '0.5px solid #F09595', color: '#A32D2D' }}>Delete</button>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
