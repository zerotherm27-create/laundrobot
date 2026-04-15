import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { changeMyPassword } from '../api.js';

const NAV = [
  { key: 'Overview',  icon: '▦',  label: 'Overview' },
  { key: 'Kanban',    icon: '⊞',  label: 'Kanban Board' },
  { key: 'Orders',    icon: '📋', label: 'Orders' },
  { key: 'Customers', icon: '👤', label: 'Customers' },
  { key: 'Services',  icon: '✦',  label: 'Services' },
  { key: 'Messaging', icon: '✉',  label: 'Messaging' },
  { key: 'FAQs',      icon: '❓', label: 'FAQs' },
  { key: 'Reports',   icon: '📊', label: 'Reports' },
];

export default function Sidebar({ current, onNav, role }) {
  const { user, logout } = useAuth();
  const [pwOpen, setPwOpen] = useState(false);
  const [form, setForm] = useState({ current: '', newPw: '', confirm: '' });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [show, setShow] = useState(false);

  async function handleChangePw(e) {
    e.preventDefault();
    if (form.newPw.length < 6) return setMsg('New password must be at least 6 characters');
    if (form.newPw !== form.confirm) return setMsg('Passwords do not match');
    setSaving(true); setMsg('');
    try {
      await changeMyPassword(form.current, form.newPw);
      setMsg('✅ Password updated!');
      setTimeout(() => { setPwOpen(false); setForm({ current: '', newPw: '', confirm: '' }); setMsg(''); }, 1500);
    } catch (err) {
      setMsg('❌ ' + (err.response?.data?.error || 'Something went wrong'));
    }
    setSaving(false);
  }

  return (
    <>
      <aside style={{
        width: 220, minHeight: '100vh', background: '#fff',
        borderRight: '0.5px solid #e8e8e0', display: 'flex',
        flexDirection: 'column', padding: '1.25rem 0', flexShrink: 0,
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 1.25rem', marginBottom: '1.75rem' }}>
          <div style={{ width: 34, height: 34, borderRadius: 8, background: '#378ADD', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 500, fontSize: 18 }}>L</div>
          <div>
            <div style={{ fontWeight: 500, fontSize: 14 }}>LaundroBot</div>
            <div style={{ fontSize: 11, color: '#888', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 130 }}>
              {user?.tenant_name || 'Super Admin'}
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1 }}>
          {NAV.map(n => (
            <button key={n.key} onClick={() => onNav(n.key)} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              width: '100%', padding: '9px 1.25rem', fontSize: 13,
              background: current === n.key ? '#E6F1FB' : 'transparent',
              color: current === n.key ? '#185FA5' : '#555',
              border: 'none', cursor: 'pointer', textAlign: 'left',
              fontWeight: current === n.key ? 500 : 400,
              borderLeft: current === n.key ? '3px solid #378ADD' : '3px solid transparent',
            }}>
              <span style={{ fontSize: 14 }}>{n.icon}</span>
              {n.label}
            </button>
          ))}

          {role === 'superadmin' && (
            <button onClick={() => onNav('SuperAdmin')} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              width: '100%', padding: '9px 1.25rem', fontSize: 13,
              background: current === 'SuperAdmin' ? '#FAEEDA' : 'transparent',
              color: current === 'SuperAdmin' ? '#BA7517' : '#555',
              border: 'none', cursor: 'pointer', textAlign: 'left',
              fontWeight: current === 'SuperAdmin' ? 500 : 400,
              borderLeft: current === 'SuperAdmin' ? '3px solid #BA7517' : '3px solid transparent',
              marginTop: 8,
            }}>
              <span style={{ fontSize: 14 }}>★</span>
              Super Admin
            </button>
          )}
        </nav>

        {/* User info + logout */}
        <div style={{ padding: '1rem 1.25rem', borderTop: '0.5px solid #e8e8e0' }}>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {user?.email || 'admin'}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: role === 'superadmin' ? '#FAEEDA' : '#E6F1FB', color: role === 'superadmin' ? '#BA7517' : '#185FA5' }}>
              {role}
            </span>
            <button onClick={logout} style={{ fontSize: 12, color: '#A32D2D', background: 'none', border: 'none', cursor: 'pointer' }}>
              Sign out
            </button>
          </div>
          <button onClick={() => { setPwOpen(true); setMsg(''); }}
            style={{ width: '100%', fontSize: 11, color: '#888', background: 'none', border: '0.5px solid #e8e8e0', borderRadius: 5, padding: '4px 0', cursor: 'pointer' }}>
            🔑 Change my password
          </button>
        </div>
      </aside>

      {/* Change my password modal */}
      {pwOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500 }}
          onClick={e => e.target === e.currentTarget && setPwOpen(false)}>
          <div style={{ background: '#fff', borderRadius: 12, padding: '1.75rem', width: 360, boxShadow: '0 20px 60px rgba(0,0,0,.18)' }}>
            <h3 style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 600 }}>🔑 Change My Password</h3>
            <p style={{ margin: '0 0 20px', fontSize: 12, color: '#888' }}>{user?.email}</p>
            <form onSubmit={handleChangePw}>
              {[
                ['current', 'Current Password'],
                ['newPw', 'New Password'],
                ['confirm', 'Confirm New Password'],
              ].map(([f, label]) => (
                <div key={f} style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 4 }}>{label}</label>
                  <div style={{ position: 'relative' }}>
                    <input type={show ? 'text' : 'password'} value={form[f]}
                      onChange={e => setForm(p => ({ ...p, [f]: e.target.value }))} required
                      style={{ width: '100%', boxSizing: 'border-box', padding: '8px 36px 8px 12px', borderRadius: 7, border: '0.5px solid #ccc', fontSize: 13 }} />
                    {f === 'confirm' && (
                      <span onClick={() => setShow(s => !s)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', cursor: 'pointer', fontSize: 13, color: '#aaa' }}>
                        {show ? '🙈' : '👁'}
                      </span>
                    )}
                  </div>
                </div>
              ))}
              {msg && <div style={{ fontSize: 12, marginBottom: 12, color: msg.startsWith('✅') ? '#2E7D32' : '#A32D2D' }}>{msg}</div>}
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="submit" disabled={saving}
                  style={{ flex: 1, padding: 9, fontSize: 13, borderRadius: 6, background: saving ? '#aaa' : '#378ADD', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 500 }}>
                  {saving ? 'Saving...' : 'Update Password'}
                </button>
                <button type="button" onClick={() => setPwOpen(false)}
                  style={{ flex: 1, padding: 9, fontSize: 13, borderRadius: 6, background: 'transparent', border: '0.5px solid #ccc', color: '#666', cursor: 'pointer' }}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
