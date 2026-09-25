import { useState } from 'react';
import { useModalA11y } from '../hooks/useModalA11y.js';
import { Icon } from './Icons.jsx';
import { TUTORIAL_STEPS, TUTORIAL_EXAMPLES, TUTORIAL_MISTAKES } from '../utils/servicesTutorial.js';

// Right-side drawer: "Step by step" (the 5 things to do) and "Examples" (worked pricing examples).
export default function ServicesTutorial({ open, onClose }) {
  const ref = useModalA11y(onClose, open);
  const [tab, setTab] = useState('steps');
  if (!open) return null;

  const tabBtn = (key, label) => (
    <button type="button" onClick={() => setTab(key)} aria-pressed={tab === key}
      style={{ flex: 1, padding: '9px 12px', fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none', fontFamily: 'inherit',
        borderBottom: tab === key ? '2px solid var(--primary)' : '2px solid transparent',
        background: 'none', color: tab === key ? 'var(--primary)' : '#6B7280' }}>
      {label}
    </button>
  );

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.35)', zIndex: 200, display: 'flex', justifyContent: 'flex-end' }}>
      <div ref={ref} role="dialog" aria-modal="true" aria-label="How to set up services" tabIndex={-1} onClick={e => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 520, height: '100%', background: '#fff', display: 'flex', flexDirection: 'column',
          boxShadow: '-4px 0 24px rgba(0,0,0,.12)', animation: 'slideInRight .22s ease', outline: 'none' }}>

        <div style={{ padding: '1.25rem 1.5rem 0', borderBottom: '0.5px solid #E8E8E0' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <div style={{ fontWeight: 600, fontSize: 16, color: '#111827' }}>How to set up services</div>
            <button type="button" onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
              <Icon name="x" size={18} color="#6B7280" />
            </button>
          </div>
          <div style={{ fontSize: 12, color: '#374151', marginBottom: 8 }}>Services are what customers order. A few minutes here saves a lot of confusion later.</div>
          <div style={{ display: 'flex' }}>{tabBtn('steps', 'Step by step')}{tabBtn('examples', 'Examples')}</div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.5rem 1.5rem' }}>
          {tab === 'steps' && TUTORIAL_STEPS.map((s, i) => (
            <div key={s.title} style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
              <div style={{ width: 26, height: 26, borderRadius: 13, background: 'var(--primary)', color: '#fff', fontSize: 13, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{i + 1}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>{s.title}</div>
                <div style={{ fontSize: 13, color: '#374151', margin: '2px 0 6px' }}>{s.body}</div>
                <ul style={{ margin: '0 0 6px', paddingLeft: 18, fontSize: 13, color: '#111827', lineHeight: 1.55 }}>
                  {s.todo.map(t => <li key={t}>{t}</li>)}
                </ul>
                {s.note && <div style={{ fontSize: 12, color: '#374151', background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 8, padding: '7px 10px' }}>{s.note}</div>}
              </div>
            </div>
          ))}

          {tab === 'examples' && (
            <>
              {TUTORIAL_EXAMPLES.map(ex => (
                <div key={ex.title} style={{ border: '0.5px solid #E8E8E0', borderRadius: 10, padding: '12px 14px', marginBottom: 12 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#111827', marginBottom: 6 }}>{ex.title}</div>
                  <ul style={{ margin: '0 0 8px', paddingLeft: 18, fontSize: 13, color: '#111827', lineHeight: 1.55 }}>
                    {ex.fields.map(f => <li key={f}>{f}</li>)}
                  </ul>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#15803D', background: '#F0FAF5', border: '1px solid #BBF7D0', borderRadius: 8, padding: '7px 10px' }}>{ex.result}</div>
                </div>
              ))}
              <div style={{ border: '1px solid #FED7AA', background: '#FFF7ED', borderRadius: 10, padding: '12px 14px' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#92400E', marginBottom: 6 }}>Common mistakes</div>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: '#78350F', lineHeight: 1.55 }}>
                  {TUTORIAL_MISTAKES.map(m => <li key={m}>{m}</li>)}
                </ul>
              </div>
            </>
          )}
        </div>

        <div style={{ padding: '0.9rem 1.5rem', borderTop: '0.5px solid #E8E8E0', display: 'flex', justifyContent: 'flex-end' }}>
          <button type="button" className="btn-primary" onClick={onClose}>Got it, let me try</button>
        </div>
      </div>
    </div>
  );
}
