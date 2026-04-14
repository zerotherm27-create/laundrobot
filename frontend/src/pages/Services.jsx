import { useEffect, useState, useRef } from 'react';
import { getServices, createService, updateService, deleteService,
         getCategories, createCategory, updateCategory, deleteCategory } from '../api.js';

const emptyService  = { name: '', price: '', unit: 'per kg', description: '', active: true, image_url: '', category_id: '', sort_order: 0 };
const emptyCategory = { name: '', sort_order: 0, active: true };

export default function Services() {
  const [categories,  setCategories]  = useState([]);
  const [services,    setServices]    = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [tab,         setTab]         = useState('services'); // 'services' | 'categories'
  const [svcForm,     setSvcForm]     = useState(null);
  const [catForm,     setCatForm]     = useState(null);
  const [saving,      setSaving]      = useState(false);
  const [preview,     setPreview]     = useState(null);
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

  // ── Service save ──────────────────────────────────────────────────────
  async function handleSvcSave() {
    if (!svcForm.name || !svcForm.price) return alert('Name and price are required.');
    setSaving(true);
    try {
      const payload = { ...svcForm, category_id: svcForm.category_id || null };
      if (svcForm.isNew) {
        const { data } = await createService(payload);
        setServices(prev => [...prev, data]);
      } else {
        const { data } = await updateService(svcForm.id, payload);
        setServices(prev => prev.map(s => s.id === svcForm.id ? data : s));
      }
      setSvcForm(null); setPreview(null);
    } catch (err) { alert('Error: ' + err.message); }
    finally { setSaving(false); }
  }

  async function handleSvcDelete(id) {
    if (!confirm('Delete this service?')) return;
    await deleteService(id);
    setServices(prev => prev.filter(s => s.id !== id));
    setSvcForm(null);
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

  // Sections: sorted categories + uncategorized at the end
  const sections = [
    ...sortedCats.map(c => ({ id: String(c.id), name: c.name, active: c.active, cat: c })),
    ...(grouped['__none__']?.length ? [{ id: '__none__', name: 'Uncategorized', active: true, cat: null }] : []),
  ];

  const S = {
    label: { fontSize: 12, color: '#888', display: 'block', marginBottom: 4 },
    input: { width: '100%', boxSizing: 'border-box', padding: '7px 10px', fontSize: 13, borderRadius: 6, border: '0.5px solid #ccc', outline: 'none' },
    select: { width: '100%', boxSizing: 'border-box', padding: '7px 10px', fontSize: 13, borderRadius: 6, border: '0.5px solid #ccc', background: '#fff' },
    btn: (bg, color) => ({ padding: '8px', fontSize: 13, borderRadius: 6, cursor: 'pointer', background: bg, color, border: 'none', fontWeight: 500, flex: 1 }),
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
          <button onClick={() => { setSvcForm({ ...emptyService, isNew: true }); setPreview(null); }}
            style={{ padding: '7px 14px', fontSize: 13, borderRadius: 6, cursor: 'pointer', background: '#378ADD', color: '#fff', border: 'none', fontWeight: 500 }}>
            + Service
          </button>
        </div>
      </div>

      {loading ? <div style={{ color: '#aaa', fontSize: 14 }}>Loading...</div> : (

        sections.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#aaa', fontSize: 14, padding: '3rem 0' }}>
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
                      {!active && <span style={{ fontSize: 11, padding: '2px 6px', borderRadius: 4, background: '#f0f0ec', color: '#888' }}>Hidden</span>}
                      <span style={{ fontSize: 12, color: '#aaa' }}>({svcList.length} service{svcList.length !== 1 ? 's' : ''})</span>
                    </div>
                    {cat && (
                      <button onClick={() => setCatForm({ ...cat, isNew: false })}
                        style={{ fontSize: 11, padding: '3px 10px', borderRadius: 5, cursor: 'pointer', background: 'transparent', border: '0.5px solid #ddd', color: '#666' }}>
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
                            {!s.active && <span style={{ fontSize: 10, padding: '2px 5px', borderRadius: 3, background: '#f0f0ec', color: '#888' }}>Off</span>}
                          </div>
                          <div style={{ fontSize: 18, fontWeight: 600, color: '#185FA5', marginBottom: 2 }}>
                            ₱{Number(s.price).toLocaleString()} <span style={{ fontSize: 11, fontWeight: 400, color: '#888' }}>{s.unit}</span>
                          </div>
                          {s.description && <div style={{ fontSize: 11, color: '#888', marginBottom: 8 }}>{s.description}</div>}
                          <button onClick={() => { setSvcForm({ ...s, isNew: false }); setPreview(s.image_url || null); }}
                            style={{ fontSize: 11, padding: '5px 10px', borderRadius: 5, cursor: 'pointer', background: 'transparent', border: '0.5px solid #ccc', color: '#666', width: '100%' }}>
                            Edit
                          </button>
                        </div>
                      </div>
                    ))}

                    {/* Add service to this category shortcut */}
                    <div
                      onClick={() => setSvcForm({ ...emptyService, isNew: true, category_id: id === '__none__' ? '' : id })}
                      style={{ border: '1.5px dashed #ddd', borderRadius: 10, minHeight: 140, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#bbb', fontSize: 13, flexDirection: 'column', gap: 4 }}>
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
          <div style={{ background: '#fff', borderRadius: 12, padding: '1.5rem', width: 390, border: '0.5px solid #e8e8e0', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 16 }}>{svcForm.isNew ? 'Add service' : 'Edit service'}</div>

            {/* Image */}
            <div style={{ marginBottom: 14 }}>
              <label style={S.label}>Service image</label>
              <div onClick={() => fileRef.current.click()}
                style={{ width: '100%', height: 120, borderRadius: 8, border: '1px dashed #ccc', cursor: 'pointer', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f9f9f9' }}>
                {preview
                  ? <img src={preview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <div style={{ textAlign: 'center', color: '#aaa' }}><div style={{ fontSize: 24, marginBottom: 4 }}>📷</div><div style={{ fontSize: 11 }}>Click to upload</div></div>}
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

            {/* Fields */}
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

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <input type="checkbox" id="svcActive" checked={svcForm.active} onChange={e => setSvcForm(p => ({ ...p, active: e.target.checked }))} />
              <label htmlFor="svcActive" style={{ fontSize: 13, cursor: 'pointer' }}>Active (visible to customers)</label>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={handleSvcSave} disabled={saving} style={S.btn('#378ADD', '#fff')}>{saving ? 'Saving…' : 'Save'}</button>
              <button onClick={() => { setSvcForm(null); setPreview(null); }} style={S.btn('#f0f0ec', '#444')}>Cancel</button>
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
