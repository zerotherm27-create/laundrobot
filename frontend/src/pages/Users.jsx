import { useEffect, useState } from 'react';
import { getUsers, createUser, updateUser, deleteUser } from '../api.js';
import { Avatar } from '../components/Avatar.jsx';

const ALL_PERMISSIONS = [
  { key: 'view_dashboard',   label: 'View Overview',       group: 'Dashboard' },
  { key: 'view_kanban',      label: 'View Kanban Board',   group: 'Dashboard' },
  { key: 'manage_orders',    label: 'Manage Orders',       group: 'Orders' },
  { key: 'update_status',    label: 'Update Order Status', group: 'Orders' },
  { key: 'delete_orders',    label: 'Delete Orders',       group: 'Orders' },
  { key: 'view_customers',   label: 'View Customers',      group: 'Customers' },
  { key: 'manage_services',  label: 'Manage Services',     group: 'Services' },
  { key: 'view_reports',     label: 'View Reports',        group: 'Reports' },
  { key: 'export_reports',   label: 'Export Reports',      group: 'Reports' },
  { key: 'send_messages',    label: 'Send Blast Messages', group: 'Messaging' },
  { key: 'manage_users',     label: 'Manage Users',        group: 'Users' },
];

const ROLE_PRESETS = {
  admin: ALL_PERMISSIONS.map(p => p.key),
  manager: ['view_dashboard','view_kanban','manage_orders','update_status','view_customers','view_reports','send_messages'],
  staff: ['view_kanban','update_status','view_customers'],
  viewer: ['view_dashboard','view_kanban','view_customers','view_reports'],
};

const ROLE_COLORS = {
  superadmin: { bg: '#FAEEDA', color: '#BA7517' },
  admin:      { bg: '#EEEDFE', color: '#534AB7' },
  manager:    { bg: '#E6F1FB', color: '#185FA5' },
  staff:      { bg: '#EAF3DE', color: '#3B6D11' },
  viewer:     { bg: '#f0f0ec', color: '#888' },
};

const empty = { name: '', email: '', password: '', role: 'staff', permissions: ROLE_PRESETS.staff };

