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
  { key: 'Users',     icon: '👥', label: 'Users', adminOnly: true },
];

export default function Sidebar({ current, onNav, role }) {
  const { user, logout } = useAuth();
  const [pwOpen,  setPwOpen]  = useState(false);
  const [form,    setForm]    = useState({ current: '', newPw: '', confirm: '' });
  const [saving,  setSaving]  = useState(false);
  const [msg,     setMsg]     = useState('');
  const [show,    setShow]    = useState(false);

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

  const visibleNav = NAV.filter(n => {
    if (n.adminOnly && role === 'staff') return false;
    if (role === 'staff' && user?.permissions?.length > 0) return user.permissions.includes(n.key);
    return true;
  });

  return (
    <>
      <aside style={{
        width: 230, minHeight: '100vh', background: '#fff',
        borderRight: '0.5px solid #E8E8E0', display: 'flex',
        flexDirection: 'column', flexShrink: 0,
        position: 'sticky', top: 0, height: '100vh', overflowY: 'auto',
      }}>
        {/* ── Logo ── */}
        <div style={{ padding: '1.25rem 1.25rem 1rem', borderBottom: '0.5px solid #F0F0EC' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'linear-gradient(135deg, #378ADD, #2568BC)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontWeight: 700, fontSize: 18,
              boxShadow: '0 2px 8px rgba(55,138,221,.3)',
              flexShrink: 0,
            }}>L</div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#111827', letterSpacing: '-.2px' }}>LaundroBot</div>
              <div style={{ fontSize: 11, color: '#9CA3AF', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 140 }}>
                {user?.tenant_name || 'Super Admin'}
              </div>
            </div>
          </div>
        </div>

        {/* ── Nav ── */}
        <nav style={{ flex: 1, padding: '8px 0' }}>
          <div style={{ padding: '4px 1.25rem 6px', fontSize: 10, fontWeight: 600, color: '#9CA3AF', letterSpacing: '.08em', textTransform: 'uppercase' }}>
            Navigation
          </div>

          {visibleNav.map(n => (
            <button
              key={n.key}
              onClick={() => onNav(n.key)}
              className={`nav-item${current === n.key ? ' active' : ''}`}
            >
              <span style={{ fontSize: 14, width: 18, textAlign: 'center', flexShrink: 0 }}>{n.icon}</span>
              {n.label}
            </button>
          ))}

          {role === 'superadmin' && (
            <>
              <div style={{ margin: '10px 1.25rem 6px', borderTop: '0.5px solid #F0F0EC' }} />
              <div style={{ padding: '0 1.25rem 6px', fontSize: 10, fontWeight: 600, color: '#9CA3AF', letterSpacing: '.08em', textTransform: 'uppercase' }}>
                Administration
              </div>
              <button
                onClick={() => onNav('SuperAdmin')}
                className={`nav-item nav-item-super${current === 'SuperAdmin' ? ' active' : ''}`}
              >
                <span style={{ fontSize: 14, width: 18, textAlign: 'center' }}>★</span>
                Super Admin
              </button>
            </>
          )}
        </nav>

        {/* ── User section ── */}
        <div style={{ padding: '0.875rem 1.25rem', borderTop: '0.5px solid #E8E8E0' }}>
          {/* Role badge + sign out */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{
              fontSize: 10, padding: '3px 8px', borderRadius: 20, fontWeight: 600,
              background: role === 'superadmin' ? '#FDF3E3' : role === 'admin' ? '#E6F1FB' : '#F0F0EC',
              color: role === 'superadmin' ? '#BA7517' : role === 'admin' ? '#185FA5' : '#555',
              textTransform: 'uppercase', letterSpacing: '.05em',
            }}>
              {role}
            </span>
            <button onClick={logout}
              style={{ fontSize: 11, color: '#A32D2D', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}>
              Sign out
            </button>
          </div>

          {/* Email */}
          <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {user?.email}
          </div>

          {/* Change password */}
          <button onClick={() => { setPwOpen(true); setMsg(''); }}
            style={{
              width: '100%', fontSize: 11, color: '#6B7280', background: '#F7F7F5',
              border: '0.5px solid #E8E8E0', borderRadius: 7, padding: '6px 0',
              cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500,
              transition: 'background .15s, color .15s',
            }}
            onMouseEnter={e => { e.target.style.background = '#EEEDE9'; e.target.style.color = '#374151'; }}
            onMouseLeave={e => { e.target.style.background = '#F7F7F5'; e.target.style.color = '#6B7280'; }}>
            🔑 Change my password
          </button>
        </div>
      </aside>

      {/* ── Change Password Modal ── */}
      {pwOpen && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setPwOpen(false)}>
          <div className="modal-card" style={{ width: 380, padding: '1.75rem' }}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>🔑 Change My Password</div>
            <p style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 22 }}>{user?.email}</p>

            <form onSubmit={handleChangePw}>
              {[['current', 'Current Password'], ['newPw', 'New Password'], ['confirm', 'Confirm New Password']].map(([f, label]) => (
                <div key={f} style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 12, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 5 }}>{label}</label>
                  <div style={{ position: 'relative' }}>
                    <input type={show ? 'text' : 'password'} value={form[f]}
                      onChange={e => setForm(p => ({ ...p, [f]: e.target.value }))} required
                      style={{ width: '100%', boxSizing: 'border-box', padding: '9px 36px 9px 12px', borderRadius: 8, border: '0.5px solid #D1D5DB', fontSize: 13, fontFamily: 'inherit' }} />
                    {f === 'confirm' && (
                      <span onClick={() => setShow(s => !s)}
                        style={{ position: 'absolute', right: 11, top: '50%', transform: 'translateY(-50%)', cursor: 'pointer', fontSize: 14, color: '#9CA3AF' }}>
                        {show ? '🙈' : '👁'}
                      </span>
                    )}
                  </div>
                </div>
              ))}

              {msg && (
                <div style={{ fontSize: 12, marginBottom: 14, padding: '8px 12px', borderRadius: 7, background: msg.startsWith('✅') ? '#EAF3DE' : '#FCEBEB', color: msg.startsWith('✅') ? '#3B6D11' : '#A32D2D' }}>
                  {msg}
                </div>
              )}

              <div style={{ display: 'flex', gap: 8 }}>
                <button type="submit" disabled={saving}
                  className="btn-primary"
                  style={{ flex: 1, justifyContent: 'center', padding: '9px', borderRadius: 8 }}>
                  {saving ? <><span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Saving…</> : 'Update Password'}
                </button>
                <button type="button" onClick={() => setPwOpen(false)}
                  className="btn-ghost" style={{ flex: 1, justifyContent: 'center', padding: '9px', borderRadius: 8 }}>
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
