import { useEffect, useState } from 'react';
import { getTenants, createTenant, updateTenant } from '../api.js';

const emptyTenant = { name: '', fb_page_id: '', fb_page_access_token: '', xendit_api_key: '', admin_email: '', admin_password: '', active: true };

export default function SuperAdmin() {
  const [tenants, setTenants] = useState([]);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getTenants().then(r => { setTenants(r.data); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      if (form.isNew) {
        const { data } = await createTenant(form);
        setTenants(prev => [data, ...prev]);
      } else {
        const { data } = await updateTenant(form.id, form);
        setTenants(prev => prev.map(t => t.id === form.id ? data : t));
      }
      setForm(null);
    } catch (err) {
      alert('Error: ' + (err.response?.data?.error || err.message));
    } finally { setSaving(false); }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <h2 style={{ fontSize: 18, fontWeight: 500 }}>Super Admin — All Branches</h2>
        <button onClick={() => setForm({ ...emptyTenant, isNew: true })}
          style={{ padding: '7px 16px', fontSize: 13, borderRadius: 6, cursor: 'pointer', background: '#BA7517', color: '#fff', border: 'none', fontWeight: 500 }}>
          + Add branch
        </button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: '1.5rem' }}>
        {[
          { label: 'Total branches', val: tenants.length, color: '#BA7517' },
          { label: 'Active branches', val: tenants.filter(t => t.active).length, color: '#1D9E75' },
          { label: 'Total orders', val: tenants.reduce((s, t) => s + Number(t.total_orders || 0), 0), color: '#378ADD' },
        ].map(m => (
          <div key={m.label} style={{ background: '#f5f5f3', borderRadius: 8, padding: '1rem' }}>
            <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>{m.label}</div>
            <div style={{ fontSize: 26, fontWeight: 500, color: m.color }}>{m.val}</div>
          </div>
        ))}
      </div>
      <div style={{ background: '#fff', border: '0.5px solid #e8e8e0', borderRadius: 12, overflow: 'hidden' }}>
        {loading ? <div style={{ padding: '2rem', color: '#aaa', fontSize: 14 }}>Loading...</div> : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f5f5f3' }}>
                {['Branch','FB Page ID','Orders','Revenue','Status',''].map(h => (
                  <th key={h} style={{ padding: '9px 12px', textAlign: 'left', fontWeight: 500, fontSize: 12, color: '#888' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tenants.map(t => (
                <tr key={t.id} style={{ borderTop: '0.5px solid #f0f0ec' }}>
                  <td style={{ padding: '10px 12px', fontWeight: 500 }}>{t.name}</td>
                  <td style={{ padding: '10px 12px', color: '#888', fontFamily: 'monospace', fontSize: 12 }}>{t.fb_page_id}</td>
                  <td style={{ padding: '10px 12px', fontWeight: 500 }}>{t.total_orders || 0}</td>
                  <td style={{ padding: '10px 12px', fontWeight: 500, color: '#3B6D11' }}>₱{Number(t.total_revenue || 0).toLocaleString()}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 4, background: t.active ? '#EAF3DE' : '#f0f0ec', color: t.active ? '#3B6D11' : '#888' }}>
                      {t.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <button onClick={() => setForm({ ...t, isNew: false })}
                      style={{ fontSize: 12, padding: '4px 12px', borderRadius: 5, cursor: 'pointer', background: 'transparent', border: '0.5px solid #ccc', color: '#666' }}>
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
              {tenants.length === 0 && (
                <tr><td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: '#aaa', fontSize: 13 }}>No branches yet. Add one to get started.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
      {form && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: '1.5rem', width: 420, border: '0.5px solid #e8e8e0', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ fontWeight: 500, fontSize: 15, marginBottom: 16 }}>{form.isNew ? 'Add branch' : 'Edit branch'}</div>
            {[['name','Branch name','text'],['fb_page_id','Facebook Page ID','text'],['fb_page_access_token','Page Access Token','text'],['xendit_api_key','Xendit API Key','text']].map(([field, label, type]) => (
              <div key={field} style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, color: '#888', display: 'block', marginBottom: 4 }}>{label}</label>
                <input type={type} value={form[field] || ''} onChange={e => setForm(p => ({ ...p, [field]: e.target.value }))}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '7px 10px', fontSize: 13, borderRadius: 6, border: '0.5px solid #ccc' }} />
              </div>
            ))}
            {form.isNew && (
              <>
                <div style={{ fontSize: 12, color: '#888', fontWeight: 500, margin: '14px 0 8px' }}>Admin account for this branch</div>
                {[['admin_email','Admin email','email'],['admin_password','Admin password','password']].map(([field, label, type]) => (
                  <div key={field} style={{ marginBottom: 12 }}>
                    <label style={{ fontSize: 12, color: '#888', display: 'block', marginBottom: 4 }}>{label}</label>
                    <input type={type} value={form[field] || ''} onChange={e => setForm(p => ({ ...p, [field]: e.target.value }))}
                      style={{ width: '100%', boxSizing: 'border-box', padding: '7px 10px', fontSize: 13, borderRadius: 6, border: '0.5px solid #ccc' }} />
                  </div>
                ))}
              </>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <input type="checkbox" id="activeT" checked={form.active} onChange={e => setForm(p => ({ ...p, active: e.target.checked }))} />
              <label htmlFor="activeT" style={{ fontSize: 13, cursor: 'pointer' }}>Branch active</label>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={handleSave} disabled={saving}
                style={{ flex: 1, padding: '8px', fontSize: 13, borderRadius: 6, cursor: 'pointer', background: '#BA7517', color: '#fff', border: 'none', fontWeight: 500 }}>
                {saving ? 'Saving...' : 'Save branch'}
              </button>
              <button onClick={() => setForm(null)}
                style={{ flex: 1, padding: '8px', fontSize: 13, borderRadius: 6, cursor: 'pointer', background: 'transparent', border: '0.5px solid #ccc', color: '#666' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}