import { useEffect, useState } from 'react';
import { getAccessLog } from '../api.js';

// What platform staff (LaundroBot's superadmin) did in THIS shop's account — shown to shop owners for transparency.
const LABELS = {
  switch_into_shop:      'Opened your account for support',
  user_create:           'Created a user account',
  user_update:           'Edited a user account',
  user_password_reset:   'Reset a user password',
  user_delete:           'Removed a user account',
  tenant_update:         'Changed shop settings',
  tenant_create:         'Created your shop',
  tenant_delete:         'Deleted the shop',
  clone_data:            'Copied services / settings into your shop',
  messenger_setup:       'Re-ran Messenger setup',
  facebook_page_connect: 'Connected your Facebook Page',
};

export default function AccessLog() {
  const [rows, setRows] = useState(null); // null = loading
  useEffect(() => {
    let alive = true;
    getAccessLog().then(r => { if (alive) setRows(r.data || []); }).catch(() => { if (alive) setRows([]); });
    return () => { alive = false; };
  }, []);

  if (rows === null) return <div style={{ fontSize: 13, color: '#6B7280' }}>Loading…</div>;
  if (rows.length === 0) {
    return <div style={{ fontSize: 13, color: '#374151' }}>No LaundroBot staff access to your account has been recorded.</div>;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 260, overflowY: 'auto' }}>
      {rows.map(r => {
        const extra = r.detail?.email || r.detail?.page || r.detail?.shop;
        return (
          <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13, padding: '6px 0', borderBottom: '0.5px solid #f0f0ec' }}>
            <span style={{ color: '#111827' }}>{LABELS[r.action] || r.action}{extra ? ` — ${extra}` : ''}</span>
            <span style={{ color: '#6B7280', whiteSpace: 'nowrap' }}>{new Date(r.created_at).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })}</span>
          </div>
        );
      })}
    </div>
  );
}