export default function Users() {
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    getUsers().then(r => { setUsers(r.data); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  function applyPreset(role) {
    setForm(p => ({ ...p, role, permissions: ROLE_PRESETS[role] || [] }));
  }

  function togglePermission(key) {
    setForm(p => ({
      ...p,
      permissions: p.permissions.includes(key)
        ? p.permissions.filter(k => k !== key)
        : [...p.permissions, key],
    }));
  }

  async function handleSave() {
    if (!form.email) return alert('Email is required.');
    if (form.isNew && !form.password) return alert('Password is required.');
    setSaving(true);
    try {
      if (form.isNew) {
        const { data } = await createUser(form);
        setUsers(prev => [data, ...prev]);
      } else {
        const { data } = await updateUser(form.id, form);
        setUsers(prev => prev.map(u => u.id === form.id ? data : u));
      }
      setForm(null);
    } catch (err) {
      alert('Error: ' + (err.response?.data?.error || err.message));
    } finally { setSaving(false); }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this user?')) return;
    await deleteUser(id);
    setUsers(prev => prev.filter(u => u.id !== id));
    setForm(null);
  }

  const filtered = users.filter(u =>
    u.email?.toLowerCase().includes(search.toLowerCase()) ||
    u.name?.toLowerCase().includes(search.toLowerCase())
  );

  // Group permissions by group
  const groups = [...new Set(ALL_PERMISSIONS.map(p => p.group))];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <h2 style={{ fontSize: 18, fontWeight: 500 }}>Users & Permissions</h2>
        <button onClick={() => setForm({ ...empty, isNew: true })}
          style={{ padding: '7px 16px', fontSize: 13, borderRadius: 6, cursor: 'pointer', background: '#378ADD', color: '#fff', border: 'none', fontWeight: 500 }}>
          + Add user
        </button>
      </div>

      <input value={search} onChange={e => setSearch(e.target.value)}
        placeholder="Search by name or email..."
        style={{ padding: '6px 12px', fontSize: 13, borderRadius: 6, border: '0.5px solid #ccc', width: 260, marginBottom: 14 }} />

      <div style={{ background: '#fff', border: '0.5px solid #e8e8e0', borderRadius: 12, overflow: 'hidden' }}>
        {loading ? <div style={{ padding: '2rem', color: '#aaa', fontSize: 14 }}>Loading...</div> : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f5f5f3' }}>
                {['User','Email','Role','Permissions',''].map(h => (
                  <th key={h} style={{ padding: '9px 12px', textAlign: 'left', fontWeight: 500, fontSize: 12, color: '#888' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(u => {
                const rc = ROLE_COLORS[u.role] || ROLE_COLORS.viewer;
                return (
                  <tr key={u.id} style={{ borderTop: '0.5px solid #f0f0ec' }}>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Avatar name={u.name || u.email || '?'} size={30} bg={rc.bg} color={rc.color} />
                        <span style={{ fontWeight: 500 }}>{u.name || '—'}</span>
                      </div>
                    </td>
                    <td style={{ padding: '10px 12px', color: '#666' }}>{u.email}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: rc.bg, color: rc.color, fontWeight: 500 }}>
                        {u.role}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {(u.permissions || []).slice(0, 3).map(p => {
                          const perm = ALL_PERMISSIONS.find(x => x.key === p);
                          return perm ? (
                            <span key={p} style={{ fontSize: 10, padding: '1px 6px', borderRadius: 3, background: '#f0f0ec', color: '#666' }}>
                              {perm.label}
                            </span>
                          ) : null;
                        })}
                        {(u.permissions || []).length > 3 && (
                          <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 3, background: '#f0f0ec', color: '#888' }}>
                            +{u.permissions.length - 3} more
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <button onClick={() => setForm({ ...u, isNew: false, password: '' })}
                        style={{ fontSize: 12, padding: '4px 12px', borderRadius: 5, cursor: 'pointer', background: 'transparent', border: '0.5px solid #ccc', color: '#666' }}>
                        Edit
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: '#aaa', fontSize: 13 }}>No users found</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      {form && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: '1.5rem', width: 500, border: '0.5px solid #e8e8e0', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ fontWeight: 500, fontSize: 15, marginBottom: 16 }}>{form.isNew ? 'Add user' : 'Edit user'}</div>

            {/* Basic info */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              {[['name','Full name','text'],['email','Email','email']].map(([field, label, type]) => (
                <div key={field}>
                  <label style={{ fontSize: 12, color: '#888', display: 'block', marginBottom: 4 }}>{label}</label>
                  <input type={type} value={form[field] || ''} onChange={e => setForm(p => ({ ...p, [field]: e.target.value }))}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '7px 10px', fontSize: 13, borderRadius: 6, border: '0.5px solid #ccc' }} />
                </div>
              ))}
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, color: '#888', display: 'block', marginBottom: 4 }}>
                {form.isNew ? 'Password' : 'New password (leave blank to keep current)'}
              </label>
              <input type="password" value={form.password || ''} onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                style={{ width: '100%', boxSizing: 'border-box', padding: '7px 10px', fontSize: 13, borderRadius: 6, border: '0.5px solid #ccc' }} />
            </div>

            {/* Role presets */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, color: '#888', display: 'block', marginBottom: 8 }}>Role preset</label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {Object.keys(ROLE_PRESETS).map(role => {
                  const rc = ROLE_COLORS[role] || ROLE_COLORS.viewer;
                  return (
                    <button key={role} onClick={() => applyPreset(role)} style={{
                      padding: '5px 12px', fontSize: 12, borderRadius: 5, cursor: 'pointer',
                      background: form.role === role ? rc.color : rc.bg,
                      color: form.role === role ? '#fff' : rc.color,
                      border: '0.5px solid ' + rc.color,
                      fontWeight: form.role === role ? 500 : 400,
                    }}>{role}</button>
                  );
                })}
              </div>
            </div>

            {/* Permissions */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, color: '#888', display: 'block', marginBottom: 8 }}>
                Permissions — {form.permissions?.length || 0} selected
              </label>
              {groups.map(group => (
                <div key={group} style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 500, color: '#888', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>{group}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {ALL_PERMISSIONS.filter(p => p.group === group).map(perm => {
                      const active = form.permissions?.includes(perm.key);
                      return (
                        <button key={perm.key} onClick={() => togglePermission(perm.key)} style={{
                          padding: '4px 10px', fontSize: 12, borderRadius: 4, cursor: 'pointer',
                          background: active ? '#378ADD' : '#f5f5f3',
                          color: active ? '#fff' : '#666',
                          border: '0.5px solid ' + (active ? '#378ADD' : '#ccc'),
                        }}>{perm.label}</button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={handleSave} disabled={saving}
                style={{ flex: 1, padding: '8px', fontSize: 13, borderRadius: 6, cursor: 'pointer', background: '#378ADD', color: '#fff', border: 'none', fontWeight: 500 }}>
                {saving ? 'Saving...' : 'Save user'}
              </button>
              <button onClick={() => setForm(null)}
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