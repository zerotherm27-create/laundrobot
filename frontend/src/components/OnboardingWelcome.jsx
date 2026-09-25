import { useModalA11y } from '../hooks/useModalA11y.js';
import { Icon } from './Icons.jsx';

const HOW_IT_WORKS = [
  { icon: 'link',    text: 'Customers book on your booking link or through Messenger.' },
  { icon: 'kanban',  text: 'Their orders land on your Kanban board.' },
  { icon: 'bell',    text: 'You move an order along, and customers are notified automatically.' },
];

// One-time greeting for a brand-new shop. Explains the product in three lines, then hands off to the checklist.
export default function OnboardingWelcome({ open, shopName, requiredCount, onStart, onSkip }) {
  const ref = useModalA11y(onSkip, open);
  if (!open) return null;
  return (
    <div className="modal-overlay" style={{ zIndex: 210 }}>
      <div ref={ref} className="modal-card" role="dialog" aria-modal="true" aria-label="Welcome to LaundroBot" tabIndex={-1}
        style={{ maxWidth: 440, padding: '1.5rem', outline: 'none' }}>
        <div style={{ fontSize: 20, fontWeight: 600, color: '#111827', marginBottom: 4 }}>
          Welcome to LaundroBot{shopName ? `, ${shopName}` : ''}! 👋
        </div>
        <div style={{ fontSize: 14, color: '#374151', marginBottom: 16 }}>Here's how it works:</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 18 }}>
          {HOW_IT_WORKS.map((r, i) => (
            <div key={r.icon} style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <div style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon name={r.icon} size={17} color="var(--primary)" />
              </div>
              <div style={{ fontSize: 14, color: '#111827' }}><strong>{i + 1}.</strong> {r.text}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 14, color: '#374151', background: '#F0FAF5', border: '1px solid #BBF7D0', borderRadius: 8, padding: '10px 12px', marginBottom: 18 }}>
          Complete <strong>{requiredCount} quick steps</strong> (about 10 minutes) and you're ready for your first booking. We'll tick them off for you as you go.
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" className="btn-ghost" onClick={onSkip}>Skip for now</button>
          <button type="button" className="btn-primary" onClick={onStart}>Start setup</button>
        </div>
      </div>
    </div>
  );
}
