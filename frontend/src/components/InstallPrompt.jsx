import { useInstallPrompt } from '../hooks/useInstallPrompt.js';
import { Icon } from './Icons.jsx';

export default function InstallPrompt() {
  const { visible, install, dismiss } = useInstallPrompt();
  if (!visible) return null;

  return (
    <div className="install-prompt animate-fade-in" style={{
      position: 'fixed', left: 12, right: 12, zIndex: 160,
      background: 'var(--card)', border: '0.5px solid var(--border)',
      borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-xl)',
      padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10,
      maxWidth: 380, marginLeft: 'auto', marginRight: 'auto',
    }}>
      <img src="/logo.png" alt="" style={{ width: 34, height: 34, borderRadius: 8, objectFit: 'contain', flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>Install LaundroBot</div>
        <div style={{ fontSize: 11, color: '#6B7280' }}>Add to your home screen for the full app experience.</div>
      </div>
      <button onClick={install} className="btn-primary" style={{ flexShrink: 0, padding: '7px 12px', fontSize: 12 }}>
        Install
      </button>
      <button onClick={dismiss} aria-label="Dismiss"
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, flexShrink: 0 }}>
        <Icon name="x" size={16} color="#9CA3AF" />
      </button>
    </div>
  );
}
