import { useEffect, useState } from 'react';
import { getTenants, createTenant, updateTenant, getUsers, createUser, deleteUser, changePassword } from '../api.js';

const emptyTenant = { name: '', fb_page_id: '', fb_page_access_token: '', xendit_api_key: '', admin_email: '', admin_password: '', active: true };
const emptyUser = { name: '', email: '', password: '', role: 'admin', tenant_id: '' };

const btn = (bg, color, extra = {}) => ({
  padding: '6px 14px', fontSize: 12, fontWeight: 500, borderRadius: 6,
  border: 'none', cursor: 'pointer', background: bg, color, ...extra,
});

export default function SuperAdmin() {
  const [tab, setTab] = useState('branches'); // 'branches' | 'users'
  const [tenants, setTenants] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Tenant form
  const [tenantForm, setTenantForm] = useState(null);
  const [savingTenant, setSavingTenant] = useState(false);

  // User form
  const [userForm, setUserForm] = useState(null);
  const [savingUser, setSavingUser] = useState(false);

  // Change password modal
  const [pwModal, setPwModal] = useState(null); // { user }
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [savingPw, setSavingPw] = useState(false);
  const [showPw, setShowPw] = useState(false);

  useEffect(() => {
    Promise.all([
      getTenants().then(r => setTenants(r.data)),
      getUsers().then(r => setUsers(r.data)),
    ]).finally(() => setLoading(false));
  }, []);

  // ── Tenant save ──
  async function handleSaveTenant() {
    setSavingTenant(true);
    try {
      if (tenantForm.isNew) {
        const { data } = await createTenant(tenantForm);
        setTenants(prev => [data, ...prev]);
      } else {
        const { data } = await updateTenant(tenantForm.id, tenantForm);
        setTenants(prev => prev.map(t => t.id === tenantForm.id ? data : t));
      }
      setTenantForm(null);
    } catch (err) { alert('Error: ' + (err.response?.data?.error || err.message)); }
    setSavingTenant(false);
  }

  // ── User save ──
  async function handleSaveUser() {
    if (!userForm.email || !userForm.password) return alert('Email and password are required');
    setSavingUser(true);
    try {
      const { data } = await createUser(userForm);
      setUsers(prev => [data, ...prev]);
      setUserForm(null);
    } catch (err) { alert('Error: ' + (err.response?.data?.error || err.message)); }
    setSavingUser(false);
  }

  // ── Change password ──
  async function handleChangePw() {
    if (!newPw) return alert('Enter a new password');
    if (newPw.length < 6) return alert('Password must be at least 6 characters');
    if (newPw !== confirmPw) return alert('Passwords do not match');
    setSavingPw(true);
    try {
      await changePassword(pwModal.user.id, newPw);
      setPwModal(null);
      setNewPw(''); setConfirmPw('');
      alert(`Password updated for ${pwModal.user.email}`);
    } catch (err) { alert('Error: ' + (err.response?.data?.error || err.message)); }
    setSavingPw(false);
  }

  async function handleDeleteUser(user) {
    if (!confirm(`Delete user ${user.email}? This cannot be undone.`)) return;
    try {
      await deleteUser(user.id);
      setUsers(prev => prev.filter(u => u.id !== user.id));
    } catch (err) { alert('Error: ' + (err.response?.data?.error || err.message)); }
  }

  const tenantName = (tid) => tenants.find(t => t.id === tid)?.name || '—';

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <h2 style={{ fontSize: 18, fontWeight: 500 }}>★ Super Admin</h2>
        {tab === 'branches' && (
          <button onClick={() => setTenantForm({ ...emptyTenant, isNew: true })}
            style={btn('#BA7517', '#fff')}>+ Add branch</button>
        )}
        {tab === 'users' && (
          <button onClick={() => setUserForm({ ...emptyUser, isNew: true })}
            style={btn('#378ADD', '#fff')}>+ Add user</button>
        )}
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: '1.5rem' }}>
        {[
          { label: 'Total branches', val: tenants.length, color: '#BA7517' },
          { label: 'Active branches', val: tenants.filter(t => t.active).length, color: '#1D9E75' },
          { label: 'Total users', val: users.length, color: '#378ADD' },
        ].map(m => (
          <div key={m.label} style={{ background: '#f5f5f3', borderRadius: 8, padding: '1rem' }}>
            <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>{m.label}</div>
            <div style={{ fontSize: 26, fontWeight: 500, color: m.color }}>{m.val}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
        {[['branches','🏢 Branches'], ['users','👤 Users']].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} style={{
            padding: '7px 18px', fontSize: 13, borderRadius: 6, border: 'none', cursor: 'pointer',
            background: tab === key ? '#BA7517' : '#f0f0ec',
            color: tab === key ? '#fff' : '#555',
            fontWeight: tab === key ? 500 : 400,
          }}>{label}</button>
        ))}
      </div>

      {/* ── BRANCHES TAB ── */}
      {tab === 'branches' && (
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
                      <button onClick={() => setTenantForm({ ...t, isNew: false })}
                        style={{ fontSize: 12, padding: '4px 12px', borderRadius: 5, cursor: 'pointer', background: 'transparent', border: '0.5px solid #ccc', color: '#666' }}>
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
                {tenants.length === 0 && (
                  <tr><td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: '#aaa', fontSize: 13 }}>No branches yet.</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── USERS TAB ── */}
      {tab === 'users' && (
        <div style={{ background: '#fff', border: '0.5px solid #e8e8e0', borderRadius: 12, overflow: 'hidden' }}>
          {loading ? <div style={{ padding: '2rem', color: '#aaa', fontSize: 14 }}>Loading...</div> : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f5f5f3' }}>
                  {['Name','Email','Role','Branch',''].map(h => (
                    <th key={h} style={{ padding: '9px 12px', textAlign: 'left', fontWeight: 500, fontSize: 12, color: '#888' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} style={{ borderTop: '0.5px solid #f0f0ec' }}>
                    <td style={{ padding: '10px 12px', fontWeight: 500 }}>{u.name || '—'}</td>
                    <td style={{ padding: '10px 12px', color: '#555' }}>{u.email}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 4, background: u.role === 'superadmin' ? '#FAEEDA' : '#E6F1FB', color: u.role === 'superadmin' ? '#BA7517' : '#185FA5' }}>
                        {u.role}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', color: '#888', fontSize: 12 }}>{u.tenant_id ? tenantName(u.tenant_id) : 'Super Admin'}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => { setPwModal({ user: u }); setNewPw(''); setConfirmPw(''); setShowPw(false); }}
                          style={btn('#E6F1FB', '#185FA5')}>🔑 Change Password</button>
                        {u.role !== 'superadmin' && (
                          <button onClick={() => handleDeleteUser(u)}
                            style={btn('#FDE8E8', '#A32D2D')}>🗑</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr><td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: '#aaa', fontSize: 13 }}>No users found.</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── CHANGE PASSWORD MODAL ── */}
      {pwModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}
          onClick={e => e.target === e.currentTarget && setPwModal(null)}>
          <div style={{ background: '#fff', borderRadius: 12, padding: '1.5rem', width: 380, border: '0.5px solid #e8e8e0' }}>
            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>🔑 Change Password</div>
            <div style={{ fontSize: 12, color: '#888', marginBottom: 20 }}>For: {pwModal.user.email}</div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 5 }}>New Password</label>
              <div style={{ position: 'relative' }}>
                <input type={showPw ? 'text' : 'password'} value={newPw} onChange={e => setNewPw(e.target.value)}
                  placeholder="At least 6 characters"
                  style={{ width: '100%', boxSizing: 'border-box', padding: '8px 36px 8px 12px', borderRadius: 8, border: '0.5px solid #ccc', fontSize: 13 }} />
                <span onClick={() => setShowPw(s => !s)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', cursor: 'pointer', fontSize: 14, color: '#888' }}>
                  {showPw ? '🙈' : '👁'}
                </span>
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 5 }}>Confirm Password</label>
              <input type={showPw ? 'text' : 'password'} value={confirmPw} onChange={e => setConfirmPw(e.target.value)}
                placeholder="Repeat new password"
                style={{ width: '100%', boxSizing: 'border-box', padding: '8px 12px', borderRadius: 8, border: '0.5px solid #ccc', fontSize: 13 }} />
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={handleChangePw} disabled={savingPw}
                style={{ flex: 1, padding: 9, fontSize: 13, borderRadius: 6, cursor: 'pointer', background: savingPw ? '#aaa' : '#378ADD', color: '#fff', border: 'none', fontWeight: 500 }}>
                {savingPw ? 'Saving...' : 'Update Password'}
              </button>
              <button onClick={() => setPwModal(null)}
                style={{ flex: 1, padding: 9, fontSize: 13, borderRadius: 6, cursor: 'pointer', background: 'transparent', border: '0.5px solid #ccc', color: '#666' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── ADD USER MODAL ── */}
      {userForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}
          onClick={e => e.target === e.currentTarget && setUserForm(null)}>
          <div style={{ background: '#fff', borderRadius: 12, padding: '1.5rem', width: 400, border: '0.5px solid #e8e8e0' }}>
            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 20 }}>+ Add User</div>
            {[['name','Full Name','text'],['email','Email','email'],['password','Password','password']].map(([f, l, t]) => (
              <div key={f} style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 4 }}>{l}</label>
                <input type={t} value={userForm[f] || ''} onChange={e => setUserForm(p => ({ ...p, [f]: e.target.value }))}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '7px 10px', fontSize: 13, borderRadius: 6, border: '0.5px solid #ccc' }} />
              </div>
            ))}
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 4 }}>Role</label>
              <select value={userForm.role} onChange={e => setUserForm(p => ({ ...p, role: e.target.value }))}
                style={{ width: '100%', padding: '7px 10px', fontSize: 13, borderRadius: 6, border: '0.5px solid #ccc' }}>
                <option value="admin">Admin</option>
                <option value="staff">Staff</option>
              </select>
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 4 }}>Branch</label>
              <select value={userForm.tenant_id} onChange={e => setUserForm(p => ({ ...p, tenant_id: e.target.value }))}
                style={{ width: '100%', padding: '7px 10px', fontSize: 13, borderRadius: 6, border: '0.5px solid #ccc' }}>
                <option value="">— Select branch —</option>
                {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={handleSaveUser} disabled={savingUser}
                style={{ flex: 1, padding: 9, fontSize: 13, borderRadius: 6, cursor: 'pointer', background: savingUser ? '#aaa' : '#378ADD', color: '#fff', border: 'none', fontWeight: 500 }}>
                {savingUser ? 'Saving...' : 'Create User'}
              </button>
              <button onClick={() => setUserForm(null)}
                style={{ flex: 1, padding: 9, fontSize: 13, borderRadius: 6, cursor: 'pointer', background: 'transparent', border: '0.5px solid #ccc', color: '#666' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── TENANT FORM MODAL ── */}
      {tenantForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: '1.5rem', width: 420, border: '0.5px solid #e8e8e0', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ fontWeight: 500, fontSize: 15, marginBottom: 16 }}>{tenantForm.isNew ? 'Add branch' : 'Edit branch'}</div>
            {[['name','Branch name','text'],['fb_page_id','Facebook Page ID','text'],['fb_page_access_token','Page Access Token','text'],['xendit_api_key','Xendit API Key','text']].map(([field, label, type]) => (
              <div key={field} style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, color: '#888', display: 'block', marginBottom: 4 }}>{label}</label>
                <input type={type} value={tenantForm[field] || ''} onChange={e => setTenantForm(p => ({ ...p, [field]: e.target.value }))}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '7px 10px', fontSize: 13, borderRadius: 6, border: '0.5px solid #ccc' }} />
              </div>
            ))}
            {tenantForm.isNew && (
              <>
                <div style={{ fontSize: 12, color: '#888', fontWeight: 500, margin: '14px 0 8px' }}>Admin account for this branch</div>
                {[['admin_email','Admin email','email'],['admin_password','Admin password','password']].map(([field, label, type]) => (
                  <div key={field} style={{ marginBottom: 12 }}>
                    <label style={{ fontSize: 12, color: '#888', display: 'block', marginBottom: 4 }}>{label}</label>
                    <input type={type} value={tenantForm[field] || ''} onChange={e => setTenantForm(p => ({ ...p, [field]: e.target.value }))}
                      style={{ width: '100%', boxSizing: 'border-box', padding: '7px 10px', fontSize: 13, borderRadius: 6, border: '0.5px solid #ccc' }} />
                  </div>
                ))}
              </>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <input type="checkbox" id="activeT" checked={tenantForm.active} onChange={e => setTenantForm(p => ({ ...p, active: e.target.checked }))} />
              <label htmlFor="activeT" style={{ fontSize: 13, cursor: 'pointer' }}>Branch active</label>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={handleSaveTenant} disabled={savingTenant}
                style={{ flex: 1, padding: '8px', fontSize: 13, borderRadius: 6, cursor: 'pointer', background: '#BA7517', color: '#fff', border: 'none', fontWeight: 500 }}>
                {savingTenant ? 'Saving...' : 'Save branch'}
              </button>
              <button onClick={() => setTenantForm(null)}
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
