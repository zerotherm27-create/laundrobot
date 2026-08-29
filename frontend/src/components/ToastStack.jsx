import { useToastList } from '../context/ToastContext.jsx';
import { Icon } from './Icons.jsx';

const TONE = {
  error:   { bg: '#FEF2F2', border: '#FECACA', color: '#DC2626', icon: 'alert-triangle' },
  success: { bg: '#F0FDF4', border: '#86EFAC', color: '#166534', icon: 'check-circle' },
  info:    { bg: '#F0F9FF', border: '#BAE6FD', color: '#0369A1', icon: 'info' },
};

export default function ToastStack() {
  const { toasts, dismissToast } = useToastList();
  if (!toasts.length) return null;

  return (
    <div style={{
      position: 'fixed', bottom: 20, right: 20, zIndex: 400,
      display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 360,
    }}>
      {toasts.map(t => {
        const tone = TONE[t.tone] || TONE.error;
        return (
          <div key={t.id} role="alert" style={{
            display: 'flex', alignItems: 'flex-start', gap: 8,
            background: tone.bg, border: `1px solid ${tone.border}`, color: tone.color,
            borderRadius: 10, padding: '10px 12px', fontSize: 13, boxShadow: 'var(--shadow)',
            animation: 'fadeIn .2s ease',
          }}>
            <Icon name={tone.icon} size={14} color={tone.color} style={{ flexShrink: 0, marginTop: 1 }} />
            <span style={{ flex: 1, lineHeight: 1.5 }}>{t.message}</span>
            <button onClick={() => dismissToast(t.id)} aria-label="Dismiss"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: tone.color, fontSize: 14, lineHeight: 1, padding: 2, flexShrink: 0 }}>
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
}
