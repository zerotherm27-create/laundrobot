import { useState, useEffect } from 'react';
import { getUsers, createUser, updateUser, deleteUser, changePassword, getTenants } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';

const FEATURES = [
  { key: 'Overview',  icon: '▦',  label: 'Overview' },
  { key: 'Kanban',    icon: '⊞',  label: 'Kanban Board' },
  { key: 'Orders',    icon: '📋', label: 'Orders' },
  { key: 'Customers', icon: '👤', label: 'Customers' },
  { key: 'Services',  icon: '✦',  label: 'Services' },
  { key: 'Messaging', icon: '✉',  label: 'Messaging' },
  { key: 'FAQs',      icon: '❓', label: 'FAQs' },
  { key: 'Reports',   icon: '📊', label: 'Reports' },
];

const ALL_KEYS = FEATURES.map(f => f.key);
const btn = (bg, color, extra = {}) => ({ padding: '6px 14px', fontSize: 12, fontWeight: 500, borderRadius: 6, border: 'none', cursor: 'pointer', background: bg, color, ...extra });
const EMPTY_FORM = { name: '', email: '', password: '', role: 'staff', permissions: ALL_KEYS };

export default function Users() {
  const { user: me } = useAuth();
  const isSuperAdmin = me?.role === 'superadmin';
  const isAdmin = me?.role === 'admin' || isSuperAdmin;

  const [tenants, setTenants] = useState([]);
  const [selectedTenant, setSelectedTenant] = useState('');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [pwSection, setPwSection] = useState(false);
  const [newPw, setNewPw] = useState('');
  const [showPw, setShowPw] = useState(false);

  useEffect(() => {
    if (isSuperAdmin) {
      getTenants().then(({ data }) => {
        setTenants(data);
        if (data.length > 0) setSelectedTenant(data[0].id);
      });
    }
  }, [isSuperAdmin]);

  const activeTenantId = isSuperAdmin ? selectedTenant : me?.tenant_id;

  const load = async () => {
    if (!activeTenantId) { setLoading(false); return; }
    setLoading(true);
    try {
      const { data } = await getUsers(activeTenantId);
      setUsers(data.filter(u => u.role !== 'superadmin'));
    } catch { }
    setLoading(false);
  };

  useEffect(() => { load(); }, [activeTenantId]);

  const openAdd = () => { setForm({ ...EMPTY_FORM }); setPwSection(false); setNewPw(''); setModal('add'); };
  const openEdit = (u) => {
    let perms = [];
    try { perms = typeof u.permissions === 'string' ? JSON.parse(u.permissions) : (u.permissions || []); } catch { }
    setForm({ ...u, permissions: perms.length ? perms : ALL_KEYS, password: '' });
    setPwSection(false); setNewPw(''); setShowPw(false);
    setModal({ user: u });
  };

  const togglePerm = (key) => setForm(f => ({
    ...f,
    permissions: f.permissions.includes(key) ? f.permissions.filter(k => k !== key) : [...f.permissions, key],
  }));

  const save = async () => {
    if (!form.email) return alert('Email is required');
    if (modal === 'add' && !form.password) return alert('Password is required for new users');
    setSaving(true);
    try {
      const perms = form.role === 'admin' ? [] : form.permissions;
      const payload = { name: form.name, email: form.email, role: form.role, permissions: perms, tenant_id: activeTenantId };
      if (modal === 'add') {
        const { data } = await createUser({ ...payload, password: form.password });
        setUsers(prev => [data, ...prev]);
      } else {
        const { data } = await updateUser(modal.user.id, payload);
        setUsers(prev => prev.map(u => u.id === modal.user.id ? { ...u, ...data } : u));
        if (pwSection && newPw) {
          if (newPw.length < 6) { setSaving(false); return alert('Password must be at least 6 characters'); }
          await changePassword(modal.user.id, newPw);
        }
      }
      setModal(null);
    } catch (e) { alert(e.response?.data?.error || e.message); }
    setSaving(false);
  };

  const remove = async (u) => {
    if (!confirm(`Delete ${u.email}? This cannot be undone.`)) return;
    try { await deleteUser(u.id); setUsers(prev => prev.filter(x => x.id !== u.id)); }
    catch (e) { alert(e.response?.data?.error || e.message); }
  };

  const activeTenantName = isSuperAdmin ? tenants.find(t => t.id === selectedTenant)?.name || '' : me?.tenant_name || '';

  const permSummary = (u) => {
    try {
      const p = typeof u.permissions === 'string' ? JSON.parse(u.permissions) : (u.permissions || []);
      if (u.role === 'admin' || !p.length) return { label: 'Full access', color: '#2E7D32', bg: '#E6F5E9' };
      return { label: `${p.length}/${FEATURES.length} features`, color: '#1a7d94', bg: '#e6f5f8' };
    } catch { return { label: 'Full access', color: '#2E7D32', bg: '#E6F5E9' }; }
  };

  if (!isAdmin) return (
    <div style={{ textAlign: 'center', padding: '80px 20px', color: '#374151' }}>
      <div style={{ fontSize: 40 }}>🔒</div>
      <p style={{ marginTop: 12 }}>You don't have permission to manage users.</p>
    </div>
  );

  return (
    <div style={{ maxWidth: 860, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>👥 User Management</h2>
          <p style={{ fontSize: 12, color: '#374151', margin: '4px 0 0' }}>Control who can access which features per branch</p>
        </div>
        {activeTenantId && <button onClick={openAdd} style={btn('#38a9c2', '#fff')}>+ Add User</button>}
      </div>

      {isSuperAdmin && (
        <div style={{ marginBottom: 20, padding: '12px 16px', background: '#FAEEDA', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 12, fontWeight: 500, color: '#BA7517' }}>★ Branch:</span>
          <select value={selectedTenant} onChange={e => setSelectedTenant(e.target.value)}
            style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #E8C97A', fontSize: 13, background: '#fff', cursor: 'pointer' }}>
            {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
      )}

      <div style={{ background: '#fff', border: '1px solid #e8e8e0', borderRadius: 12, overflow: 'hidden' }}>
        {loading ? <div style={{ padding: '2rem', color: '#374151', fontSize: 13 }}>Loading…</div>
          : users.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: '#374151' }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>👤</div>
              <p style={{ fontSize: 14 }}>No users yet for {activeTenantName}</p>
              <button onClick={openAdd} style={{ ...btn('#38a9c2', '#fff'), marginTop: 12, padding: '9px 20px', fontSize: 13 }}>+ Add first user</button>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f7f9fc' }}>
                  {['Name', 'Email', 'Role', 'Feature Access', ''].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 500, fontSize: 11, color: '#374151', borderBottom: '1px solid #f0f0ec' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map(u => {
                  const ps = permSummary(u);
                  return (
                    <tr key={u.id} style={{ borderTop: '1px solid #f5f5f3' }}>
                      <td style={{ padding: '12px 14px', fontWeight: 500 }}>{u.name || '—'}</td>
                      <td style={{ padding: '12px 14px', color: '#374151' }}>{u.email}</td>
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: u.role === 'admin' ? '#e6f5f8' : '#f0f0ec', color: u.role === 'admin' ? '#1a7d94' : '#555', fontWeight: 500 }}>
                          {u.role}
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: ps.bg, color: ps.color, fontWeight: 500 }}>{ps.label}</span>
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={() => openEdit(u)} style={btn('#f0f2f5', '#333')}>✏️ Edit</button>
                          <button onClick={() => remove(u)} style={btn('#FDE8E8', '#A32D2D')}>🗑</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
      </div>

      {/* ── MODAL ── */}
      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
          onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div style={{ background: '#fff', borderRadius: 14, padding: 28, width: '100%', maxWidth: 540, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 60px rgba(0,0,0,.18)' }}>
            <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 600 }}>
              {modal === 'add' ? '+ Add User' : '✏️ Edit User'}
            </h3>
            <p style={{ margin: '0 0 20px', fontSize: 12, color: '#374151' }}>Branch: {activeTenantName}</p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#374151', marginBottom: 5 }}>Full Name</label>
                <input value={form.name || ''} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Maria Santos"
                  style={{ width: '100%', boxSizing: 'border-box', padding: '8px 12px', border: '1px solid #ddd', borderRadius: 6, fontSize: 13 }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#374151', marginBottom: 5 }}>Email</label>
                <input type="email" value={form.email || ''} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="user@email.com"
                  style={{ width: '100%', boxSizing: 'border-box', padding: '8px 12px', border: '1px solid #ddd', borderRadius: 6, fontSize: 13 }} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: modal === 'add' ? '1fr 1fr' : '1fr', gap: 12, marginBottom: 20 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#374151', marginBottom: 5 }}>Role</label>
                <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value, permissions: e.target.value === 'admin' ? [] : ALL_KEYS }))}
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid #ddd', borderRadius: 6, fontSize: 13, background: '#fff' }}>
                  <option value="admin">Admin — full access</option>
                  <option value="staff">Staff — restricted</option>
                </select>
              </div>
              {modal === 'add' && (
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#374151', marginBottom: 5 }}>Password</label>
                  <input type="password" value={form.password || ''} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="Min. 6 characters"
                    style={{ width: '100%', boxSizing: 'border-box', padding: '8px 12px', border: '1px solid #ddd', borderRadius: 6, fontSize: 13 }} />
                </div>
              )}
            </div>

            {/* Permissions */}
            {form.role === 'staff' && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#333' }}>🔒 Feature Access</label>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button type="button" onClick={() => setForm(f => ({ ...f, permissions: ALL_KEYS }))} style={btn('#E6F5E9', '#2E7D32', { fontSize: 11, padding: '3px 10px' })}>Allow All</button>
                    <button type="button" onClick={() => setForm(f => ({ ...f, permissions: [] }))} style={btn('#FDE8E8', '#A32D2D', { fontSize: 11, padding: '3px 10px' })}>Restrict All</button>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {FEATURES.map(feat => {
                    const on = form.permissions.includes(feat.key);
                    return (
                      <div key={feat.key} onClick={() => togglePerm(feat.key)} style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '10px 12px', borderRadius: 8, cursor: 'pointer',
                        border: `1.5px solid ${on ? '#38a9c2' : '#e8e8e0'}`,
                        background: on ? '#e6f5f8' : '#fafafa',
                      }}>
                        <div style={{ width: 18, height: 18, borderRadius: 4, flexShrink: 0, background: on ? '#38a9c2' : '#fff', border: `1.5px solid ${on ? '#38a9c2' : '#ccc'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {on && <span style={{ color: '#fff', fontSize: 11, fontWeight: 700 }}>✓</span>}
                        </div>
                        <span style={{ fontSize: 13 }}>{feat.icon}</span>
                        <span style={{ fontSize: 12, fontWeight: on ? 500 : 400, color: on ? '#1a7d94' : '#666' }}>{feat.label}</span>
                      </div>
                    );
                  })}
                </div>
                <p style={{ fontSize: 11, color: form.permissions.length === 0 ? '#E65100' : '#aaa', marginTop: 8 }}>
                  {form.permissions.length === 0 ? '⚠️ No features selected — user will see a blank dashboard' : `${form.permissions.length} of ${FEATURES.length} features enabled`}
                </p>
              </div>
            )}

            {form.role === 'admin' && (
              <div style={{ marginBottom: 20, padding: '10px 14px', background: '#E6F5E9', borderRadius: 8, fontSize: 12, color: '#2E7D32' }}>
                ✅ Admin role has <strong>full access</strong> to all features — no restrictions
              </div>
            )}

            {/* Change password (edit only) */}
            {modal !== 'add' && (
              <div style={{ marginBottom: 20, borderTop: '1px solid #f0f0f0', paddingTop: 16 }}>
                <button type="button" onClick={() => { setPwSection(s => !s); setNewPw(''); }}
                  style={btn(pwSection ? '#f0f2f5' : '#e6f5f8', pwSection ? '#555' : '#1a7d94', { width: '100%', padding: '8px' })}>
                  🔑 {pwSection ? 'Cancel password change' : 'Change password for this user'}
                </button>
                {pwSection && (
                  <div style={{ marginTop: 10, position: 'relative' }}>
                    <input type={showPw ? 'text' : 'password'} value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="New password (min. 6 characters)"
                      style={{ width: '100%', boxSizing: 'border-box', padding: '8px 36px 8px 12px', border: '1px solid #ddd', borderRadius: 6, fontSize: 13 }} />
                    <span onClick={() => setShowPw(s => !s)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', cursor: 'pointer', color: '#374151', fontSize: 13 }}>
                      {showPw ? '🙈' : '👁'}
                    </span>
                  </div>
                )}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setModal(null)} style={btn('#f0f2f5', '#333', { flex: 1 })}>Cancel</button>
              <button onClick={save} disabled={saving} style={btn('#38a9c2', '#fff', { flex: 2, opacity: saving ? 0.6 : 1 })}>
                {saving ? 'Saving…' : modal === 'add' ? 'Create User' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
