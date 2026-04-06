import { useEffect, useState, useRef } from 'react';
import { getServices, createService, updateService, deleteService } from '../api.js';

const empty = { name: '', price: '', unit: 'per kg', description: '', active: true, image_url: '' };

export default function Services() {
  const [services, setServices] = useState([]);
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(null);
  const fileRef = useRef();

  useEffect(() => {
    getServices().then(r => { setServices(r.data); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  function handleImageChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      setPreview(ev.target.result);
      setForm(p => ({ ...p, image_url: ev.target.result }));
    };
    reader.readAsDataURL(file);
  }

  async function handleSave() {
    if (!form.name || !form.price) return alert('Name and price are required.');
    setSaving(true);
    try {
      if (form.isNew) {
        const { data } = await createService(form);
        setServices(prev => [...prev, data]);
      } else {
        const { data } = await updateService(form.id, form);
        setServices(prev => prev.map(s => s.id === form.id ? data : s));
      }
      setForm(null);
      setPreview(null);
    } catch (err) {
      alert('Error saving service: ' + err.message);
    } finally { setSaving(false); }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this service?')) return;
    await deleteService(id);
    setServices(prev => prev.filter(s => s.id !== id));
    setForm(null);
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <h2 style={{ fontSize: 18, fontWeight: 500 }}>Services & Pricing</h2>
        <button onClick={() => { setForm({ ...empty, isNew: true }); setPreview(null); }}
          style={{ padding: '7px 16px', fontSize: 13, borderRadius: 6, cursor: 'pointer', background: '#378ADD', color: '#fff', border: 'none', fontWeight: 500 }}>
          + Add service
        </button>
      </div>

      {loading ? <div style={{ color: '#aaa', fontSize: 14 }}>Loading...</div> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(230px,1fr))', gap: 12 }}>
          {services.map(s => (
            <div key={s.id} style={{ background: '#fff', border: '0.5px solid #e8e8e0', borderRadius: 12, overflow: 'hidden' }}>
              {s.image_url ? (
                <img src={s.image_url} alt={s.name} style={{ width: '100%', height: 140, objectFit: 'cover' }} />
              ) : (
                <div style={{ width: '100%', height: 140, background: '#f5f5f3', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32 }}>🧺</div>
              )}
              <div style={{ padding: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 8 }}>
                  <div style={{ fontWeight: 500, fontSize: 14 }}>{s.name}</div>
                  <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 4, background: s.active ? '#EAF3DE' : '#f0f0ec', color: s.active ? '#3B6D11' : '#888' }}>
                    {s.active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div style={{ fontSize: 22, fontWeight: 500, color: '#185FA5', marginBottom: 4 }}>
                  ₱{Number(s.price).toLocaleString()} <span style={{ fontSize: 12, fontWeight: 400, color: '#888' }}>{s.unit}</span>
                </div>
                <div style={{ fontSize: 12, color: '#888', marginBottom: 14 }}>{s.description}</div>
                <button onClick={() => { setForm({ ...s, isNew: false }); setPreview(s.image_url || null); }}
                  style={{ fontSize: 12, padding: '6px 12px', borderRadius: 6, cursor: 'pointer', background: 'transparent', border: '0.5px solid #ccc', color: '#666', width: '100%' }}>
                  Edit
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {form && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: '1.5rem', width: 380, border: '0.5px solid #e8e8e0', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ fontWeight: 500, fontSize: 15, marginBottom: 16 }}>{form.isNew ? 'Add service' : 'Edit service'}</div>

            {/* Image upload */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, color: '#888', display: 'block', marginBottom: 6 }}>Service image</label>
              <div
                onClick={() => fileRef.current.click()}
                style={{ width: '100%', height: 140, borderRadius: 8, border: '1px dashed #ccc', cursor: 'pointer', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f9f9f9' }}>
                {preview ? (
                  <img src={preview} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ textAlign: 'center', color: '#aaa' }}>
                    <div style={{ fontSize: 28, marginBottom: 4 }}>📷</div>
                    <div style={{ fontSize: 12 }}>Click to upload image</div>
                  </div>
                )}
              </div>
              <input ref={fileRef} type="file" accept="image/*" onChange={handleImageChange} style={{ display: 'none' }} />
              {preview && (
                <button onClick={() => { setPreview(null); setForm(p => ({ ...p, image_url: '' })); }}
                  style={{ marginTop: 6, fontSize: 11, color: '#A32D2D', background: 'none', border: 'none', cursor: 'pointer' }}>
                  Remove image
                </button>
              )}
            </div>

            {[['name','Service name','text'],['price','Price (₱)','number'],['unit','Unit (e.g. per kg)','text'],['description','Description','text']].map(([field, label, type]) => (
              <div key={field} style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, color: '#888', display: 'block', marginBottom: 4 }}>{label}</label>
                <input type={type} value={form[field]} onChange={e => setForm(p => ({ ...p, [field]: e.target.value }))}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '7px 10px', fontSize: 13, borderRadius: 6, border: '0.5px solid #ccc' }} />
              </div>
            ))}

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <input type="checkbox" id="activeChk" checked={form.active} onChange={e => setForm(p => ({ ...p, active: e.target.checked }))} />
              <label htmlFor="activeChk" style={{ fontSize: 13, cursor: 'pointer' }}>Active (visible to customers)</label>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={handleSave} disabled={saving}
                style={{ flex: 1, padding: '8px', fontSize: 13, borderRadius: 6, cursor: 'pointer', background: '#378ADD', color: '#fff', border: 'none', fontWeight: 500 }}>
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button onClick={() => { setForm(null); setPreview(null); }}
                style={{ flex: 1, padding: '8px', fontSize: 13, borderRadius: 6, cursor: 'pointer', background: 'transparent', border: '0.5px solid #ccc', color: '#666' }}>
                Cancel
              </button>
              {!form.isNew && (
                <button onClick={() => handleDelete(form.id)}
                  style={{ padding: '8px 14px', fontSize: 13, borderRadius: 6, cursor: 'pointer', background: '#FCEBEB', border: '0.5px solid #F09595', color: '#A32D2D' }}>
                  Delete
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}