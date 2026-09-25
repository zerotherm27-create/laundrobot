import { useEffect, useState } from 'react';
import { PAGE_HELP } from '../utils/pageHelp.js';
import { Icon } from './Icons.jsx';

// Per-tenant, per-browser "seen" flag for each tab (namespaced so a shared device never leaks between shops).
const keyFor = (tid, page) => `lb_help_seen_${tid}_${page}`;
const read = k => { try { return localStorage.getItem(k); } catch { return null; } };
const write = k => { try { localStorage.setItem(k, '1'); } catch { /* private mode — it will just show again */ } };

// Inline intro for whichever tab is open. Expanded on the first visit; after "Got it" it shrinks to a small
// "About this page" link that re-opens it. Rendered once in the app shell above <Page />, keyed by page.
export default function PageIntro({ page, user }) {
  const help = PAGE_HELP[page];
  const tid = user?.tenant_id;
  const eligible = !!help && !!tid && user?.role !== 'superadmin';
  const [open, setOpen] = useState(() => eligible && !read(keyFor(tid, page)));

  // The shell reuses this component when the tab changes, so re-evaluate per page.
  useEffect(() => { setOpen(eligible && !read(keyFor(tid, page))); }, [page, tid, eligible]);

  if (!eligible) return null;

  function gotIt() { write(keyFor(tid, page)); setOpen(false); }

  if (!open) {
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 6 }}>
        <button type="button" onClick={() => setOpen(true)} aria-expanded="false"
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--primary-tint-text, #1a7d94)', display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 4px', fontFamily: 'inherit' }}>
          <Icon name="info" size={13} color="currentColor" /> About this page
        </button>
      </div>
    );
  }

  return (
    <div role="region" aria-label={`About ${help.title}`}
      style={{ background: 'var(--primary-light, #e6f5f8)', border: '1px solid #b8e0e8', borderRadius: 12, padding: '14px 16px', marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <Icon name="info" size={16} color="var(--primary)" />
        <div style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>About {help.title}</div>
      </div>
      <div style={{ fontSize: 13, color: '#374151', marginBottom: 8 }}>{help.purpose}</div>
      <ul style={{ margin: '0 0 8px', paddingLeft: 18, fontSize: 13, color: '#111827', lineHeight: 1.55 }}>
        {help.tips.map(t => <li key={t}>{t}</li>)}
      </ul>
      {help.gotcha && (
        <div style={{ fontSize: 12, color: '#92400E', background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 8, padding: '7px 10px', marginBottom: 8 }}>
          <strong>Good to know:</strong> {help.gotcha}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
        {help.action && (
          <button type="button" className="btn-primary" onClick={() => window.dispatchEvent(new CustomEvent(help.action.event))}>
            {help.action.label}
          </button>
        )}
        <button type="button" className="btn-ghost" onClick={gotIt}>Got it</button>
      </div>
    </div>
  );
}
