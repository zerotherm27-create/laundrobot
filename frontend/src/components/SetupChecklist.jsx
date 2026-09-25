import { useEffect, useState } from 'react';
import { useModalA11y } from '../hooks/useModalA11y.js';
import { Icon } from './Icons.jsx';

// Right-side drawer: progress bar, one row per step with a one-line "why", an expandable "what to do",
// a Go button that jumps to the right page, and the shop's booking link.
export default function SetupChecklist({ open, onClose, summary, onGo, onOpenGuide, onHide, bookingUrl }) {
  const ref = useModalA11y(onClose, open);
  const [expanded, setExpanded] = useState(null);
  const [copied, setCopied] = useState(false);

  // When opened, expand the first unfinished step so the next action is obvious.
  useEffect(() => {
    if (!open || !summary) return;
    const next = summary.steps.find(s => !s.isDone && !s.optional) || summary.steps.find(s => !s.isDone);
    setExpanded(next ? next.key : null);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!open || !summary) return null;
  const pct = Math.round((summary.done / summary.total) * 100);

  function copyLink() {
    navigator.clipboard?.writeText(bookingUrl).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }).catch(() => {});
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.35)', zIndex: 200, display: 'flex', justifyContent: 'flex-end' }}>
      <div ref={ref} role="dialog" aria-modal="true" aria-label="Getting started" tabIndex={-1} onClick={e => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 480, height: '100%', background: '#fff', display: 'flex', flexDirection: 'column',
          boxShadow: '-4px 0 24px rgba(0,0,0,.12)', animation: 'slideInRight .22s ease', outline: 'none' }}>

        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '0.5px solid #E8E8E0' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ fontWeight: 600, fontSize: 16, color: '#111827' }}>
              {summary.complete ? 'Setup complete 🎉' : 'Getting started'}
            </div>
            <button type="button" onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
              <Icon name="x" size={18} color="#6B7280" />
            </button>
          </div>
          <div style={{ height: 8, borderRadius: 4, background: '#E5E7EB', overflow: 'hidden' }}>
            <div style={{ width: `${pct}%`, height: '100%', background: 'var(--success)', transition: 'width .3s' }} />
          </div>
          <div style={{ fontSize: 12, color: '#374151', marginTop: 6 }}>
            {summary.done} of {summary.total} done
            {summary.complete ? ' — you can take bookings now.' : ` · ${summary.requiredTotal - summary.requiredDone} required step${summary.requiredTotal - summary.requiredDone === 1 ? '' : 's'} left`}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem 1rem 1.25rem' }}>
          {summary.steps.map(s => {
            const isOpen = expanded === s.key;
            return (
              <div key={s.key} style={{ border: '0.5px solid #E8E8E0', borderRadius: 10, marginTop: 8, background: s.isDone ? '#FAFAF8' : '#fff' }}>
                <button type="button" onClick={() => setExpanded(isOpen ? null : s.key)} aria-expanded={isOpen}
                  style={{ width: '100%', display: 'flex', gap: 12, alignItems: 'center', padding: '12px 14px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                  <div style={{ width: 26, height: 26, borderRadius: 13, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: s.isDone ? 'var(--success)' : '#fff', border: s.isDone ? 'none' : '1.5px solid #D1D5DB' }}>
                    {s.isDone && <Icon name="check" size={14} color="#fff" strokeWidth={2.5} />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: s.isDone ? '#6B7280' : '#111827', textDecoration: s.isDone ? 'line-through' : 'none' }}>
                      {s.title}{s.optional && <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 500, color: '#6B7280', background: '#F0F0EC', borderRadius: 4, padding: '1px 6px' }}>Optional</span>}
                    </div>
                    <div style={{ fontSize: 12, color: '#374151', marginTop: 2 }}>{s.why}</div>
                  </div>
                </button>
                {isOpen && (
                  <div style={{ padding: '0 14px 14px 52px' }}>
                    <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.5, marginBottom: 10 }}>{s.how}</div>
                    <button type="button" className="btn-primary" onClick={() => onGo(s)}>
                      {s.isDone ? 'Review' : 'Go'} <Icon name="external-link" size={13} color="#fff" style={{ marginLeft: 4 }} />
                    </button>
                  </div>
                )}
              </div>
            );
          })}

          {bookingUrl && (
            <div style={{ marginTop: 16, border: '1px solid #BBF7D0', background: '#F0FAF5', borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#15803D', marginBottom: 4 }}>Your booking link</div>
              <div style={{ fontSize: 12, color: '#374151', marginBottom: 8 }}>Share this with customers — they can book without an account.</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <code style={{ flex: 1, fontSize: 12, background: '#fff', border: '0.5px solid #E5E7EB', borderRadius: 6, padding: '6px 8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{bookingUrl}</code>
                <button type="button" className="btn-ghost" onClick={copyLink}>{copied ? 'Copied ✓' : 'Copy'}</button>
              </div>
            </div>
          )}
        </div>

        <div style={{ padding: '0.9rem 1.5rem', borderTop: '0.5px solid #E8E8E0', display: 'flex', justifyContent: 'space-between', gap: 8 }}>
          <button type="button" className="btn-ghost" onClick={onOpenGuide}>Read the full guide</button>
          {summary.complete && <button type="button" className="btn-ghost" onClick={onHide}>Hide checklist</button>}
        </div>
      </div>
    </div>
  );
}
