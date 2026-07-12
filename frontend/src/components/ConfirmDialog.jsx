import { useConfirmRequest } from '../context/ConfirmContext.jsx';
import { useModalA11y } from '../hooks/useModalA11y.js';

export default function ConfirmDialog() {
  const { request, settle } = useConfirmRequest();
  const modalRef = useModalA11y(() => settle(false), !!request);

  if (!request) return null;

  const {
    title,
    message,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    danger = false,
  } = request;

  return (
    <div className="modal-overlay" style={{ zIndex: 300 }} onClick={e => e.target === e.currentTarget && settle(false)}>
      <div ref={modalRef} role="alertdialog" aria-modal="true" aria-label={title || 'Confirm'} tabIndex={-1}
        className="modal-card" style={{ width: 400, padding: '1.5rem', outline: 'none' }}>
        {title && (
          <div style={{ fontWeight: 700, fontSize: 16, color: '#111827', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
            {danger && <span style={{ color: '#DC2626', fontSize: 18, lineHeight: 1 }}>⚠</span>}
            {title}
          </div>
        )}
        <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.6, marginBottom: 20, whiteSpace: 'pre-wrap' }}>
          {message}
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn-ghost" onClick={() => settle(false)}>{cancelLabel}</button>
          <button
            onClick={() => settle(true)}
            style={{
              padding: '8px 16px', fontSize: 13, fontWeight: 500, borderRadius: 'var(--radius)', border: 'none',
              cursor: 'pointer', color: '#fff',
              background: danger ? '#DC2626' : 'var(--primary)',
            }}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
