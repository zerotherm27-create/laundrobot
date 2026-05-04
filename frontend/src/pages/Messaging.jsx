import { useEffect, useState } from 'react';
import { sendBlast, getBlastHistory, getPausedCustomers, releaseAi, getMyTenantSettings } from '../api.js';

const STATUSES = ['NEW ORDER','FOR PICK UP','PROCESSING','FOR DELIVERY','COMPLETED'];

export default function Messaging() {
  const [message, setMessage] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);
  const [history,        setHistory]        = useState([]);
  const [pausedCustomers,setPausedCustomers] = useState([]);
  const [releasingId,    setReleasingId]    = useState(null);
  const [tenantPlan,     setTenantPlan]     = useState('starter');

  useEffect(() => {
    getBlastHistory().then(r => setHistory(r.data)).catch(() => {});
    getPausedCustomers().then(r => setPausedCustomers(r.data)).catch(() => {});
    getMyTenantSettings().then(r => setTenantPlan(r.data.plan || 'starter')).catch(() => {});
  }, []);

  async function handleReleaseAi(fbUserId) {
    setReleasingId(fbUserId);
    try {
      await releaseAi(fbUserId);
      setPausedCustomers(p => p.filter(c => c.fb_user_id !== fbUserId));
    } catch { alert('Failed to release.'); }
    finally { setReleasingId(null); }
  }

  async function handleBlast() {
    if (!message.trim()) return alert('Please enter a message.');
    setSending(true); setResult(null);
    try {
      const { data } = await sendBlast(message, filterStatus || null);
      setResult(`Sent to ${data.sent} customer(s) via Messenger!`);
      setMessage('');
      getBlastHistory().then(r => setHistory(r.data));
    } catch (err) {
      setResult('Error: ' + err.message);
    } finally { setSending(false); }
  }

  return (
    <div>
      <h2 style={{ fontSize: 18, fontWeight: 500, marginBottom: '1.25rem' }}>Messaging</h2>
      {/* ── AI Paused Customers ── */}
      {pausedCustomers.length > 0 && (
        <div style={{ marginBottom: 20, background: '#fff', border: '0.5px solid #e8e8e0', borderRadius: 12, padding: '1.25rem' }}>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 10 }}>🤫 AI Paused ({pausedCustomers.length})</div>
          <div style={{ fontSize: 12, color: '#374151', marginBottom: 12 }}>
            AI is silenced for these customers because you replied to them. It resumes automatically when the pause expires.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {pausedCustomers.map(c => (
              <div key={c.fb_user_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderRadius: 8, background: '#F9FAFB', border: '0.5px solid #E2E8F0' }}>
                <div>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>{c.customer_name || c.fb_user_id}</span>
                  {c.customer_phone && <span style={{ fontSize: 12, color: '#374151', marginLeft: 8 }}>{c.customer_phone}</span>}
                  <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>
                    Resumes {new Date(c.ai_paused_until).toLocaleString()}
                  </div>
                </div>
                <button onClick={() => handleReleaseAi(c.fb_user_id)} disabled={releasingId === c.fb_user_id}
                  style={{ fontSize: 12, fontWeight: 600, padding: '5px 12px', borderRadius: 6, border: 'none', background: '#38a9c2', color: '#fff', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  {releasingId === c.fb_user_id ? 'Releasing…' : 'Release to AI'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div>
          <div style={{ fontWeight: 500, fontSize: 14, marginBottom: 10 }}>Send blast message</div>
          <div style={{ background: '#fff', border: '0.5px solid #e8e8e0', borderRadius: 12, padding: '1.25rem' }}>
          {!['growth', 'pro'].includes(tenantPlan) ? (
            <div style={{ padding: '1.5rem', textAlign: 'center' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#111827', marginBottom: 6 }}>Growth plan feature</div>
              <div style={{ fontSize: 12, color: '#374151', marginBottom: 14, lineHeight: 1.6 }}>
                Blast messaging lets you send a message to all your customers at once. Available on the <strong>Growth plan</strong> and above.
              </div>
              <div style={{ fontSize: 11, color: '#6B7280' }}>Contact your admin to upgrade your plan.</div>
            </div>
          ) : (<>
            <label style={{ fontSize: 12, color: '#374151', display: 'block', marginBottom: 5 }}>Send to</label>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
              style={{ width: '100%', padding: '7px 10px', fontSize: 13, borderRadius: 6, border: '0.5px solid #ccc', marginBottom: 14 }}>
              <option value="">All customers</option>
              <option value="subscribed">🔔 Promo subscribers only</option>
              {STATUSES.map(s => <option key={s} value={s}>Orders: {s}</option>)}
            </select>
            <label style={{ fontSize: 12, color: '#374151', display: 'block', marginBottom: 5 }}>Message</label>
            <textarea value={message} onChange={e => setMessage(e.target.value)} rows={5}
              placeholder="Hi {name}, your order {order_id} is now {status}."
              style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', fontSize: 13, borderRadius: 6, border: '0.5px solid #ccc', resize: 'vertical', marginBottom: 8, fontFamily: 'inherit' }} />
            <div style={{ fontSize: 11, color: '#374151', marginBottom: 14 }}>
              Variables: {'{name}'} {'{order_id}'} {'{status}'} {'{pickup_time}'}
            </div>
            <button onClick={handleBlast} disabled={sending}
              style={{ width: '100%', padding: '9px', fontSize: 13, borderRadius: 6, cursor: 'pointer', background: sending ? '#6B8EAD' : '#38a9c2', color: '#fff', border: 'none', fontWeight: 500 }}>
              {sending ? 'Sending...' : 'Send blast message'}
            </button>
            {result && (
              <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 6, background: result.startsWith('Error') ? '#FCEBEB' : '#EAF3DE', color: result.startsWith('Error') ? '#A32D2D' : '#3B6D11', fontSize: 13 }}>
                {result}
              </div>
            )}
          </>)}
          </div>
        </div>
        <div>
          <div style={{ fontWeight: 500, fontSize: 14, marginBottom: 10 }}>Blast history</div>
          <div style={{ background: '#fff', border: '0.5px solid #e8e8e0', borderRadius: 12, overflow: 'hidden' }}>
            {history.length === 0 ? (
              <div style={{ padding: '1.5rem', color: '#374151', fontSize: 13, textAlign: 'center' }}>No blasts sent yet</div>
            ) : history.map(b => (
              <div key={b.id} style={{ padding: '10px 14px', borderTop: '0.5px solid #f0f0ec', fontSize: 13 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span style={{ fontWeight: 500 }}>Sent to {b.sent_count} customers</span>
                  <span style={{ fontSize: 11, color: '#374151' }}>{new Date(b.created_at).toLocaleString()}</span>
                </div>
                <div style={{ fontSize: 12, color: '#374151', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.message}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}