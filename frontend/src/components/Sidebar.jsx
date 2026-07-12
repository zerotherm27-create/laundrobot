import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { changeMyPassword } from '../api.js';
import { Icon } from './Icons.jsx';
import { usePlan } from '../context/UpgradeContext.jsx';
import { useModalA11y } from '../hooks/useModalA11y.js';

const NAV = [
  { key: 'Overview',      iconName: 'overview',   label: 'Overview' },
  { key: 'Kanban',        iconName: 'kanban',     label: 'Kanban Board' },
  { key: 'Orders',        iconName: 'orders',     label: 'Orders' },
  { key: 'Customers',     iconName: 'customers',  label: 'Customers' },
  { key: 'Services',      iconName: 'services',   label: 'Services' },
  { key: 'Messaging',     iconName: 'messaging',  label: 'Messaging' },
  { key: 'FAQs',          iconName: 'faqs',       label: 'FAQs' },
  { key: 'WalkIn',        iconName: 'walkin',     label: 'Walk In' },
  { key: 'DeliveryZones', iconName: 'delivery',   label: 'Delivery Zones' },
  { key: 'Reports',       iconName: 'reports',    label: 'Reports' },
  { key: 'Finance',       iconName: 'finance',    label: 'Finance', adminOnly: true },
  { key: 'Inventory',     iconName: 'inventory',  label: 'Inventory', adminOnly: true },
  { key: 'Users',         iconName: 'users',      label: 'Users', adminOnly: true },
  { key: 'Branches',      iconName: 'package',    label: 'Branches', adminOnly: true },
  { key: 'Settings',      iconName: 'settings',   label: 'Settings' },
];

// Sub-groups for the nav list — same 14 keys as NAV, just chunked so no single
// group exceeds ~5 items (cognitive-load guideline: ≤4-7 items per group).
const NAV_GROUPS = [
  { label: 'Operations',        keys: ['Overview', 'Kanban', 'Orders', 'Customers', 'WalkIn'] },
  { label: 'Setup',             keys: ['Services', 'DeliveryZones', 'Messaging', 'FAQs'] },
  { label: 'Insights & Admin',  keys: ['Reports', 'Finance', 'Inventory', 'Users', 'Branches', 'Settings'] },
];

const GUIDE_STEPS = [
  {
    num: '1', title: 'Configure Your Shop',
    body: 'Settings → fill in your logo, contact number, shop address, store hours, open days, and minimum order amount. Click "Save Settings".',
  },
  {
    num: '2', title: 'Connect Your Facebook Page',
    body: 'Settings → "Connect Facebook Page" → click the blue button → log in → select your Page → "Save & Connect". The Messenger bot and menu are set up automatically.',
  },
  {
    num: '3', title: 'Add Services & Pricing',
    body: 'Services → create categories (e.g. Wash & Dry) then add each service with its name, price, and unit (per kg / per piece).',
  },
  {
    num: '4', title: 'Enable Online Payments',
    body: 'Settings → Online Payment Method → choose Xendit (automated) or QR Code (manual). For Xendit, paste your API key from xendit.co → Developers → API Keys.',
  },
  {
    num: '5', title: 'Set Up Delivery Zones',
    body: 'Delivery Zones → add flat-fee zones by barangay, or set distance brackets (0–5 km = ₱50, 5–10 km = ₱100, etc.). You can use both together.',
  },
  {
    num: '6', title: 'Enable the AI Chatbot',
    body: 'Settings → "AI Messenger Replies" → toggle ON. The AI answers customer questions 24/7 in Tagalog, English, and Taglish using your FAQs and service list.',
  },
  {
    num: '7', title: 'Add FAQs',
    body: 'FAQs → add common questions and answers. Click "AI Suggest" to auto-generate FAQs from past conversations.',
  },
  {
    num: '8', title: 'Invite Your Staff',
    body: 'Users → "+ Invite Staff" → enter their email. Staff can manage orders on the Kanban board right away.',
  },
  {
    num: '9', title: 'Test the Bot',
    body: 'Go to your Facebook Page → "Send Message" → tap "Get Started" or send any message. You should see the welcome menu with Book Now, My Orders, and FAQs. Try placing a test order.',
  },
  {
    num: '10', title: 'Connect Instagram DMs (Optional)',
    body: 'Settings → "Instagram Messaging" → paste your Instagram Business Account ID → Save. Requires Meta App Review — contact hello@laundrobot.app if not working.',
  },
  {
    num: '11', title: 'Custom Domain & White Label (Pro)',
    body: 'Settings → "Custom Domain & White Label" → enter your domain (e.g. book.yourshop.com) → add a CNAME record pointing to cname.vercel-dns.com → email hello@laundrobot.app to activate.',
  },
];

