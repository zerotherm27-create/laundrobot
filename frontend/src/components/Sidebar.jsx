import { useAuth } from '../context/AuthContext.jsx';

const NAV = [
  { key: 'Overview',  icon: '▦',  label: 'Overview' },
  { key: 'Kanban',    icon: '⊞',  label: 'Kanban Board' },
  { key: 'Orders',    icon: '📋', label: 'Orders' },
  { key: 'Customers', icon: '👤', label: 'Customers' },
  { key: 'Services',  icon: '✦',  label: 'Services' },
  { key: 'Messaging', icon: '✉',  label: 'Messaging' },
  { key: 'Reports',   icon: '📊', label: 'Reports' },
];

export default function Sidebar({ current, onNav, role }) {
  const { user, logout } = useAuth();

  return (
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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: role === 'superadmin' ? '#FAEEDA' : '#E6F1FB', color: role === 'superadmin' ? '#BA7517' : '#185FA5' }}>
            {role}
          </span>
          <button onClick={logout} style={{ fontSize: 12, color: '#A32D2D', background: 'none', border: 'none', cursor: 'pointer' }}>
            Sign out
          </button>
        </div>
      </div>
    </aside>
  );
}