import { useEffect, useState } from 'react';
import {
  getDeliveryZones, createDeliveryZone, updateDeliveryZone, deleteDeliveryZone,
} from '../api.js';

const EMPTY = { name: '', fee: '', active: true, sort_order: 0 };

export default function DeliveryZones() {
  const [zones,   setZones]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal,   setModal]   = useState(null); // null | 'add' | zone object
  const [form,    setForm]    = useState(EMPTY);
  const [saving,  setSaving]  = useState(false);
  const [err,     setErr]     = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    try { const r = await getDeliveryZones(); setZones(r.data); }
    catch {} finally { setLoading(false); }
  }

  function openAdd() { setForm(EMPTY); setErr(''); setModal('add'); }
  function openEdit(z) { setForm({ name: z.name, fee: z.fee, active: z.active, sort_order: z.sort_order }); setErr(''); setModal(z); }

  async function handleSave(e) {
    e.preventDefault();
    if (!form.name.trim()) return setErr('Zone name is required');
    if (form.fee === '' || isNaN(form.fee)) return setErr('Valid delivery fee is required');
    setSaving(true); setErr('');
    try {
      const payload = { name: form.name.trim(), fee: parseFloat(form.fee), active: form.active, sort_order: Number(form.sort_order) || 0 };
      if (modal === 'add') {
        const r = await createDeliveryZone(payload);
        setZones(prev => [...prev, r.data]);
      } else {
        const r = await updateDeliveryZone(modal.id, payload);
        setZones(prev => prev.map(z => z.id === modal.id ? r.data : z));
      }
      setModal(null);
    } catch (e) { setErr(e.response?.data?.error || 'Something went wrong'); }
    finally { setSaving(false); }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this delivery zone?')) return;
    try {
      await deleteDeliveryZone(id);
      setZones(prev => prev.filter(z => z.id !== id));
    } catch (e) { alert(e.response?.data?.error || 'Delete failed'); }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <h2 style={{ fontSize: 18, fontWeight: 500 }}>Delivery Zones</h2>
        <button onClick={openAdd} className="btn-primary">+ Add Zone</button>
      </div>

      <div style={{ background: '#fff', border: '0.5px solid #e8e8e0', borderRadius: 12, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '2rem', color: '#374151', fontSize: 13 }}>Loading...</div>
        ) : zones.length === 0 ? (
          <div style={{ padding: '2.5rem', textAlign: 'center', color: '#374151', fontSize: 13 }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>📍</div>
            <div style={{ fontWeight: 500, marginBottom: 6 }}>No delivery zones yet</div>
            <div style={{ fontSize: 12, color: '#374151', marginBottom: 16 }}>Add zones with custom delivery fees shown to customers during online booking.</div>
            <button onClick={openAdd} className="btn-primary">+ Add First Zone</button>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f5f5f3' }}>
                {['Zone / Location', 'Delivery Fee', 'Status', ''].map(h => (
                  <th key={h} style={{ padding: '9px 14px', textAlign: 'left', fontWeight: 500, fontSize: 12, color: '#374151' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {zones.map(z => (
                <tr key={z.id} style={{ borderTop: '0.5px solid #f0f0ec' }}>
                  <td style={{ padding: '10px 14px', fontWeight: 500 }}>{z.name}</td>
                  <td style={{ padding: '10px 14px', color: '#185FA5', fontWeight: 600 }}>₱{Number(z.fee).toLocaleString()}</td>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{
                      fontSize: 11, padding: '2px 8px', borderRadius: 20, fontWeight: 500,
                      background: z.active ? '#EAF3DE' : '#F0F0EC',
                      color: z.active ? '#3B6D11' : '#374151',
                    }}>{z.active ? 'Active' : 'Inactive'}</span>
                  </td>
                  <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                    <button onClick={() => openEdit(z)}
                      style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6, border: '0.5px solid #ccc', background: '#fff', cursor: 'pointer', marginRight: 6 }}>
                      Edit
                    </button>
                    <button onClick={() => handleDelete(z.id)}
                      style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6, border: '0.5px solid #F09595', background: '#FCEBEB', color: '#A32D2D', cursor: 'pointer' }}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div className="modal-card" style={{ width: 420, padding: '1.75rem' }}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 20 }}>
              {modal === 'add' ? '+ Add Delivery Zone' : 'Edit Delivery Zone'}
            </div>
            <form onSubmit={handleSave}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 5 }}>Zone / Location Name *</label>
                <input className="input-base" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. Makati, Quezon City, BGC" required />
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 5 }}>Delivery Fee (₱) *</label>
                <input className="input-base" type="number" min="0" step="0.01" value={form.fee}
                  onChange={e => setForm(p => ({ ...p, fee: e.target.value }))}
                  placeholder="e.g. 50" required />
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 5 }}>Sort Order</label>
                <input className="input-base" type="number" min="0" value={form.sort_order}
                  onChange={e => setForm(p => ({ ...p, sort_order: e.target.value }))}
                  placeholder="0" />
              </div>
              <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="checkbox" id="zone-active" checked={form.active}
                  onChange={e => setForm(p => ({ ...p, active: e.target.checked }))} style={{ width: 14, height: 14 }} />
                <label htmlFor="zone-active" style={{ fontSize: 13, cursor: 'pointer' }}>Active (visible to customers)</label>
              </div>
              {err && <div style={{ marginBottom: 14, padding: '8px 12px', borderRadius: 7, background: '#FCEBEB', color: '#A32D2D', fontSize: 12 }}>{err}</div>}
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="submit" disabled={saving} className="btn-primary" style={{ flex: 1, justifyContent: 'center', padding: 9 }}>
                  {saving ? 'Saving…' : 'Save Zone'}
                </button>
                <button type="button" onClick={() => setModal(null)} className="btn-ghost" style={{ flex: 1, justifyContent: 'center', padding: 9 }}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