export default function Sidebar({ current, onNav, role, open = false, onClose = () => {} }) {
  const { isPro } = usePlan();
  const { user, logout, branches, branchLimit, switchToBranch } = useAuth();
  const [pwOpen,         setPwOpen]         = useState(false);
  const [guideOpen,      setGuideOpen]      = useState(false);
  const pwModalRef    = useModalA11y(() => setPwOpen(false), pwOpen);
  const guideModalRef = useModalA11y(() => setGuideOpen(false), guideOpen);
  const [form,           setForm]           = useState({ current: '', newPw: '', confirm: '' });
  const [saving,         setSaving]         = useState(false);
  const [msg,            setMsg]            = useState('');
  const [show,           setShow]           = useState(false);
  const [branchDropOpen, setBranchDropOpen] = useState(false);
  const branchDropRef = useRef(null);

  useEffect(() => {
    if (!branchDropOpen) return;
    function handleClick(e) {
      if (branchDropRef.current && !branchDropRef.current.contains(e.target)) {
        setBranchDropOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [branchDropOpen]);

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
    // Users page is always admin-only — never grant to staff
    if (n.key === 'Users' && role === 'staff') return false;
    // Other adminOnly items can be explicitly granted via permissions
    if (n.adminOnly && role === 'staff' && !(user?.permissions || []).includes(n.key)) return false;
    if (role === 'staff' && user?.permissions?.length > 0) return user.permissions.includes(n.key);
    return true;
  });

  return (
    <>
      {/* Mobile backdrop */}
      <div className={`sidebar-mobile-overlay${open ? ' open' : ''}`} onClick={onClose} />

      <aside className={`sidebar-drawer${open ? ' open' : ''}`} style={{
        width: 230, minHeight: '100vh', background: '#fff',
        borderRight: '0.5px solid #E8E8E0', display: 'flex',
        flexDirection: 'column', flexShrink: 0,
        position: 'sticky', top: 0, height: '100vh', overflowY: 'auto',
      }}>
        {/* ── Logo + mobile close button ── */}
        <div style={{ padding: '1.25rem 1.25rem 1rem', borderBottom: '0.5px solid #F0F0EC' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img src="/logo.png" alt="LaundroBot" style={{
              width: 36, height: 36, borderRadius: 6,
              objectFit: 'contain',
              flexShrink: 0,
              background: '#fff',
            }} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#111827', letterSpacing: '-.2px' }}>LaundroBot</div>
              <div style={{ fontSize: 11, color: '#374151', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 140 }}>
                {user?.tenant_name || 'Super Admin'}
              </div>
            </div>
            {/* Close button — only visible on mobile (CSS hides on desktop) */}
            <button className="hamburger-btn" onClick={onClose} aria-label="Close menu"
              style={{ fontSize: 18, color: '#6B7280', padding: 4 }}>
              ✕
            </button>
          </div>
        </div>

        {/* ── Branch Switcher ── */}
        {branches.length > 1 && (
          <div ref={branchDropRef} style={{ padding: '8px 12px', borderBottom: '0.5px solid #F0F0EC', position: 'relative' }}>
            <button
              onClick={() => setBranchDropOpen(o => !o)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: '#F7F7F5', border: '0.5px solid #E8E8E0', borderRadius: 8,
                padding: '7px 10px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12,
                color: '#374151', fontWeight: 500,
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#38a9c2', flexShrink: 0 }} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {user?.tenant_name || 'Branch'}
                </span>
              </span>
              <span style={{ fontSize: 10, color: '#6B7280', flexShrink: 0 }}>{branchDropOpen ? '▲' : '▼'}</span>
            </button>

            {branchDropOpen && (
              <div style={{
                position: 'absolute', top: '100%', left: 12, right: 12,
                background: '#fff', border: '0.5px solid #E8E8E0', borderRadius: 8,
                boxShadow: '0 4px 12px rgba(0,0,0,.08)', zIndex: 50, overflow: 'hidden',
              }}>
                {branches.map(b => (
                  <button
                    key={b.id}
                    onClick={() => { setBranchDropOpen(false); if (b.id !== user?.tenant_id) switchToBranch(b.id); }}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                      padding: '8px 12px', background: b.id === user?.tenant_id ? '#F0F9FF' : 'transparent',
                      border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12,
                      color: b.id === user?.tenant_id ? '#0369A1' : '#374151', textAlign: 'left',
                      borderBottom: '0.5px solid #F0F0EC',
                    }}
                  >
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: b.id === user?.tenant_id ? '#38a9c2' : '#D1D5DB', flexShrink: 0 }} />
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.name}</span>
                    {b.id === user?.tenant_id && <span style={{ fontSize: 10, color: '#38a9c2' }}>✓</span>}
                  </button>
                ))}
                {(role === 'admin' || role === 'superadmin') && (
                  <button
                    onClick={() => { setBranchDropOpen(false); onNav('Branches'); }}
                    disabled={branches.length >= branchLimit}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                      padding: '8px 12px', background: 'transparent', border: 'none',
                      cursor: branches.length >= branchLimit ? 'not-allowed' : 'pointer',
                      fontFamily: 'inherit', fontSize: 12,
                      color: branches.length >= branchLimit ? '#6B7280' : '#38a9c2',
                      fontWeight: 600, textAlign: 'left',
                    }}
                  >
                    + Add Branch
                    {branches.length >= branchLimit && <span style={{ fontSize: 10, opacity: 0.7 }}>🔒</span>}
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Nav ── */}
        <nav style={{ flex: 1, padding: '8px 0' }}>
          {NAV_GROUPS.map(group => {
            const items = group.keys
              .map(k => visibleNav.find(n => n.key === k))
              .filter(Boolean);
            if (!items.length) return null;
            return (
              <div key={group.label}>
                <div style={{ padding: '10px 1.25rem 6px', fontSize: 10, fontWeight: 600, color: '#374151', letterSpacing: '.08em', textTransform: 'uppercase' }}>
                  {group.label}
                </div>
                {items.map(n => (
                  <button
                    key={n.key}
                    onClick={() => onNav(n.key)}
                    className={`nav-item${current === n.key ? ' active' : ''}`}
                  >
                    <Icon name={n.iconName} size={15} color={current === n.key ? 'var(--primary)' : '#6B7280'} style={{ width: 18, flexShrink: 0 }} />
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      {n.label}
                      {n.key === 'Finance' && !isPro && role !== 'superadmin' && (
                        <span style={{ fontSize: 10, opacity: 0.55 }}>🔒</span>
                      )}
                    </span>
                  </button>
                ))}
              </div>
            );
          })}

          {/* Setup Guide */}
          <div style={{ margin: '8px 12px 4px' }}>
            <button onClick={() => setGuideOpen(true)}
              className="nav-item"
              style={{ width: '100%', background: '#F0FAF5', border: '1px solid #BBF7D0', borderRadius: 8, color: '#15803D', fontWeight: 600 }}>
              <Icon name="info" size={15} color="#15803D" style={{ width: 18, flexShrink: 0 }} />
              Setup Guide
            </button>
          </div>

          {role === 'superadmin' && (
            <>
              <div style={{ margin: '10px 1.25rem 6px', borderTop: '0.5px solid #F0F0EC' }} />
              <div style={{ padding: '0 1.25rem 6px', fontSize: 10, fontWeight: 600, color: '#374151', letterSpacing: '.08em', textTransform: 'uppercase' }}>
                Administration
              </div>
              <button
                onClick={() => onNav('SuperAdmin')}
                className={`nav-item nav-item-super${current === 'SuperAdmin' ? ' active' : ''}`}
              >
                <Icon name="superadmin" size={15} color={current === 'SuperAdmin' ? '#38a9c2' : '#6B7280'} style={{ width: 18, flexShrink: 0 }} />
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
              background: role === 'superadmin' ? '#FDF3E3' : role === 'admin' ? '#e6f5f8' : '#F0F0EC',
              color: role === 'superadmin' ? '#BA7517' : role === 'admin' ? '#1a7d94' : '#555',
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
          <div style={{ fontSize: 12, color: '#374151', marginBottom: 8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {user?.email}
          </div>

          {/* Change password */}
          <button onClick={() => { setPwOpen(true); setMsg(''); }}
            style={{
              width: '100%', fontSize: 11, color: '#374151', background: '#F7F7F5',
              border: '0.5px solid #E8E8E0', borderRadius: 7, padding: '6px 0',
              cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500,
              transition: 'background .15s, color .15s',
            }}
            onMouseEnter={e => { e.target.style.background = '#EEEDE9'; e.target.style.color = '#374151'; }}
            onMouseLeave={e => { e.target.style.background = '#F7F7F5'; e.target.style.color = '#6B7280'; }}>
            <Icon name="key" size={13} color="#6B7280" style={{ marginRight: 5 }} /> Change my password
          </button>
        </div>
      </aside>

      {/* ── Setup Guide Panel ── */}
      {guideOpen && (
        <div onClick={() => setGuideOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.35)', zIndex: 200, display: 'flex', justifyContent: 'flex-end' }}>
          <div ref={guideModalRef} role="dialog" aria-modal="true" aria-label="Setup Guide" tabIndex={-1} onClick={e => e.stopPropagation()}
            style={{ width: '100%', maxWidth: 480, height: '100%', background: '#fff', display: 'flex', flexDirection: 'column',
              boxShadow: '-4px 0 24px rgba(0,0,0,.12)', animation: 'slideInRight .22s ease', outline: 'none' }}>

            {/* Header */}
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '0.5px solid #E8E8E0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16, color: '#111827', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Icon name="info" size={16} color="#15803D" /> Setup Guide
                </div>
                <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>Follow these steps to get fully set up</div>
              </div>
              <button onClick={() => setGuideOpen(false)}
                style={{ background: '#F3F4F6', border: 'none', borderRadius: '50%', width: 32, height: 32, cursor: 'pointer', fontSize: 18, color: '#6B7280', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                ×
              </button>
            </div>

            {/* Steps */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem 1.5rem' }}>
              {GUIDE_STEPS.map((step, i) => (
                <div key={step.num} style={{ display: 'flex', gap: 14, marginBottom: i < GUIDE_STEPS.length - 1 ? 20 : 0 }}>
                  {/* Step number + connector line */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#ECFDF5', border: '1.5px solid #6EE7B7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#047857' }}>
                      {step.num}
                    </div>
                    {i < GUIDE_STEPS.length - 1 && (
                      <div style={{ width: 1.5, flex: 1, background: '#D1FAE5', marginTop: 4 }} />
                    )}
                  </div>
                  {/* Content */}
                  <div style={{ paddingBottom: i < GUIDE_STEPS.length - 1 ? 20 : 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: '#111827', marginBottom: 4 }}>{step.title}</div>
                    <div style={{ fontSize: 12, color: '#6B7280', lineHeight: 1.6 }}>{step.body}</div>
                  </div>
                </div>
              ))}

              {/* Footer */}
              <div style={{ marginTop: 24, padding: '14px 16px', borderRadius: 10, background: '#F0F9FF', border: '0.5px solid #BAE6FD', fontSize: 12, color: '#0369A1', lineHeight: 1.6 }}>
                Need help? Email <strong>hello@laundrobot.app</strong> and we'll get you set up.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Change Password Modal ── */}
      {pwOpen && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setPwOpen(false)}>
          <div ref={pwModalRef} role="dialog" aria-modal="true" aria-label="Change My Password" tabIndex={-1}
            className="modal-card" style={{ width: 380, padding: '1.75rem', outline: 'none' }}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}><Icon name="key" size={16} color="#374151" /> Change My Password</div>
            <p style={{ fontSize: 12, color: '#374151', marginBottom: 22 }}>{user?.email}</p>

            <form onSubmit={handleChangePw}>
              {[['current', 'Current Password'], ['newPw', 'New Password'], ['confirm', 'Confirm New Password']].map(([f, label]) => (
                <div key={f} style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 12, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 5 }}>{label}</label>
                  <div style={{ position: 'relative' }}>
                    <input type={show ? 'text' : 'password'} value={form[f]}
                      onChange={e => setForm(p => ({ ...p, [f]: e.target.value }))} required
                      style={{ width: '100%', boxSizing: 'border-box', padding: '9px 36px 9px 12px', borderRadius: 8, border: '0.5px solid #D1D5DB', fontSize: 13, fontFamily: 'inherit' }} />
                    {f === 'confirm' && (
                      <button type="button" onClick={() => setShow(s => !s)} aria-label={show ? 'Hide password' : 'Show password'}
                        style={{ position: 'absolute', right: 11, top: '50%', transform: 'translateY(-50%)', cursor: 'pointer', fontSize: 14, color: '#374151', background: 'none', border: 'none', padding: 4 }}>
                        <Icon name={show ? 'eye-off' : 'eye'} size={14} color="#6B7280" />
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {msg && (
                <div style={{ fontSize: 12, marginBottom: 14, padding: '8px 12px', borderRadius: 7, display: 'flex', alignItems: 'center', gap: 6, background: msg.includes('updated') ? '#EAF3DE' : '#FCEBEB', color: msg.includes('updated') ? '#3B6D11' : '#A32D2D' }}>
                  <Icon name={msg.includes('updated') ? 'check-circle' : 'x-circle'} size={13} color={msg.includes('updated') ? '#3B6D11' : '#A32D2D'} />
                  {msg.replace('✅ ', '').replace('❌ ', '')}
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
